import type { Metadata } from "next";
import { AccountClient } from "@/components/forms/AccountClient";
import { getProfile } from "@/lib/supabase/queries/account";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your TARA account, profile details, and addresses.",
};

export default async function AccountPage() {
  const profile = await getProfile();
  if (!profile) return null;
  return <AccountClient profile={profile} />;
}
