import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/supabase/auth";
import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase/env";

function redirectOrigin(request: NextRequest) {
  const requestOrigin = request.nextUrl.origin;
  if (
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1"
  ) {
    return requestOrigin;
  }
  try {
    return new URL(supabaseEnv.siteUrl).origin;
  } catch {
    return requestOrigin;
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeReturnPath(request.nextUrl.searchParams.get("next"));
  const origin = redirectOrigin(request);
  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=missing-callback-code`,
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=not-configured`);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=invalid-callback`);
  }
  const response = NextResponse.redirect(`${origin}${next}`);
  if (next === "/reset-password") {
    response.cookies.set("tara-password-recovery", "active", {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 15 * 60,
      path: "/",
    });
  }
  return response;
}
