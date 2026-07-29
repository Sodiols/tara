import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ResetPasswordClient } from "@/components/forms/ResetPasswordClient";
import { getUser } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Reset Password" };
export default async function ResetPasswordPage() {
  if (!isSupabaseConfigured())
    redirect("/login?error=not-configured");
  const cookieStore = await cookies();
  const recoveryActive =
    cookieStore.get("tara-password-recovery")?.value === "active";
  if (!recoveryActive || !(await getUser()))
    redirect("/login?error=recovery-expired");
  return <ResetPasswordClient />;
}
