"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "../server";
import { safeReturnPath } from "../auth";
import { isSupabaseConfigured, supabaseEnv } from "../env";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation";
import { guardPublicAction, consumeDurableLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * Throttles the credential-taking endpoints.
 *
 * Supabase Auth applies its own limits, but they are keyed on the address being
 * tried -- which does nothing against one client working through a list of
 * addresses. This is keyed on the client, durably, so credential stuffing is
 * bounded across every serverless instance rather than per process.
 *
 * Returns null when the request may proceed, or the message to show.
 */
async function throttleAuth(): Promise<string | null> {
  const { fingerprint, result } = await guardPublicAction("auth", 12, 600);
  if (!result.allowed || !(await consumeDurableLimit("auth", fingerprint))) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  return null;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function authError(message: string): ActionResult {
  const normalized = message.toLowerCase();
  if (normalized.includes("email not confirmed"))
    return { ok: false, message: "Confirm your email address before signing in." };
  if (normalized.includes("invalid login"))
    return { ok: false, message: "The email or password is incorrect." };
  if (normalized.includes("already registered"))
    return { ok: false, message: "An account already exists for this email." };
  if (normalized.includes("rate"))
    return { ok: false, message: "Too many attempts. Please wait before trying again." };
  if (
    normalized.includes("fetch") ||
    normalized.includes("network") ||
    normalized.includes("connection")
  )
    return { ok: false, message: "We could not reach the account service. Check your connection and try again." };
  return { ok: false, message: "Authentication could not be completed. Please try again." };
}

export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted information and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  if (!isSupabaseConfigured())
    return { ok: false, message: "Supabase has not been configured yet." };

  const throttled = await throttleAuth();
  if (throttled) return { ok: false, message: throttled };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      // The logger masks the address, so this records that a sign-in failed
      // and why without accumulating a list of who has an account here.
      logger.warn("auth.sign_in_failed", { email: parsed.data.email, reason: error.message });
      return authError(error.message);
    }
    if (!data.session || !data.user)
      return { ok: false, message: "Authentication could not be completed. Please try again." };
    return { ok: true, data: undefined };
  } catch (error) {
    return authError(error instanceof Error ? error.message : "unexpected");
  }
}

export async function registerAction(input: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted information and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  if (!isSupabaseConfigured())
    return { ok: false, message: "Supabase has not been configured yet." };

  const throttled = await throttleAuth();
  if (throttled) return { ok: false, message: throttled };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
          phone: parsed.data.phone,
        },
        emailRedirectTo: `${supabaseEnv.siteUrl}/auth/callback?next=/account`,
      },
    });
    if (error) return authError(error.message);
    return {
      ok: true,
      message: data.session
        ? "Account created successfully"
        : "Check your email and confirm your address before signing in.",
    };
  } catch (error) {
    return authError(error instanceof Error ? error.message : "unexpected");
  }
}

export async function forgotPasswordAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Enter a valid email address." };
  if (!isSupabaseConfigured())
    return { ok: false, message: "Supabase has not been configured yet." };

  // Throttled like sign-in: without it this is a free way to have Supabase mail
  // an arbitrary list of addresses on someone else's behalf.
  const throttled = await throttleAuth();
  if (throttled) return { ok: false, message: throttled };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: `${supabaseEnv.siteUrl}/auth/callback?next=/reset-password` },
    );
    if (error) {
      const normalized = error.message.toLowerCase();
      if (!normalized.includes("not found") && !normalized.includes("does not exist"))
        return authError(error.message);
    }
    return { ok: true, message: "If an account exists, a password reset link has been sent." };
  } catch (error) {
    return authError(error instanceof Error ? error.message : "unexpected");
  }
}

export async function resetPasswordAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted information and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  if (!isSupabaseConfigured())
    return { ok: false, message: "Supabase has not been configured yet." };
  const cookieStore = await cookies();
  if (cookieStore.get("tara-password-recovery")?.value !== "active")
    return { ok: false, message: "This recovery link is invalid or expired." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, message: "This recovery link is invalid or expired." };
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return authError(error.message);
  await supabase.auth.signOut();
  cookieStore.delete("tara-password-recovery");
  return { ok: true, message: "Your password has been updated." };
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted information and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  if (!isSupabaseConfigured())
    return { ok: false, message: "Supabase has not been configured yet." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return { ok: false, message: "Authentication could not be completed. Please try again." };

  // Re-verify the current password before allowing a change, so an
  // unattended logged-in session can't have its password swapped out from
  // under the account owner just because updateUser() only needs an
  // active session.
  const throttled = await throttleAuth();
  if (throttled) return { ok: false, message: throttled };

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) {
    logger.warn("auth.password_change_rejected", { email });
    return { ok: false, message: "Your current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return authError(error.message);
  return { ok: true, message: "Your password has been updated." };
}

export async function logoutAction() {
  if (!isSupabaseConfigured()) redirect("/");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Starts the Google OAuth handshake.
 *
 * Supabase returns the URL to send the browser to rather than redirecting
 * itself, so this hands that URL to `redirect()`. The customer comes back to
 * /auth/callback with a code, which is exchanged for a session there — the same
 * session an email sign-in produces, on the same account system. There is no
 * separate Google user.
 *
 * `returnTo` is passed through `safeReturnPath`, so a crafted link cannot use
 * the OAuth round trip to bounce someone to another origin afterwards.
 */
export async function googleLoginAction(returnTo?: string) {
  if (!supabaseEnv.googleAuthEnabled) redirect("/login");
  if (!isSupabaseConfigured()) redirect("/login?error=not-configured");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${supabaseEnv.siteUrl}/auth/callback?next=${encodeURIComponent(safeReturnPath(returnTo))}`,
    },
  });

  if (data?.url) redirect(data.url);

  // The error was previously discarded, which made the single most likely
  // cause invisible: NEXT_PUBLIC_ENABLE_GOOGLE_AUTH is "true" but the Google
  // provider has not been enabled in the Supabase dashboard. Supabase says so
  // explicitly, and with nothing logged the only symptom was a generic message
  // on the login page and no way to tell why.
  logger.error("auth.google_oauth_unavailable", {
    reason: error?.message ?? "Supabase returned no authorization URL",
  });
  redirect("/login?error=oauth");
}
