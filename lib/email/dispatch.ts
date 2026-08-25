import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { logger, logFailure } from "@/lib/logger";
import { getEmailProvider, isEmailConfigured } from "./provider";
import { buildNotificationEmail, type NotificationPayload } from "./templates";

/**
 * Drains the notification outbox for one order.
 *
 * THE RULE THIS EXISTS TO ENFORCE
 * -------------------------------
 * An order that has been written must never fail because an email did not go
 * out. `place_order()` has already committed by the time this runs; the stock is
 * deducted, the coupon is spent, the customer has an order number. So every path
 * through this module swallows its own failure, records it on the outbox row,
 * and returns. The caller does not await a result it would act on.
 *
 * HOW IT IS AUTHORISED WITHOUT A SERVICE ROLE KEY
 * -----------------------------------------------
 * `notification_outbox` holds customer email addresses, so anon cannot read it —
 * correctly. Rather than introducing a service-role key (which bypasses row
 * level security entirely and this project deliberately does not use anywhere),
 * the database hands out work through `claim_order_notifications()`, which
 * requires the order's 192-bit tracking token as proof that the caller is the
 * request that just created the order. Each claimed row comes with a single-use
 * dispatch token that `confirm_notification_dispatch()` checks, so knowing a
 * row id is not enough to mark somebody else's notification as sent.
 *
 * Claiming also moves the row to 'sending', so a retry cannot send twice; a row
 * stuck in 'sending' because the process died becomes claimable again after five
 * minutes.
 */

interface ClaimedNotification {
  id: string;
  template: string;
  recipient: string;
  payload: NotificationPayload;
  dispatchToken: string;
}

function toClaimed(raw: unknown): ClaimedNotification[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.dispatchToken !== "string") return [];
    return [
      {
        id: row.id,
        template: typeof row.template === "string" ? row.template : "",
        recipient: typeof row.recipient === "string" ? row.recipient : "",
        payload: (row.payload ?? {}) as NotificationPayload,
        dispatchToken: row.dispatchToken,
      },
    ];
  });
}

async function deliver(
  supabase: Awaited<ReturnType<typeof createClient>>,
  claimed: ClaimedNotification[],
  storeName: string,
) {
  const provider = getEmailProvider();

  for (const notification of claimed) {
    let recipient = notification.recipient;

    // The store's own copy goes to the private order_notification_email
    // setting, which anon cannot read directly. The database returns it only to
    // a caller holding this row's dispatch token.
    if (recipient === "store") {
      const { data } = await supabase.rpc("store_notification_recipient", {
        p_id: notification.id,
        p_dispatch_token: notification.dispatchToken,
      });
      recipient = typeof data === "string" ? data : "";
    }

    if (!recipient) {
      await supabase.rpc("confirm_notification_dispatch", {
        p_id: notification.id,
        p_dispatch_token: notification.dispatchToken,
        p_ok: false,
        p_error: "No recipient configured",
      });
      continue;
    }

    const message = buildNotificationEmail(
      notification.template,
      recipient,
      notification.payload,
      storeName,
    );

    if (!message) {
      // A status with no customer-facing email. Recorded as handled rather than
      // left queued forever.
      await supabase.rpc("confirm_notification_dispatch", {
        p_id: notification.id,
        p_dispatch_token: notification.dispatchToken,
        p_ok: true,
        p_error: null,
      });
      continue;
    }

    const outcome = await provider.send(message);

    await supabase.rpc("confirm_notification_dispatch", {
      p_id: notification.id,
      p_dispatch_token: notification.dispatchToken,
      p_ok: outcome.status === "sent",
      p_error: outcome.status === "sent" ? null : outcome.reason,
    });

    logger.info("email.dispatched", {
      template: notification.template,
      outcome: outcome.status,
      // Masked by the logger's redaction rules.
      recipient,
    });
  }
}

/**
 * Sends the notifications for an order the caller has just created.
 *
 * Fire-and-forget by design. Call it without awaiting from a checkout path, or
 * await it where a slightly slower response is acceptable — either way it
 * cannot throw.
 */
export async function dispatchOrderNotifications(
  orderNumber: string,
  trackingToken: string,
  storeName: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  // Nothing to do, but the outbox rows stay 'queued' so an administrator can
  // see exactly what would have been sent and retry once a provider is set up.
  if (!isEmailConfigured()) {
    logger.debug("email.not_configured", { orderNumber });
    return;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("claim_order_notifications", {
      p_order_number: orderNumber,
      p_tracking_token: trackingToken,
    });
    if (error) throw error;

    await deliver(supabase, toClaimed(data), storeName);
  } catch (error) {
    // The order exists and is correct. A failed notification is a problem for
    // the operator, not for the customer's order.
    logFailure("email.dispatch_failed", error, { orderNumber });
  }
}

/**
 * The same, for a staff member who has just moved an order's status. Authorised
 * by the caller's own `orders.view` permission rather than a tracking token.
 */
export async function dispatchOrderNotificationsAsStaff(
  orderId: string,
  storeName: string,
): Promise<void> {
  if (!isSupabaseConfigured() || !isEmailConfigured()) return;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("claim_order_notifications_admin", {
      p_order_id: orderId,
    });
    if (error) throw error;

    await deliver(supabase, toClaimed(data), storeName);
  } catch (error) {
    logFailure("email.dispatch_failed", error, { orderId });
  }
}
