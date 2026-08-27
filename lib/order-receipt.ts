import { formatOrderAddress } from "@/lib/order-address";

export interface ReceiptOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: unknown;
  status: string;
  paymentMethod: string;
  subtotal: number | string;
  deliveryFee: number | string;
  discountAmount: number | string;
  total: number | string;
  currency: string;
  trackingToken?: string;
}

export interface ReceiptItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  sku: string;
  size: string;
  colour: string;
  unitPrice: number | string;
  quantity: number;
  lineTotal: number | string;
}

export interface OrderReceiptSnapshot {
  order: ReceiptOrder;
  items: ReceiptItem[];
}

function string(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function money(value: unknown): number | string {
  return typeof value === "number" || typeof value === "string" ? value : 0;
}

/** Treat database JSON as untrusted at the boundary and reject incomplete snapshots. */
export function parseOrderReceiptSnapshot(value: unknown): OrderReceiptSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (!source.order || typeof source.order !== "object" || Array.isArray(source.order)) return null;
  const order = source.order as Record<string, unknown>;
  const orderNumber = string(order.orderNumber).trim();
  if (!orderNumber) return null;
  const rawItems = Array.isArray(source.items) ? source.items : [];

  return {
    order: {
      id: string(order.id),
      orderNumber,
      createdAt: string(order.createdAt),
      customerName: string(order.customerName),
      customerEmail: string(order.customerEmail),
      customerPhone: string(order.customerPhone),
      shippingAddress: order.shippingAddress,
      status: string(order.status),
      paymentMethod: string(order.paymentMethod),
      subtotal: money(order.subtotal),
      deliveryFee: money(order.deliveryFee),
      discountAmount: money(order.discountAmount),
      total: money(order.total),
      currency: string(order.currency) || "BDT",
      ...(string(order.trackingToken) ? { trackingToken: string(order.trackingToken) } : {}),
    },
    items: rawItems.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const item = entry as Record<string, unknown>;
      const quantity = Number(item.quantity);
      return [{
        id: string(item.id),
        productId: string(item.productId),
        productName: string(item.productName),
        productCode: string(item.productCode),
        sku: string(item.sku),
        size: string(item.size),
        colour: string(item.colour),
        unitPrice: money(item.unitPrice),
        quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
        lineTotal: money(item.lineTotal),
      }];
    }),
  };
}

export function receiptAddressLines(snapshot: OrderReceiptSnapshot): string[] {
  const address = formatOrderAddress(snapshot.order.shippingAddress);
  return [...address.lines, ...(address.zoneLabel ? [address.zoneLabel] : [])];
}
