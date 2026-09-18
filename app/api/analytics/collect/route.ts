import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { consumeDurableLimit, guardPublicAction } from "@/lib/rate-limit";
import { MAX_EVENTS_PER_BATCH } from "@/lib/analytics/events";
import { logger } from "@/lib/logger";

/**
 * The one way analytics events get in.
 *
 * WHAT THIS ENDPOINT IS
 * ---------------------
 * An unauthenticated write, which is the thing this codebase is most careful
 * about, so it is bounded in four ways at once:
 *
 *   1. Zod, here, rejects anything that is not the expected shape before a
 *      database round trip happens.
 *   2. `guardPublicAction` is the cheap in-process window.
 *   3. `consumeDurableLimit` is the authority — one shared counter in Postgres,
 *      correct across every serverless instance (see lib/rate-limit.ts).
 *   4. `track_analytics_events()` re-validates everything, drops event names it
 *      does not know, truncates every string, bounds every number, and refuses
 *      a session that belongs to a different visitor. `anon` has no INSERT
 *      grant on any analytics table, so this function is the only door.
 *
 * It always answers 204, even for a payload it threw away. A tracking endpoint
 * that reports on what it accepted is an oracle, and a tracking endpoint whose
 * failures are visible to a customer is a bug in a shop.
 *
 * NO SERVICE-ROLE KEY. This runs with the publishable key and the caller's own
 * session, exactly like every other write in this repository.
 */

const identifier = z.string().uuid();

const eventSchema = z.object({
  // Mirrors the check constraint in migration 0026, minus `purchase`, which a
  // browser may never claim — see recordPurchaseAction().
  name: z.enum([
    "session_started",
    "page_view",
    "product_view",
    "product_image_interaction",
    "product_colour_selected",
    "product_size_selected",
    "add_to_cart",
    "remove_from_cart",
    "cart_view",
    "begin_checkout",
    "checkout_step",
    "search",
    "category_view",
  ]),
  path: z.string().max(300).optional(),
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  colour: z.string().max(60).optional(),
  size: z.string().max(60).optional(),
  quantity: z.number().int().min(1).max(100).optional(),
  value: z.number().min(0).max(99_999_999).optional(),
  meta: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

const batchSchema = z.object({
  visitorId: identifier,
  sessionId: identifier,
  attribution: z
    .object({
      utmSource: z.string().max(100).optional(),
      utmMedium: z.string().max(100).optional(),
      utmCampaign: z.string().max(120).optional(),
      utmContent: z.string().max(120).optional(),
      utmTerm: z.string().max(120).optional(),
      referrerHost: z.string().max(120).optional(),
      landingPath: z.string().max(300).optional(),
    })
    .default({}),
  events: z.array(eventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});

/** Nothing to say, in every case, so the shape of the answer reveals nothing. */
const accepted = () =>
  new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const { fingerprint, result } = await guardPublicAction("analytics", 120, 60);
  if (!result.allowed || !(await consumeDurableLimit("analytics", fingerprint))) {
    return new NextResponse(null, {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(result.retryAfterSeconds || 60),
      },
    });
  }

  if (!isSupabaseConfigured()) return accepted();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return accepted();
  }

  const parsed = batchSchema.safeParse(payload);
  if (!parsed.success) {
    logger.debug("analytics.rejected_payload", {
      issues: parsed.error.issues.slice(0, 3).map((issue) => issue.path.join(".")),
    });
    return accepted();
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("track_analytics_events", {
    // The client's session is attached, so a signed-in customer's own id is
    // recorded by the function through auth.uid(). It is never sent from here.
    p_payload: parsed.data,
  });

  if (error) {
    // Logged, never returned. A measurement that could not be stored is not a
    // problem the person browsing needs to know about.
    logger.warn("analytics.store_failed", { message: error.message.slice(0, 200) });
  }

  return accepted();
}
