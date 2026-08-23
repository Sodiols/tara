import type {
  MessageStatus,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  ReviewStatus,
} from "@/types/database";
import {
  MESSAGE_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
} from "@/lib/order-status";
import { Badge, type BadgeTone } from "./ui";

// Re-exported so a screen can import every status primitive from one module.
export { Badge };

/**
 * Safe lookup for a status coming out of the database.
 *
 * A bare `map[value]` returns an inherited Object.prototype member for values
 * such as "constructor", and `undefined` for an enum value added in SQL but not
 * yet mirrored here. Either would render as a broken badge or throw; this falls
 * back to a neutral tone and the raw value instead.
 */
function lookup<T extends string, V>(map: Record<T, V>, key: T, fallback: V): V {
  return Object.hasOwn(map, key) ? map[key] : fallback;
}

function labelFor<T extends string>(map: Record<T, string>, key: T): string {
  return Object.hasOwn(map, key) ? map[key] : String(key).replace(/_/g, " ");
}

/**
 * One semantic mapping for every status in the system, so the same state always
 * reads the same way in every table, tile and detail panel. Text always
 * accompanies the colour.
 */

const orderTones: Record<OrderStatus, BadgeTone> = {
  pending: "warning",
  confirmed: "info",
  processing: "progress",
  packed: "progress",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
  returned: "danger",
};

const paymentTones: Record<PaymentStatus, BadgeTone> = {
  unpaid: "warning",
  pending: "warning",
  paid: "success",
  failed: "danger",
  refunded: "neutral",
  partially_refunded: "neutral",
};

const reviewTones: Record<ReviewStatus, BadgeTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

const messageTones: Record<MessageStatus, BadgeTone> = {
  new: "warning",
  read: "info",
  replied: "progress",
  resolved: "success",
};

const productTones: Record<ProductStatus, BadgeTone> = {
  draft: "neutral",
  active: "success",
  archived: "danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={lookup(orderTones, status, "neutral")}>{labelFor(ORDER_STATUS_LABELS, status)}</Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge tone={lookup(paymentTones, status, "neutral")}>{labelFor(PAYMENT_STATUS_LABELS, status)}</Badge>
  );
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <Badge tone={lookup(reviewTones, status, "neutral")}>{labelFor(REVIEW_STATUS_LABELS, status)}</Badge>
  );
}

export function MessageStatusBadge({ status }: { status: MessageStatus }) {
  return (
    <Badge tone={lookup(messageTones, status, "neutral")}>{labelFor(MESSAGE_STATUS_LABELS, status)}</Badge>
  );
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <Badge tone={lookup(productTones, status, "neutral")}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function StockBadge({
  stock,
  threshold,
}: {
  stock: number;
  threshold: number;
}) {
  if (stock <= 0) return <Badge tone="danger">Out of stock</Badge>;
  if (stock <= threshold) return <Badge tone="warning">Low stock · {stock}</Badge>;
  return <Badge tone="success">In stock · {stock}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</Badge>;
}
