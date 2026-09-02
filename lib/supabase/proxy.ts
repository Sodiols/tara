import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { isSupabaseConfigured, supabaseEnv } from "./env";

/**
 * Runs before every storefront and admin request.
 *
 * Three jobs, in this order:
 *
 *   1. refresh the Supabase session cookie, and give us an identity that
 *      Supabase verified rather than one decoded from a cookie;
 *   2. redirect a signed-out visitor away from a protected shell;
 *   3. close the storefront when maintenance mode is on.
 *
 * This is a first gate only. Every page underneath still calls
 * requireUser()/requireStaff() server-side, and row level security enforces
 * access independently — so a bug here degrades to a slower redirect, never to
 * unauthorised data.
 */

/** Paths that require *some* signed-in user. */
const PROTECTED_PREFIXES = ["/admin", "/account"];

/** Signed-in users have no reason to see these; send them onward instead. */
const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"];

/**
 * What stays reachable while maintenance mode is on.
 *
 * Every entry here exists so the shop can be repaired from inside itself:
 *
 *   /admin           the whole back office, which is the point of the switch
 *   /login           because reaching /admin requires signing in first
 *   /auth            Supabase's email-confirmation and OAuth callbacks, which
 *                    must complete or the sign-in that follows them fails
 *   /reset-password  the recovery link lands here with a live session
 *   /api/health      so an uptime monitor can tell "closed" from "broken"
 *   /maintenance     the page itself, or the rewrite would loop
 *
 * Next.js assets (/_next), the favicon and the site's own metadata routes are
 * excluded by the matcher in proxy.ts before this ever runs, so the maintenance
 * page still gets its stylesheet and fonts.
 */
const MAINTENANCE_EXEMPT_PREFIXES = [
  "/admin",
  "/login",
  "/auth",
  "/reset-password",
  "/api/health",
  "/maintenance",
];

function hasPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isProtected(pathname: string) {
  return hasPrefix(pathname, PROTECTED_PREFIXES);
}

/**
 * A per-request nonce for the Content Security Policy.
 *
 * Next.js emits a small amount of inline bootstrap script that cannot be moved
 * into a file. Allowing it with `'unsafe-inline'` — which is what this project
 * did — allows every *other* inline script too, including one injected through
 * a field an administrator can edit. A nonce allows exactly the scripts this
 * response generated and nothing else.
 *
 * Next.js reads the nonce back out of the CSP header on the request and stamps
 * it onto the scripts it renders, so no component has to thread it through.
 */
function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Built per request so it can carry the nonce.
 *
 * `'strict-dynamic'` lets a nonced script load the chunks it needs without
 * every chunk URL having to be listed — which is what makes a nonce workable
 * with a bundler that code-splits. Browsers that do not understand it fall back
 * to the `'self'` source, so nothing breaks on an older engine.
 *
 * `style-src` keeps `'unsafe-inline'`: Next.js and Tailwind both emit inline
 * style attributes during hydration, there is no nonce mechanism for the
 * `style` attribute, and CSP cannot express "attributes but not elements". The
 * risk is materially lower than for script — an injected style cannot execute —
 * and removing it would break rendering. Documented in docs/PRODUCTION.md.
 */
function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  const supabaseOrigin = supabaseEnv.url || "";
  const supabaseSocket = supabaseOrigin.replace("https://", "wss://");
  let monitoringOrigin = "";
  try {
    monitoringOrigin = new URL(process.env.NEXT_PUBLIC_SENTRY_DSN ?? "").origin;
  } catch {
    // Monitoring is optional; an absent or malformed DSN adds no CSP source.
  }

  return [
    "default-src 'self'",
    // 'unsafe-eval' is dev-only: React Fast Refresh needs it, production does not.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: ${isDev ? "'unsafe-eval'" : ""}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    // next/font/google self-hosts the font files at build time, so no
    // fonts.gstatic.com entry is needed at runtime.
    "font-src 'self' data:",
    `img-src 'self' data: blob: https://images.unsplash.com${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseSocket}` : ""}${monitoringOrigin ? ` ${monitoringOrigin}` : ""}${isDev ? " ws: http://localhost:*" : ""}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "manifest-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Reads maintenance mode without a Supabase session.
 *
 * The proxy runs on the edge runtime, where the SSR client and its cookie
 * handling are heavier than this needs to be, and the answer is the same for
 * every visitor. So it is a plain REST read of one world-readable settings row,
 * with a short in-process cache: an uncached read on every request would put
 * the database in the path of every page load to serve a boolean that changes
 * perhaps twice a year.
 *
 * A failure returns false. Closing the shop because a settings read timed out
 * would turn a transient database blip into an outage.
 */
let maintenanceCache: { value: boolean; expiresAt: number } | null = null;
const MAINTENANCE_TTL_MS = 30_000;

/**
 * Collection visibility, cached per slug — with a ceiling.
 *
 * THE LEAK
 * --------
 * This was an unbounded Map. The key is whatever matched
 * `/^\/collection\/([a-z0-9-]{1,100})$/` in the request path, which is
 * attacker-chosen: `/collection/a1`, `/collection/a2`, and so on for as long as
 * anybody cares to keep requesting. Every distinct slug added an entry, expired
 * entries were read past but never deleted, and nothing ever removed anything.
 * A crawler with a bad link pattern would do it by accident. In a long-lived
 * server process that is a slow memory leak in the request path of every page
 * load.
 *
 * THE BOUND
 * ---------
 * A TTL that is actually enforced by deletion, and a hard cap on entries.
 * Insertion-ordered Maps make the eviction policy free: the oldest key is the
 * first one `keys()` yields. Real collections number in the tens, so the cap is
 * far above legitimate use and the eviction path is only ever reached by
 * something abusive.
 *
 * No user data goes in here — a slug and a boolean — so evicting early costs
 * one database read, never correctness.
 */
const COLLECTION_TTL_MS = 60_000;
const COLLECTION_CACHE_MAX = 256;
const collectionVisibilityCache = new Map<string, { value: boolean; expiresAt: number }>();

function readCollectionCache(slug: string, now: number): boolean | null {
  const cached = collectionVisibilityCache.get(slug);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    // Deleted on read rather than left behind. Reading past a stale entry is
    // what let the Map grow without limit even under honest traffic.
    collectionVisibilityCache.delete(slug);
    return null;
  }
  return cached.value;
}

function writeCollectionCache(slug: string, value: boolean, now: number): void {
  // Re-inserting moves an existing key to the end, so a slug that is being
  // requested constantly is not evicted while a stale one ahead of it survives.
  collectionVisibilityCache.delete(slug);
  collectionVisibilityCache.set(slug, { value, expiresAt: now + COLLECTION_TTL_MS });

  while (collectionVisibilityCache.size > COLLECTION_CACHE_MAX) {
    const oldest = collectionVisibilityCache.keys().next();
    if (oldest.done) break;
    collectionVisibilityCache.delete(oldest.value);
  }
}

async function isPublicCollectionRoute(pathname: string): Promise<boolean> {
  const match = /^\/collection\/([a-z0-9-]{1,100})$/.exec(pathname);
  if (!match) return true;
  if (!isSupabaseConfigured()) return false;

  const slug = match[1];
  const now = Date.now();
  const cached = readCollectionCache(slug, now);
  if (cached !== null) return cached;

  try {
    const query = new URLSearchParams({
      slug: `eq.${slug}`,
      select: "is_active,starts_at,ends_at",
      limit: "1",
    });
    const response = await fetch(`${supabaseEnv.url}/rest/v1/collections?${query}`, {
      headers: {
        apikey: supabaseEnv.publishableKey,
        authorization: `Bearer ${supabaseEnv.publishableKey}`,
        accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) return true;

    const rows = (await response.json()) as {
      is_active: boolean;
      starts_at: string | null;
      ends_at: string | null;
    }[];
    const row = rows[0];
    const visible = Boolean(
      row?.is_active &&
        (!row.starts_at || new Date(row.starts_at).getTime() <= now) &&
        (!row.ends_at || new Date(row.ends_at).getTime() > now),
    );
    writeCollectionCache(slug, visible, now);
    return visible;
  } catch {
    // Let the page-level query handle transient database failures. Failing
    // closed here would turn a Supabase timeout into false 404s.
    return true;
  }
}

async function isMaintenanceMode(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const now = Date.now();
  if (maintenanceCache && maintenanceCache.expiresAt > now) return maintenanceCache.value;

  try {
    const response = await fetch(
      `${supabaseEnv.url}/rest/v1/store_settings?key=eq.maintenance_mode&select=value`,
      {
        headers: {
          apikey: supabaseEnv.publishableKey,
          authorization: `Bearer ${supabaseEnv.publishableKey}`,
          accept: "application/json",
        },
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error(`status ${response.status}`);

    const rows = (await response.json()) as { value: unknown }[];
    const value = rows[0]?.value === true;
    maintenanceCache = { value, expiresAt: now + MAINTENANCE_TTL_MS };
    return value;
  } catch {
    maintenanceCache = { value: false, expiresAt: now + MAINTENANCE_TTL_MS };
    return false;
  }
}

export async function updateSession(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const nonce = createNonce();
  const csp = contentSecurityPolicy(nonce, isDev);
  const { pathname, search } = request.nextUrl;

  // The nonce travels on the request so Next.js can stamp it onto the scripts
  // it renders for this response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-tara-pathname", pathname);
  requestHeaders.set("Content-Security-Policy", csp);

  const withSecurityHeaders = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  // App Router may already have streamed the root shell by the time a dynamic
  // page calls notFound(), which leaves the browser with a visually correct
  // not-found page but HTTP 200. Resolve collection visibility at the edge so
  // invalid collection URLs carry a real 404 status for users and crawlers.
  if (!(await isPublicCollectionRoute(pathname))) {
    const notFoundUrl = request.nextUrl.clone();
    notFoundUrl.pathname = "/_not-found";
    notFoundUrl.search = "";
    return withSecurityHeaders(
      NextResponse.rewrite(notFoundUrl, {
        status: 404,
        request: { headers: requestHeaders },
      }),
    );
  }

  if (!isSupabaseConfigured()) {
    return withSecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  let authenticated = false;

  // Public catalogue pages do not need an identity to render. Verifying every
  // anonymous page view against Supabase put an avoidable network round trip in
  // front of the HTML. Only routes whose routing decision actually depends on
  // identity pay that cost. getClaims() verifies the JWT signature and refreshes
  // an expiring session without fetching the full user record from Auth.
  if (isProtected(pathname) || GUEST_ONLY_PATHS.includes(pathname)) {
    const supabase = createServerClient<Database>(
      supabaseEnv.url,
      supabaseEnv.publishableKey,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request: { headers: requestHeaders } });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );
    const { data } = await supabase.auth.getClaims();
    authenticated = Boolean(data?.claims?.sub);
  }

  if (!authenticated && isProtected(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("returnTo", `${pathname}${search}`);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  // The password-recovery flow signs the user in with a short-lived session
  // specifically so they can set a new password, so /reset-password must stay
  // reachable while authenticated.
  if (authenticated && GUEST_ONLY_PATHS.includes(pathname)) {
    const accountUrl = request.nextUrl.clone();
    accountUrl.pathname = "/account";
    accountUrl.search = "";
    return withSecurityHeaders(NextResponse.redirect(accountUrl));
  }

  if (!hasPrefix(pathname, MAINTENANCE_EXEMPT_PREFIXES) && (await isMaintenanceMode())) {
    // Rewritten rather than redirected: the shopper keeps the URL they asked
    // for, so a refresh after the shop reopens lands on the page they wanted.
    // 503 with Retry-After is what tells a crawler this is temporary and stops
    // it de-indexing the catalogue.
    const maintenanceUrl = request.nextUrl.clone();
    maintenanceUrl.pathname = "/maintenance";
    maintenanceUrl.search = "";
    const maintenanceHeaders = new Headers(requestHeaders);
    maintenanceHeaders.set("x-tara-pathname", "/maintenance");
    const maintenance = NextResponse.rewrite(maintenanceUrl, {
      status: 503,
      headers: { "Retry-After": "3600", "Cache-Control": "no-store" },
      request: { headers: maintenanceHeaders },
    });
    return withSecurityHeaders(maintenance);
  }

  return withSecurityHeaders(response);
}
