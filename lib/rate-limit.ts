import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
import { logger } from "./logger";

/**
 * Rate limiting, in two layers.
 *
 *   1. `guardPublicAction()` — an in-process fixed window. Cheap, and rejects
 *      the obvious floods before they cost a database round trip. On a
 *      serverless deployment each instance keeps its own counter, so this is
 *      deliberately NOT the authority: a cold start begins with an empty map.
 *
 *   2. `consumeDurableLimit()` — one shared counter in Postgres, correct across
 *      every instance and every restart. This is the authority.
 *
 * Checkout, the contact form and the newsletter signup have always consumed a
 * durable limit inside their SECURITY DEFINER functions. Coupon attempts, order
 * tracking and the catalogue API had layer 1 only, which on a multi-instance
 * deployment is closer to advisory than enforced — they now use both.
 */

type Window = { count: number; expiresAt: number };

const windows = new Map<string, Window>();
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.expiresAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  if (windows.size > MAX_TRACKED_KEYS) sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.expiresAt <= now) {
    windows.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.expiresAt - now) / 1000),
  };
}

/**
 * A stable, non-reversible identifier for the calling client.
 *
 * The raw IP is never stored or logged: it is salted with the deploy's site URL
 * and hashed, so the value is useful for throttling and duplicate detection but
 * is not personal data sitting in the orders table.
 *
 * Forwarded headers are attacker-controlled, which is exactly why this is only
 * ever a *secondary* signal — the phone number carries the primary COD limit.
 */
export async function getClientFingerprint(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for") ?? "";
  const ip =
    forwardedFor.split(",")[0]?.trim() ||
    headerList.get("x-real-ip")?.trim() ||
    headerList.get("cf-connecting-ip")?.trim() ||
    "unknown";
  const agent = headerList.get("user-agent")?.slice(0, 120) ?? "";
  const salt = process.env.NEXT_PUBLIC_SITE_URL ?? "tara";
  return createHash("sha256").update(`${salt}|${ip}|${agent}`).digest("hex").slice(0, 40);
}

/** Convenience wrapper: fingerprint + in-process check in one call. */
export async function guardPublicAction(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<{ fingerprint: string; result: RateLimitResult }> {
  const fingerprint = await getClientFingerprint();
  return {
    fingerprint,
    result: checkRateLimit(`${bucket}:${fingerprint}`, limit, windowSeconds),
  };
}

/**
 * The durable half: one shared counter in Postgres, across every instance.
 *
 * The in-process window above is a cheap first filter, and on a serverless
 * deployment it is little more than that — each cold start begins with an empty
 * map, and ten concurrent instances mean ten independent allowances. Checkout,
 * the contact form and the newsletter signup already consumed a database-backed
 * limit inside their SECURITY DEFINER functions; this exposes the same
 * mechanism to the endpoints that had no server-side authority at all: coupon
 * attempts, order tracking and the catalogue API.
 *
 * The allowance is NOT a parameter. `consume_public_rate_limit()` looks the
 * numbers up from a fixed list keyed on the bucket name, because a limit a
 * caller can choose is a limit an attacker can choose.
 *
 * Fails open. If the database cannot be reached, the request proceeds — the
 * in-process window still applies, and refusing every request because the
 * limiter is unavailable would turn a database blip into an outage.
 */
export async function consumeDurableLimit(
  bucket: string,
  identifier: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("consume_public_rate_limit", {
      p_bucket: bucket,
      p_identifier: identifier,
    });
    if (error) throw error;
    return data !== false;
  } catch (error) {
    logger.warn("rate_limit.durable_unavailable", {
      bucket,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}
