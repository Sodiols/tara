import "server-only";

/**
 * Order event record.
 *
 * Every order lifecycle event is written to
 * `public.notification_outbox` by the same database transaction that caused it
 * (`place_order()` and `admin_transition_order()` both do this). Resend delivery
 * happens only after that transaction commits. The admin panel reads the table
 * at /admin/settings, including delivery status, attempts, and safe errors.
 *
 * Two properties this gives us:
 *
 *   1. Recording an event can never fail the operation that caused it — the
 *      write is part of the same transaction, so either the order and its
 *      record both exist, or neither does.
 *   2. Nothing is reported as "sent" until the provider accepts it. A failed
 *      send stays visible and can be retried against the same outbox row.
 */

/** Human-readable description of each event, for the admin panel. */
export const NOTIFICATION_EVENT_LABELS: Record<string, string> = {
  order_placed: "Order received",
  order_confirmed: "Order confirmed",
  order_processing: "Order being prepared",
  order_packed: "Order packed",
  order_shipped: "Order out for delivery",
  order_delivered: "Order delivered",
  order_cancelled: "Order cancelled",
  order_returned: "Return recorded",
  admin_new_order: "New order for the store",
  admin_contact_message: "New contact message for the store",
};

export function describeNotification(template: string): string {
  return NOTIFICATION_EVENT_LABELS[template] ?? template;
}
