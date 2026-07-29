import "server-only";

import { getUser, requireUser } from "../auth";
import { createClient } from "../server";
import { isSupabaseConfigured } from "../env";

export async function getProfile() {
  const user = await requireUser("/account");
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (data) return data;

  const { error: repairError } = await supabase.rpc("ensure_my_profile");
  if (repairError) return null;
  const { data: repaired } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return repaired;
}

export async function getAddresses() {
  const user = await requireUser("/account/addresses");
  const supabase = await createClient();
  const { data } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}

// Best-effort, non-redirecting variant for checkout: guests must still be
// able to check out, so this returns null instead of forcing a login
// redirect the way getProfile()/getAddresses() do.
export async function getCheckoutPrefill() {
  if (!isSupabaseConfigured()) return null;
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const [{ data: profile }, { data: addresses }] = await Promise.all([
    supabase.from("profiles").select("full_name,phone").eq("id", user.id).maybeSingle(),
    supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  return {
    email: user.email ?? "",
    fullName: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    addresses: addresses ?? [],
  };
}
