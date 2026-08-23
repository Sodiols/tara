import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * First line of defence in front of the public server actions.
 *
 * This is an in-process fixed window. On a serverless deployment each instance
 * keeps its own counter, so it is deliberately *not* the authority — the
 * durable limits live in Postgres (`public.consume_rate_limit`, called from
 * inside `place_order`, `submit_contact_message` and `subscribe_newsletter`).
 * What this buys us is cheap rejection of the obvious floods before they cost
 * a database round trip.
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
