/**
 * The site's origin — one resolver, one production guard, for everything that
 * needs a URL.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * There used to be two resolvers, and they disagreed.
 *
 *   lib/supabase/env.ts   refused a localhost value in a production build and
 *                         fell back to the real domain, so auth emails were safe;
 *   data/site.ts          took NEXT_PUBLIC_SITE_URL verbatim.
 *
 * `siteConfig.url` from the second is what canonical URLs, Open Graph, JSON-LD,
 * robots.txt and the sitemap are built from. So a production build made with
 * `NEXT_PUBLIC_SITE_URL=http://localhost:3000` — the value a developer's
 * .env.local holds, and the value a CI job inherits if it builds from a copy of
 * one — shipped
 *
 *     robots.txt   Host: http://localhost:3000
 *     sitemap.xml  <loc>http://localhost:3000/two-piece</loc>
 *
 * while every password-reset link in the same build correctly said
 * www.tarabd.co. That was observed in a real `next build`, not reasoned about.
 * A sitemap pointing a crawler at localhost is not a warning; it is the whole
 * catalogue asking not to be found.
 *
 * THE RULE
 * --------
 *   * A configured, parseable, non-local origin always wins, in any build.
 *   * In a production build, a missing, malformed or local value falls back to
 *     the real domain and logs once, server-side, so the misconfiguration is
 *     loud without the site being broken by it. This is the same for both
 *     answers below; it is the part that was missing.
 *   * Outside production, a configured local value is honoured.
 *
 * ONE RULE, TWO DEFAULTS — AND WHY THEY DIFFER
 * --------------------------------------------
 * When the variable is simply unset outside production, the two consumers have
 * always wanted different things, and that difference is kept deliberately:
 *
 *   SITE_ORIGIN          public identity: canonicals, OG, JSON-LD, the sitemap.
 *                        Unset -> the real domain. A development page whose
 *                        canonical names www.tarabd.co harms nothing, and it
 *                        keeps unit tests and previews describing the real site.
 *
 *   AUTH_REDIRECT_ORIGIN where Supabase sends a person after an email link or
 *                        Google sign-in. Unset -> the dev server, because a
 *                        developer who has not set the variable is signing in
 *                        on their own machine and must come back to it.
 *
 * Only that one case differs. In production both are identical, always.
 *
 * Deliberately free of "server-only": the product page's share link reads this
 * in the browser. `NODE_ENV` and `NEXT_PUBLIC_SITE_URL` are both inlined at
 * build time, so the client and the server bundles resolve the same answer.
 */

export const PRODUCTION_ORIGIN = "https://www.tarabd.co";

/** Hosts that only ever mean "this machine". */
function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local")
  );
}

/**
 * Normalises a configured value to a bare origin, or null when it cannot be one.
 *
 * `tarabd.co` without a scheme, a value with a path, or a typo that is not a URL
 * at all are all treated as absent rather than concatenated into every canonical.
 */
export function parseOrigin(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export interface SiteUrlInputs {
  configured: string | undefined;
  nodeEnv: string | undefined;
  /**
   * What an UNSET variable means outside production. Never consulted in a
   * production build, and never overrides a configured value.
   */
  unsetOutsideProduction?: "production-origin" | "dev-server";
}

export type SiteUrlResolution = {
  origin: string;
  /** Set when a production build had to override what it was given. */
  problem: string | null;
};

/** Pure: no logging, no environment reads. What the tests exercise. */
export function resolveSiteOrigin({
  configured,
  nodeEnv,
  unsetOutsideProduction = "production-origin",
}: SiteUrlInputs): SiteUrlResolution {
  const origin = parseOrigin(configured);

  if (origin && !isLocalHost(new URL(origin).hostname)) {
    return { origin, problem: null };
  }

  if (nodeEnv === "production") {
    const described = configured?.trim()
      ? origin
        ? `"${configured.trim()}" (a local address)`
        : `"${configured.trim()}" (not a valid absolute URL)`
      : "not set";
    return {
      origin: PRODUCTION_ORIGIN,
      problem:
        `NEXT_PUBLIC_SITE_URL is ${described} in a production build. Canonical URLs, ` +
        `the sitemap, robots.txt, structured data and auth emails must not point there, ` +
        `so "${PRODUCTION_ORIGIN}" is being used instead. Set NEXT_PUBLIC_SITE_URL on the ` +
        `host and rebuild.`,
    };
  }

  if (origin) return { origin, problem: null };
  return {
    origin: unsetOutsideProduction === "dev-server" ? "http://localhost:3000" : PRODUCTION_ORIGIN,
    problem: null,
  };
}

const configured = process.env.NEXT_PUBLIC_SITE_URL;
const nodeEnv = process.env.NODE_ENV;

const site = resolveSiteOrigin({ configured, nodeEnv, unsetOutsideProduction: "production-origin" });
const auth = resolveSiteOrigin({ configured, nodeEnv, unsetOutsideProduction: "dev-server" });

// Once per server process, never in a customer's browser console. The two
// resolutions share their production guard, so one message covers both.
if (site.problem && typeof window === "undefined") {
  console.error(`[config] ${site.problem}`);
}

/** Public identity: canonicals, Open Graph, JSON-LD, robots.txt, the sitemap. */
export const SITE_ORIGIN = site.origin;

/** Where Supabase Auth returns people. Identical to SITE_ORIGIN in production. */
export const AUTH_REDIRECT_ORIGIN = auth.origin;
