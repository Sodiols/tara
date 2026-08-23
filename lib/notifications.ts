import "server-only";

/**
 * Order event record.
 *
 * TARA sends no email. There is no provider, no API key, and nothing that
 * leaves the server — by design, so the store owner does not depend on a
 * third-party service to run the shop.
 *
 * Instead, every order lifecycle event is written to
 * `public.notification_outbox` by the same database transaction that caused it
 * (`place_order()` and `admin_transition_order()` both do this). The admin
 * panel reads that table at /admin/settings, so staff see, in one place and in
 * order: every order placed, every status change, and who it concerned.
 *
 * Two properties this gives us:
 *
 *   1. Recording an event can never fail the operation that caused it — the
 *      write is part of the same transaction, so either the order and its
 *      record both exist, or neither does.
 *   2. Nothing is ever reported as "sent" when it was not. There is no
 *      delivery step to misreport.
 *
 * The customer's own copy of this information is the order confirmation shown
 * at checkout and the /track-order page, which needs only the order number and
 * tracking token.
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
};

export function describeNotification(template: string): string {
  return NOTIFICATION_EVENT_LABELS[template] ?? template;
}
