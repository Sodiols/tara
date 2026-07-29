import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/auth";
import { ChangePasswordClient } from "@/components/forms/ChangePasswordClient";

export const metadata: Metadata = {
  title: "Change Password",
  description: "Update the password for your TARA account.",
};

export default async function AccountSecurityPage() {
  await requireUser("/account/security");
  return <ChangePasswordClient />;
}
