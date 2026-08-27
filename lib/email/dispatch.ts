import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { logger, logFailure } from "@/lib/logger";
import { parseOrderReceiptSnapshot } from "@/lib/order-receipt";
import { generateOrderReceiptPdf } from "@/lib/pdf/order-receipt";
import { getStoreIdentity } from "@/lib/supabase/queries/settings";
import { getEmailProvider, isEmailConfigured } from "./provider";
import { buildContactNotificationEmail, buildOrderNotificationEmail, type ContactNotificationSnapshot } from "./templates";

interface ClaimedNotification {
  id: string;
  template: string;
  recipient: string;
  dispatchToken: string;
}

function toClaimed(raw: unknown): ClaimedNotification[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.dispatchToken !== "string") return [];
    return [{ id: row.id, template: typeof row.template === "string" ? row.template : "", recipient: typeof row.recipient === "string" ? row.recipient : "", dispatchToken: row.dispatchToken }];
  });
}

function parseContact(value: unknown): ContactNotificationSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.email !== "string" || typeof row.message !== "string") return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: typeof row.phone === "string" ? row.phone : "",
    subject: typeof row.subject === "string" ? row.subject : "",
    message: row.message,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
  };
}

async function confirm(supabase: Awaited<ReturnType<typeof createClient>>, notification: ClaimedNotification, status: "sent" | "failed" | "skipped", error?: string, providerId?: string) {
  const result = await supabase.rpc("confirm_notification_dispatch_v2", {
    p_id: notification.id,
    p_dispatch_token: notification.dispatchToken,
    p_status: status,
    p_error: error ?? null,
    p_provider_message_id: providerId ?? null,
  });
  if (result.error) logFailure("email.confirm_failed", result.error, { notificationId: notification.id, status });
}

async function deliver(supabase: Awaited<ReturnType<typeof createClient>>, claimed: ClaimedNotification[]) {
  const provider = getEmailProvider();
  const store = await getStoreIdentity();

  for (const notification of claimed) {
    try {
      let recipient = notification.recipient;
      if (recipient === "store") {
        const { data, error } = await supabase.rpc("store_notification_recipient", { p_id: notification.id, p_dispatch_token: notification.dispatchToken });
        if (error) throw error;
        recipient = typeof data === "string" ? data.trim() : "";
      }
      if (!recipient) {
        await confirm(supabase, notification, "skipped", "No recipient configured");
        continue;
      }

      let message;
      if (notification.template === "admin_contact_message") {
        const { data, error } = await supabase.rpc("notification_contact_snapshot", { p_id: notification.id, p_dispatch_token: notification.dispatchToken });
        if (error) throw error;
        const contact = parseContact(data);
        if (!contact) throw new Error("Contact notification snapshot is unavailable");
        message = buildContactNotificationEmail(recipient, contact, store);
      } else {
        const { data, error } = await supabase.rpc("notification_order_snapshot", { p_id: notification.id, p_dispatch_token: notification.dispatchToken });
        if (error) throw error;
        const snapshot = parseOrderReceiptSnapshot(data);
        if (!snapshot) throw new Error("Order notification snapshot is unavailable");
        message = buildOrderNotificationEmail(notification.template, recipient, snapshot, store);
        if (message && notification.template === "order_placed" && notification.recipient !== "store") {
          const receipt = await generateOrderReceiptPdf(snapshot, store);
          message.attachments = [{ filename: `TARA-Order-${snapshot.order.orderNumber}.pdf`, content: receipt, contentType: "application/pdf" }];
        }
      }

      if (!message) {
        await confirm(supabase, notification, "skipped", "No email is configured for this event");
        continue;
      }
      message.idempotencyKey = `tara-notification-${notification.id}`;
      const outcome = await provider.send(message);
      await confirm(supabase, notification, outcome.status, outcome.status === "sent" ? undefined : outcome.reason, outcome.status === "sent" ? outcome.providerId : undefined);
      logger.info("email.dispatched", { notificationId: notification.id, template: notification.template, outcome: outcome.status });
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 300) : "Notification delivery failed";
      await confirm(supabase, notification, "failed", reason);
      logFailure("email.notification_failed", error, { notificationId: notification.id, template: notification.template });
    }
  }
}

export async function dispatchOrderNotifications(orderNumber: string, trackingToken: string, _storeName?: string): Promise<void> {
  if (!isSupabaseConfigured() || !isEmailConfigured()) return;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("claim_order_notifications", { p_order_number: orderNumber, p_tracking_token: trackingToken });
    if (error) throw error;
    await deliver(supabase, toClaimed(data));
  } catch (error) { logFailure("email.dispatch_failed", error, { orderNumber }); }
}

export async function dispatchOrderNotificationsAsStaff(orderId: string, _storeName?: string): Promise<void> {
  if (!isSupabaseConfigured() || !isEmailConfigured()) return;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("claim_order_notifications_admin", { p_order_id: orderId });
    if (error) throw error;
    await deliver(supabase, toClaimed(data));
  } catch (error) { logFailure("email.dispatch_failed", error, { orderId }); }
}

export async function dispatchContactNotification(messageId: string, customerEmail: string): Promise<void> {
  if (!isSupabaseConfigured() || !isEmailConfigured()) return;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("claim_contact_notification", { p_message_id: messageId, p_customer_email: customerEmail });
    if (error) throw error;
    await deliver(supabase, toClaimed(data));
  } catch (error) { logFailure("email.contact_dispatch_failed", error, { messageId }); }
}

export async function dispatchNotificationAsAdmin(notificationId: string): Promise<void> {
  if (!isSupabaseConfigured() || !isEmailConfigured()) return;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("claim_notification_admin", { p_id: notificationId });
    if (error) throw error;
    await deliver(supabase, toClaimed(data));
  } catch (error) { logFailure("email.admin_retry_failed", error, { notificationId }); }
}
