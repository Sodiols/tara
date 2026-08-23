import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { isSupabaseConfigured, supabaseEnv } from "./env";

/**
 * Paths that require *some* signed-in user. This is a first gate only —
 * every page underneath still calls requireUser()/requireStaff() server-side,
 * and the database enforces row-level access independently. Its job is to
 * avoid rendering a protected shell for a signed-out visitor and to keep the
 * redirect fast.
 */
const PROTECTED_PREFIXES = ["/admin", "/account"];

/** Signed-in users have no reason to see these; send them onward instead. */
const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    supabaseEnv.url,
    supabaseEnv.publishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session cookie and gives us an authenticated identity that
  // was verified by Supabase, not merely decoded from the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isProtected(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("returnTo", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // The password-recovery flow signs the user in with a short-lived session
  // specifically so they can set a new password, so /reset-password must stay
  // reachable while authenticated.
  if (user && GUEST_ONLY_PATHS.includes(pathname)) {
    const accountUrl = request.nextUrl.clone();
    accountUrl.pathname = "/account";
    accountUrl.search = "";
    return NextResponse.redirect(accountUrl);
  }

  return response;
}
