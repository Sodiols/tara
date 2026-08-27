"use server";

import { after } from "next/server";
import { contactSchema, newsletterSchema } from "@/lib/validation";
import { createClient } from "../server";
import { isSupabaseConfigured } from "../env";
import { guardPublicAction, consumeDurableLimit } from "@/lib/rate-limit";
import { logFailure } from "@/lib/logger";
import type { ActionResult } from "./auth";
import { dispatchContactNotification } from "@/lib/email/dispatch";

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
  if (!result.allowed || !(await consumeDurableLimit("newsletter", fingerprint))) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("subscribe_newsletter", {
    p_email: parsed.data.email,
    p_language: "en",
    p_client_fingerprint: fingerprint,
  });

  if (error) {
    logFailure("newsletter.subscribe_failed", error);
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
  if (!result.allowed || !(await consumeDurableLimit("contact", fingerprint))) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_contact_message", {
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone || "",
    p_message: parsed.data.message,
    p_subject: null,
    p_client_fingerprint: fingerprint,
  });

  if (error) {
    logFailure("contact.submit_failed", error);
    return publicError(error.message);
  }
  if (typeof data === "string") {
    after(async () => {
      await dispatchContactNotification(data, parsed.data.email);
    });
  }
  return { ok: true, message: "Your message has been sent. We'll get back to you soon." };
}

/**
 * Token-based newsletter unsubscribe.
 *
 * The whole point is that the caller proves possession of the token rather than
 * merely knowing an email address. `unsubscribe_newsletter_by_token()` checks
 * the shape before it queries, consumes a durable rate limit keyed on the token
 * itself, and returns a plain boolean — so this endpoint reveals nothing about
 * who is on the list.
 *
 * A wrong token gets an honest "that link did not work". That leaks nothing:
 * the token identifies exactly one subscriber, so confirming that a token is
 * unknown tells an attacker only what they already knew about a value they made
 * up. (The old email-based function could not be honest for exactly the
 * opposite reason.)
 */
export async function unsubscribeNewsletterAction(token: string): Promise<ActionResult> {
  const trimmed = token.trim();
  if (!/^[0-9a-f]{48}$/.test(trimmed)) {
    return {
      ok: false,
      message:
        "This unsubscribe link is not valid. Use the link from the bottom of a recent TARA email, or contact us and we will remove you.",
    };
  }
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "We could not process that right now. Please try again shortly." };
  }

  const { fingerprint, result } = await guardPublicAction("unsubscribe", 10, 3600);
  if (!result.allowed || !(await consumeDurableLimit("unsubscribe", fingerprint))) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unsubscribe_newsletter_by_token", {
    p_token: trimmed,
  });

  if (error) {
    logFailure("newsletter.unsubscribe_failed", error);
    return { ok: false, message: "We could not process that right now. Please try again shortly." };
  }

  if (data !== true) {
    return {
      ok: false,
      message:
        "This unsubscribe link has already been used, or it is no longer valid. If you are still receiving mail, contact us and we will remove you.",
    };
  }

  return {
    ok: true,
    message: "You will not receive any more marketing email from TARA. Your account and order history are unaffected.",
  };
}
