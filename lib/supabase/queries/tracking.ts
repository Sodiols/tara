import "server-only";

import { createClient } from "../server";
import { isSupabaseConfigured } from "../env";
import { consumeDurableLimit, guardPublicAction } from "@/lib/rate-limit";
import { logFailure } from "@/lib/logger";
import { normaliseTrackingToken } from "@/lib/order-identifiers";
import { parsePublicOrderTracking, type PublicOrderTracking } from "@/lib/order-tracking";

export type TrackingLookup =
  | { state: "found"; order: PublicOrderTracking }
  /** Not a token, or no order has it. Deliberately one answer for both. */
  | { state: "not_found" }
  | { state: "rate_limited" }
  | { state: "unavailable" };

/**
 * The lookup behind /track/<token>.
 *
 * In order: the token's shape is checked (a malformed value never costs a
 * rate-limit slot or a query), the caller is throttled in process and then
 * durably, and only then is the database asked -- through a SECURITY DEFINER
 * function that matches the token exactly and returns an allowlist. The anon
 * key has no SELECT on orders; nothing here could read one directly.
 *
 * "Not found" and "not a token" are indistinguishable to the caller on
 * purpose: the page must not become an oracle for which shapes are real.
 */
export async function lookupOrderTracking(rawToken: string): Promise<TrackingLookup> {
  const token = normaliseTrackingToken(rawToken);
  if (!token) return { state: "not_found" };
  if (!isSupabaseConfigured()) return { state: "unavailable" };

  const { fingerprint, result } = await guardPublicAction("tracking", 20, 600);
  if (!result.allowed || !(await consumeDurableLimit("tracking", fingerprint))) {
    return { state: "rate_limited" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_order_tracking", { p_tracking_token: token });
  if (error) {
    // The token is a secret: it is never passed to the logger.
    logFailure("tracking.lookup_failed", error);
    return { state: "unavailable" };
  }

  const order = parsePublicOrderTracking(data);
  return order ? { state: "found", order } : { state: "not_found" };
}
