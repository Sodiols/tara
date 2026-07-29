"use server";

import { contactSchema, newsletterSchema } from "@/lib/validation";
import { createClient } from "../server";
import { isSupabaseConfigured } from "../env";
import type { ActionResult } from "./auth";

export async function subscribeNewsletterAction(input: unknown): Promise<ActionResult> {
  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "newsletter.invalidEmail" };
  if (!isSupabaseConfigured())
    return { ok: false, message: "auth.errors.notConfigured" };
  const supabase = await createClient();
  const source = input as { language?: string };
  const { error } = await supabase.rpc("subscribe_newsletter", {
    p_email: parsed.data.email,
    p_language: source.language === "bn" ? "bn" : "en",
  });
  if (error) {
    console.error("Newsletter subscription failed:", error.message);
    return { ok: false, message: "newsletter.error" };
  }
  return { ok: true, message: "newsletter.success" };
}

export async function submitContactAction(input: unknown): Promise<ActionResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "contact.error", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  if (!isSupabaseConfigured())
    return { ok: false, message: "auth.errors.notConfigured" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_contact_message", {
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone ?? "",
    p_message: parsed.data.message,
  });
  if (error) {
    console.error("Contact submission failed:", error.message);
    return { ok: false, message: "contact.error" };
  }
  return { ok: true, message: "contact.success" };
}
