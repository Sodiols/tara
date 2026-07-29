import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginClient } from "@/components/forms/LoginClient";
import { getUser, safeReturnPath } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Account",
  description: "Sign in or create your TARA account to manage orders and saved favourites.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; error?: string; mode?: string; passwordUpdated?: string }> }) {
  const user = await getUser();
  if (user) redirect("/account");
  const params = await searchParams;
  return (
    <LoginClient
      returnTo={safeReturnPath(params.returnTo)}
      errorCode={params.error}
      initialMode={params.mode === "register" ? "register" : "login"}
      passwordUpdated={params.passwordUpdated === "true"}
    />
  );
}
