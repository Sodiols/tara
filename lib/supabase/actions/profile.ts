"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth";
import { createClient } from "../server";
import { isSupabaseConfigured } from "../env";
import { addressSchema, profileSchema } from "@/lib/validation";
import type { ActionResult } from "./auth";

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "account.errors.invalidProfile", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  if (!isSupabaseConfigured()) return { ok: false, message: "auth.errors.notConfigured" };
  const user = await requireUser("/account/profile");
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      preferred_language: parsed.data.preferredLanguage,
    })
    .eq("id", user.id);
  if (error) {
    console.error("Profile update failed:", error.message);
    return { ok: false, message: "account.errors.saveFailed" };
  }
  revalidatePath("/account");
  revalidatePath("/account/profile");
  return { ok: true, message: "account.profileSaved" };
}

export async function saveAddressAction(input: unknown): Promise<ActionResult> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "account.errors.invalidAddress", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  if (!isSupabaseConfigured()) return { ok: false, message: "auth.errors.notConfigured" };
  const user = await requireUser("/account/addresses");
  const supabase = await createClient();
  const payload = {
    user_id: user.id,
    recipient_name: parsed.data.recipientName,
    phone: parsed.data.phone,
    division: parsed.data.division,
    district: parsed.data.district,
    upazila: parsed.data.upazila,
    area: parsed.data.area,
    postal_code: parsed.data.postalCode || null,
    full_address: parsed.data.fullAddress,
    delivery_note: parsed.data.deliveryNote || null,
    is_default: parsed.data.isDefault,
  };
  const query = parsed.data.id
    ? supabase.from("addresses").update(payload).eq("id", parsed.data.id).eq("user_id", user.id)
    : supabase.from("addresses").insert(payload);
  const { error } = await query;
  if (error) {
    console.error("Address save failed:", error.message);
    return { ok: false, message: "account.errors.saveFailed" };
  }
  revalidatePath("/account/addresses");
  return { ok: true, message: "account.addressSaved" };
}

export async function deleteAddressAction(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, message: "auth.errors.notConfigured" };
  const user = await requireUser("/account/addresses");
  const supabase = await createClient();
  const { error } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "account.errors.deleteFailed" };
  revalidatePath("/account/addresses");
  return { ok: true };
}
