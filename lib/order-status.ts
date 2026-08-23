import type {
  OrderStatus,
  PaymentStatus,
  ReviewStatus,
  MessageStatus,
} from "@/types/database";
import type { Permission } from "./permissions";

/**
 * Order state machine — mirrors `public.order_status_transitions` seeded in
 * supabase/migrations/0002_production_hardening.sql.
 *
 * The database is the authority: `admin_transition_order()` rejects anything
 * not in that table and re-checks the required permission. This copy exists so
 * the admin UI can offer only the moves that will actually succeed.
 *
 * Deliberately an explicit adjacency list, not a numeric ranking — "delivered"
 * must never fall back to "pending" just because one integer is lower.
 */
export const ORDER_TRANSITIONS: Record<
  OrderStatus,
  { to: OrderStatus; permission: Permission }[]
> = {
  pending: [
    { to: "confirmed", permission: "orders.fulfil" },
    { to: "cancelled", permission: "orders.cancel" },
  ],
  confirmed: [
    { to: "processing", permission: "orders.fulfil" },
    { to: "cancelled", permission: "orders.cancel" },
  ],
  processing: [
    { to: "packed", permission: "orders.fulfil" },
    { to: "cancelled", permission: "orders.cancel" },
  ],
  packed: [
    { to: "shipped", permission: "orders.fulfil" },
    { to: "cancelled", permission: "orders.cancel" },
  ],
  shipped: [
    { to: "delivered", permission: "orders.fulfil" },
    { to: "returned", permission: "orders.cancel" },
  ],
  delivered: [{ to: "returned", permission: "orders.cancel" }],
  cancelled: [],
  returned: [],
};

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

/** The happy path, in order — used to render the fulfilment progress rail. */
export const FULFILMENT_PIPELINE: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
];

/**
 * Transitions available from a status.
 *
 * Uses `Object.hasOwn` rather than a bare index: statuses arrive from the
 * database, and a value outside the enum — or one that happens to name an
 * Object.prototype member such as "constructor" — would otherwise return
 * `undefined` or a function and throw on `.some()`. An unrecognised status
 * simply offers no moves.
 */
function transitionsFrom(from: OrderStatus) {
  return Object.hasOwn(ORDER_TRANSITIONS, from) ? ORDER_TRANSITIONS[from] : [];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return transitionsFrom(from).some((option) => option.to === to);
}

export function allowedTransitions(
  from: OrderStatus,
  permissions: readonly Permission[],
): OrderStatus[] {
  return transitionsFrom(from)
    .filter((option) => permissions.includes(option.permission))
    .map((option) => option.to);
}

/** The single most likely next step, for the one-click action in the UI. */
export function nextPipelineStatus(from: OrderStatus): OrderStatus | null {
  const index = FULFILMENT_PIPELINE.indexOf(from);
  if (index < 0 || index === FULFILMENT_PIPELINE.length - 1) return null;
  return FULFILMENT_PIPELINE[index + 1];
}

export function isTerminal(status: OrderStatus): boolean {
  return transitionsFrom(status).length === 0;
}

// --- Labels ---------------------------------------------------------------

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

/** Customer-facing wording for the public tracking timeline. */
export const CUSTOMER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Order received",
  confirmed: "Order confirmed",
  processing: "Preparing your order",
  packed: "Packed and ready",
  shipped: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  new: "New",
  read: "Read",
  replied: "Replied",
  resolved: "Resolved",
};

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
];

export const MESSAGE_STATUSES: MessageStatus[] = [
  "new",
  "read",
  "replied",
  "resolved",
];

export const INVENTORY_REASONS = [
  { value: "restock", label: "New stock received" },
  { value: "correction", label: "Stock count correction" },
  { value: "damaged", label: "Damaged / unsellable" },
  { value: "lost", label: "Lost or missing" },
  { value: "return_to_stock", label: "Return put back on sale" },
  { value: "transfer", label: "Transferred" },
  { value: "other", label: "Other" },
] as const;

/**
 * Turns the raw Postgres error text from a rejected transition into something
 * a staff member can act on. Raw database messages are never shown as-is.
 */
export function describeTransitionError(message: string): string {
  if (message.includes("permission_denied")) {
    return "Your role does not allow this action. Ask an administrator.";
  }
  if (message.includes("already_")) {
    return "This order is already in that state.";
  }
  if (message.includes("invalid_transition")) {
    return "That is not a valid next step for this order.";
  }
  if (message.includes("order_not_found")) {
    return "This order no longer exists.";
  }
  return "The order could not be updated. Please try again.";
}
