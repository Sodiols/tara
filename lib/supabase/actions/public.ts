"use server";

import { contactSchema, newsletterSchema } from "@/lib/validation";
import { createClient } from "../server";
import { isSupabaseConfigured } from "../env";
import { guardPublicAction } from "@/lib/rate-limit";
import type { ActionResult } from "./auth";

/**
 * Public, unauthenticated forms.
 *
 * Both are reachable by anyone, so both are throttled twice: once here per
 * request fingerprint (cheap, rejects floods before a database round trip) and
 * again inside the SECURITY DEFINER function per email address (durable, and
 * the one that actually counts on a serverless deployment where this process
 * may be cold).
 *
 * Validation is never left to the browser: the Zod schema runs here and the
 * database re-checks length, shape and duplication independently.
 */

function publicError(message: string): ActionResult {
  if (message.includes("rate_limited")) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
  }
  if (message.includes("duplicate_message")) {
    return { ok: false, message: "We have already received that message. We will reply soon." };
  }
  return { ok: false, message: "Your message could not be sent. Please try again." };
}

export async function subscribeNewsletterAction(input: unknown): Promise<ActionResult> {
  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please enter a valid email address" };
  if (!isSupabaseConfigured()) return { ok: false, message: "Supabase has not been configured yet." };

  const { fingerprint, result } = await guardPublicAction("newsletter", 5, 600);
  if (!result.allowed) return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("subscribe_newsletter", {
    p_email: parsed.data.email,
    p_language: "en",
    p_client_fingerprint: fingerprint,
  });

  if (error) {
    console.error("[public] newsletter subscribe failed:", error.message);
    if (error.message.includes("rate_limited")) {
      return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
    }
    return { ok: false, message: "Subscription could not be saved. Please try again." };
  }
  return { ok: true, message: "Thank you for subscribing to TARA." };
}

export async function submitContactAction(input: unknown): Promise<ActionResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Your message could not be sent. Please try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  if (!isSupabaseConfigured()) return { ok: false, message: "Supabase has not been configured yet." };

  const { fingerprint, result } = await guardPublicAction("contact", 4, 900);
  if (!result.allowed) return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_contact_message", {
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone || "",
    p_message: parsed.data.message,
    p_subject: null,
    p_client_fingerprint: fingerprint,
  });

  if (error) {
    console.error("[public] contact submit failed:", error.message);
    return publicError(error.message);
  }
  return { ok: true, message: "Your message has been sent. We'll get back to you soon." };
}
