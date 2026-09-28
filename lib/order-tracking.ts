import type { OrderStatus } from "@/types/database";
import { ORDER_STATUSES } from "@/lib/order-status";
import { isOrderNumber, type OrderNumber } from "@/lib/order-identifiers";

/**
 * What the public tracking page is allowed to know about an order.
 *
 * `get_order_tracking()` already builds its response from an allowlist; this
 * parser is the second allowlist, on the application side. It copies the named
 * fields and nothing else, so a future change to the SQL that adds a column
 * cannot reach the page by accident -- someone has to add it here too, next to
 * this comment.
 *
 * Deliberately absent: the internal id, the customer id, the customer's name,
 * phone, email and address, admin notes, the fingerprint, the idempotency key,
 * risk flags and the tracking token itself (the page already has it; nothing
 * needs it echoed back).
 */
export interface PublicOrderTracking {
  orderNumber: OrderNumber;
  status: OrderStatus;
  placedAt: string;
  updatedAt: string | null;
  paymentMethod: string;
  deliveryZone: string | null;
  total: number;
  currency: string;
  items: PublicTrackingItem[];
  events: PublicTrackingEvent[];
}

export interface PublicTrackingItem {
  productName: string;
  size: string;
  colour: string;
  quantity: number;
  imageUrl: string | null;
}

export interface PublicTrackingEvent {
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function status(value: unknown): OrderStatus | null {
  return typeof value === "string" && (ORDER_STATUSES as string[]).includes(value)
    ? (value as OrderStatus)
    : null;
}

/** Only an https image is rendered; anything else is dropped rather than trusted. */
function imageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("https://")) return null;
  return value;
}

export function parsePublicOrderTracking(value: unknown): PublicOrderTracking | null {
  const source = record(value);
  if (!source) return null;

  const orderNumber = text(source.orderNumber);
  const currentStatus = status(source.status);
  const placedAt = text(source.placedAt);
  if (!isOrderNumber(orderNumber) || !currentStatus || !placedAt) return null;

  const total = Number(source.total);

  return {
    orderNumber,
    status: currentStatus,
    placedAt,
    updatedAt: optionalText(source.updatedAt),
    paymentMethod: text(source.paymentMethod),
    deliveryZone: optionalText(source.deliveryZone),
    total: Number.isFinite(total) ? total : 0,
    currency: text(source.currency) || "BDT",
    items: (Array.isArray(source.items) ? source.items : []).flatMap((entry) => {
      const item = record(entry);
      if (!item) return [];
      const quantity = Number(item.quantity);
      return [{
        productName: text(item.productName),
        size: text(item.size),
        colour: text(item.colour),
        quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
        imageUrl: imageUrl(item.imageUrl),
      }];
    }),
    events: (Array.isArray(source.events) ? source.events : []).flatMap((entry) => {
      const event = record(entry);
      const eventStatus = status(event?.status);
      const createdAt = text(event?.createdAt);
      if (!event || !eventStatus || !createdAt) return [];
      return [{ status: eventStatus, note: optionalText(event.note), createdAt }];
    }),
  };
}
