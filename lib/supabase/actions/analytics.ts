"use server";

import { z } from "zod";
import { createClient } from "../server";
import { isSupabaseConfigured } from "../env";
import { consumeDurableLimit, guardPublicAction } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * Recording a conversion.
 *
 * WHY THIS IS NOT AN ORDINARY EVENT
 * ---------------------------------
 * Every other event is something a browser observed. A purchase is a claim
 * about money, and a browser is not allowed to make one. So this action sends
 * no total, no product list and no customer: it presents the order number and
 * that order's tracking token — the same 192-bit pair the guest tracking page
 * requires — and `track_analytics_purchase()` looks the order up and records
 * its id. The revenue on the dashboard is read from the order itself, every
 * time a report runs.
 *
 * WHY IT CANNOT BE COUNTED TWICE
 * ------------------------------
 * A unique index on `(order_id) where event_name = 'purchase'`. That is the
 * whole guarantee, and it holds for every way the same order can be reported
 * again:
 *
 *   * the confirmation screen re-rendering;
 *   * a refresh, or the back button and then forward;
 *   * the same page reopened on another device from a shared link;
 *   * a retry after a request that timed out but had in fact been applied.
 *
 * The screen guards a second call with the order number as well, so the
 * third-party tags do not report a second sale either — but the database is
 * what makes it true rather than likely.
 */

const inputSchema = z.object({
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid(),
  orderNumber: z.string().trim().min(3).max(40),
  trackingToken: z.string().trim().min(32).max(100),
});

export async function recordPurchaseAction(input: unknown): Promise<{ ok: boolean }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  if (!isSupabaseConfigured()) return { ok: false };

  // Shares the analytics allowance: this is a measurement, and it must not eat
  // into the order-tracking budget a customer needs for their own order.
  const { fingerprint, result } = await guardPublicAction("analytics", 120, 60);
  if (!result.allowed || !(await consumeDurableLimit("analytics", fingerprint))) {
    return { ok: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("track_analytics_purchase", {
    p_visitor: parsed.data.visitorId,
    p_session: parsed.data.sessionId,
    p_order_number: parsed.data.orderNumber,
    p_tracking_token: parsed.data.trackingToken,
  });

  if (error) {
    // The order exists either way — it was placed in its own transaction long
    // before this ran. A conversion that could not be recorded is a hole in a
    // report, not a problem for the customer, so nothing is surfaced.
    logger.warn("analytics.purchase_not_recorded", {
      message: error.message.slice(0, 200),
    });
    return { ok: false };
  }

  return { ok: data === true };
}
