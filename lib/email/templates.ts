import "server-only";

import { formatTaka } from "@/lib/format";
import { siteConfig } from "@/data/site";
import type { EmailMessage } from "./provider";

/**
 * The transactional emails.
 *
 * Plain text, deliberately. These messages carry an order number, a total and a
 * link — nothing that needs layout — and plain text renders identically in
 * every client, never lands in a "images not shown" state, and is markedly less
 * likely to be filtered. If branded HTML is wanted later, add an `html` field
 * here; nothing else has to change.
 *
 * Everything interpolated comes from the notification payload the database
 * wrote, never from a request.
 */

export type NotificationTemplate =
  | "order_placed"
  | "order_confirmed"
  | "order_processing"
  | "order_packed"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "order_returned"
  | "admin_new_order";

export interface NotificationPayload {
  orderNumber?: string;
  total?: number | string;
  status?: string;
  customer?: string;
  phone?: string;
}

function trackingLine(orderNumber: string): string {
  return `Track your order: ${siteConfig.url}/track-order (order ${orderNumber})`;
}

const SIGN_OFF = `\n\nThank you for shopping with ${siteConfig.name}.\n${siteConfig.url}`;

/**
 * Builds the message for one outbox row, or null when that template has no
 * customer email (a status nobody needs telling about, for example).
 */
export function buildNotificationEmail(
  template: string,
  recipient: string,
  payload: NotificationPayload,
  storeName: string,
): EmailMessage | null {
  const orderNumber = payload.orderNumber ?? "";
  const total = payload.total == null ? "" : formatTaka(payload.total);

  switch (template) {
    case "order_placed":
      return {
        to: recipient,
        subject: `${storeName} — we have your order ${orderNumber}`,
        text:
          `Thank you for your order.\n\n` +
          `Order number: ${orderNumber}\n` +
          (total ? `Total: ${total}\n` : "") +
          `Payment: cash on delivery — nothing to pay now.\n\n` +
          `We will call you shortly to confirm, then deliver to your address. ` +
          `You pay the delivery agent in cash when it arrives.\n\n` +
          trackingLine(orderNumber) +
          SIGN_OFF,
      };

    case "order_confirmed":
      return {
        to: recipient,
        subject: `${storeName} — order ${orderNumber} confirmed`,
        text:
          `Your order is confirmed and is being prepared.\n\n` +
          `Order number: ${orderNumber}\n\n` +
          trackingLine(orderNumber) +
          SIGN_OFF,
      };

    case "order_shipped":
      return {
        to: recipient,
        subject: `${storeName} — order ${orderNumber} is on its way`,
        text:
          `Your order has left us and is on its way to you.\n\n` +
          `Order number: ${orderNumber}\n` +
          (total ? `Amount due on delivery: ${total}\n` : "") +
          `\nPlease have the cash ready for the delivery agent.\n\n` +
          trackingLine(orderNumber) +
          SIGN_OFF,
      };

    case "order_delivered":
      return {
        to: recipient,
        subject: `${storeName} — order ${orderNumber} delivered`,
        text:
          `Your order has been delivered. We hope you love it.\n\n` +
          `Order number: ${orderNumber}\n\n` +
          `If anything is not right, reply to this message and we will put it right.` +
          SIGN_OFF,
      };

    case "order_cancelled":
      return {
        to: recipient,
        subject: `${storeName} — order ${orderNumber} cancelled`,
        text:
          `Your order has been cancelled and nothing has been charged.\n\n` +
          `Order number: ${orderNumber}\n\n` +
          `If this was not what you expected, reply to this message and we will help.` +
          SIGN_OFF,
      };

    case "admin_new_order":
      // The store's own copy. Its recipient is resolved separately from the
      // private order_notification_email setting, never from the payload.
      return {
        to: recipient,
        subject: `New order ${orderNumber}${total ? ` — ${total}` : ""}`,
        text:
          `A new cash-on-delivery order has been placed.\n\n` +
          `Order number: ${orderNumber}\n` +
          (payload.customer ? `Customer: ${payload.customer}\n` : "") +
          (payload.phone ? `Phone: ${payload.phone}\n` : "") +
          (total ? `Total: ${total}\n` : "") +
          `\nOpen it in the admin panel: ${siteConfig.url}/admin/orders\n`,
      };

    // processing, packed and returned are meaningful internally but are not
    // worth an email to the customer, so they are recorded and not sent.
    default:
      return null;
  }
}
