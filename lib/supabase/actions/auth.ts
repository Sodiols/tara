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
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) return authError(error.message);
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
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) return { ok: false, message: "Your current password is incorrect." };

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

export async function googleLoginAction(returnTo?: string) {
  if (!supabaseEnv.googleAuthEnabled) redirect("/login");
  if (!isSupabaseConfigured()) redirect("/login?error=not-configured");
  const supabase = await createClient();
  const { data } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${supabaseEnv.siteUrl}/auth/callback?next=${encodeURIComponent(safeReturnPath(returnTo))}`,
    },
  });
  if (data.url) redirect(data.url);
  redirect("/login?error=oauth");
}
