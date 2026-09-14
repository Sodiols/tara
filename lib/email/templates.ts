import "server-only";

import { formatDateTime, formatTaka } from "@/lib/format";
import { formatOrderAddress, formatOrderAddressInline } from "@/lib/order-address";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import type { OrderReceiptSnapshot } from "@/lib/order-receipt";
import { resolveSiteOrigin } from "@/lib/site-url";
import type { StoreIdentity } from "@/lib/supabase/queries/settings";
import type { OrderStatus } from "@/types/database";
import type { EmailMessage } from "./provider";

export type NotificationTemplate =
  | "order_placed" | "order_confirmed" | "order_processing" | "order_packed"
  | "order_shipped" | "order_delivered" | "order_cancelled" | "order_returned"
  | "admin_new_order" | "admin_contact_message";

export interface ContactNotificationSnapshot {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  createdAt: string;
}

/** Product id → an absolute HTTPS image URL, when the product has one. */
export type ProductImageMap = Record<string, string>;

/**
 * The origin every link and image in an email points at.
 *
 * Resolved as a production build would resolve it, in every environment: a
 * configured public origin is used, and a missing or local one (the
 * http://localhost:3000 a developer's .env.local holds) falls back to
 * https://www.tarabd.co. An email is read in Gmail on someone's phone, where a
 * localhost logo is a broken image and a localhost button goes nowhere — so,
 * unlike page canonicals, there is no "development" answer worth sending.
 */
export const EMAIL_ORIGIN = resolveSiteOrigin({
  configured: process.env.NEXT_PUBLIC_SITE_URL,
  nodeEnv: "production",
}).origin;

/** The storefront's own Deep Wine logo (public/logo/logo-meroon.png). */
export const EMAIL_LOGO_URL = `${EMAIL_ORIGIN}/logo/logo-meroon.png`;

const BRAND = {
  wine: "#702D42",
  ivory: "#F5F1EA",
  black: "#171717",
  white: "#FFFFFF",
  muted: "#6B6461",
  line: "#E7E0D6",
};

const FONT = "Arial,Helvetica,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function displayHost(): string {
  return new URL(EMAIL_ORIGIN).host;
}

function paymentLabel(method: string): string {
  if (!method || method === "cash_on_delivery") return "Cash on Delivery";
  return method.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status.replaceAll("_", " ");
}

/**
 * The frame every TARA email shares: the logo on Soft Ivory, one white card,
 * and a quiet footer.
 *
 * Table layout with inline styles only, because that is what Gmail, Outlook and
 * the iOS and Android mail apps agree on. The card is fluid up to 600px, so the
 * same markup reads on a phone without media queries (which Gmail's app strips).
 */
function shell({ preheader, content, footer }: { preheader: string; content: string; footer: string }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>TARA</title></head>`
    + `<body style="margin:0;padding:0;background-color:${BRAND.ivory};color:${BRAND.black};font-family:${FONT};-webkit-text-size-adjust:100%">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.ivory}"><tr><td align="center" style="padding:32px 12px">`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">`
    + `<tr><td align="center" style="padding:0 0 24px"><a href="${escapeHtml(EMAIL_ORIGIN)}" style="text-decoration:none"><img src="${escapeHtml(EMAIL_LOGO_URL)}" width="132" height="34" alt="TARA" style="display:block;width:132px;height:auto;max-width:132px;border:0;outline:none;text-decoration:none"></a></td></tr>`
    + `<tr><td style="background-color:${BRAND.white};border:1px solid ${BRAND.line};border-radius:6px;padding:32px 28px">${content}</td></tr>`
    + `<tr><td align="center" style="padding:24px 16px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${BRAND.muted}">${footer}</td></tr>`
    + `</table></td></tr></table></body></html>`;
}

function standardFooter(storeName: string): string {
  return `<strong style="color:${BRAND.black};letter-spacing:2px">${escapeHtml(storeName)}</strong><br><a href="${escapeHtml(EMAIL_ORIGIN)}" style="color:${BRAND.wine};text-decoration:none">${escapeHtml(displayHost())}</a>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-family:${SERIF};font-size:26px;line-height:1.25;font-weight:400;color:${BRAND.black}">${escapeHtml(text)}</h1>`;
}

function paragraph(html: string, extra = ""): string {
  return `<p style="margin:0 0 20px;font-family:${FONT};font-size:15px;line-height:1.65;color:${BRAND.black};${extra}">${html}</p>`;
}

function sectionTitle(text: string): string {
  return `<p style="margin:28px 0 10px;font-family:${FONT};font-size:11px;line-height:1.4;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.wine}">${escapeHtml(text)}</p>`;
}

/** Label / value rows. Values are escaped here; pass plain strings. */
function detailRows(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">${rows
    .map(([label, value]) => `<tr><td valign="top" style="padding:7px 12px 7px 0;width:38%;font-family:${FONT};font-size:13px;line-height:1.5;color:${BRAND.muted}">${escapeHtml(label)}</td><td valign="top" style="padding:7px 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${BRAND.black};word-break:break-word">${escapeHtml(value).replaceAll("\n", "<br>")}</td></tr>`)
    .join("")}</table>`;
}

function primaryButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto"><tr><td align="center" bgcolor="${BRAND.wine}" style="border-radius:4px;background-color:${BRAND.wine}"><a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:15px 44px;font-family:${FONT};font-size:14px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.white};text-decoration:none;border-radius:4px">${escapeHtml(label)}</a></td></tr></table>`;
}

function itemRows(snapshot: OrderReceiptSnapshot, images: ProductImageMap = {}): { html: string; text: string } {
  const html = snapshot.items.map((item) => {
    const image = images[item.productId];
    const meta = [
      item.size ? `Size: ${item.size}` : "",
      item.colour ? `Colour: ${item.colour}` : "",
      `Qty: ${item.quantity}`,
    ].filter(Boolean).join(" · ");
    const code = item.productCode || item.sku;
    const thumb = image
      ? `<td valign="top" width="64" style="padding:14px 14px 14px 0;width:64px;border-bottom:1px solid ${BRAND.line}"><img src="${escapeHtml(image)}" width="64" height="80" alt="${escapeHtml(item.productName)}" style="display:block;width:64px;height:80px;object-fit:cover;border:0;border-radius:3px;background-color:${BRAND.ivory}"></td>`
      : "";
    return `<tr>${thumb}<td valign="top" style="padding:14px 0;border-bottom:1px solid ${BRAND.line}"><p style="margin:0 0 4px;font-family:${FONT};font-size:14px;line-height:1.45;font-weight:700;color:${BRAND.black}">${escapeHtml(item.productName)}</p><p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.5;color:${BRAND.muted}">${escapeHtml(meta)}${code ? `<br>${escapeHtml(code)}` : ""}</p></td><td valign="top" align="right" style="padding:14px 0 14px 12px;border-bottom:1px solid ${BRAND.line};font-family:${FONT};font-size:14px;line-height:1.45;color:${BRAND.black};white-space:nowrap">${escapeHtml(formatTaka(item.lineTotal))}</td></tr>`;
  }).join("");
  const text = snapshot.items.map((item) => `- ${item.productName} (${[item.productCode || item.sku, item.size && `Size ${item.size}`, item.colour && `Colour ${item.colour}`].filter(Boolean).join(", ")}) x ${item.quantity}: ${formatTaka(item.lineTotal)}`).join("\n");
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">${html}</table>`,
    text,
  };
}

function totalRows(snapshot: OrderReceiptSnapshot): { html: string; text: string } {
  const order = snapshot.order;
  const discount = Number(order.discountAmount) > 0;
  const line = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:5px 0;font-family:${FONT};font-size:${strong ? 16 : 14}px;line-height:1.5;color:${strong ? BRAND.black : BRAND.muted};${strong ? "font-weight:700;" : ""}">${escapeHtml(label)}</td><td align="right" style="padding:5px 0;font-family:${FONT};font-size:${strong ? 16 : 14}px;line-height:1.5;color:${BRAND.black};${strong ? "font-weight:700;" : ""}white-space:nowrap">${escapeHtml(value)}</td></tr>`;
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:10px">`
      + line("Subtotal", formatTaka(order.subtotal))
      + line("Delivery charge", formatTaka(order.deliveryFee))
      + (discount ? line("Discount", `-${formatTaka(order.discountAmount)}`) : "")
      + `<tr><td colspan="2" style="padding:6px 0 0;border-bottom:1px solid ${BRAND.line};font-size:0;line-height:0">&nbsp;</td></tr>`
      + line("Grand total", formatTaka(order.total), true)
      + `</table>`,
    text: `Subtotal: ${formatTaka(order.subtotal)}\nDelivery charge: ${formatTaka(order.deliveryFee)}\n${discount ? `Discount: -${formatTaka(order.discountAmount)}\n` : ""}Grand total: ${formatTaka(order.total)}`,
  };
}

/** The customer-facing order block, used by every customer order email. */
function orderSummary(snapshot: OrderReceiptSnapshot): { html: string; text: string } {
  const order = snapshot.order;
  const items = itemRows(snapshot);
  const totals = totalRows(snapshot);
  const address = formatOrderAddressInline(order.shippingAddress);
  const area = formatOrderAddress(order.shippingAddress).zoneLabel;
  return {
    html: detailRows([
      ["Order number", order.orderNumber],
      ["Order date", formatDateTime(order.createdAt)],
      ["Status", statusLabel(order.status)],
      ["Payment", paymentLabel(order.paymentMethod)],
    ])
      + sectionTitle("Items")
      + items.html
      + totals.html
      + sectionTitle("Delivery address")
      + paragraph(`${escapeHtml(address)}${area ? `<br><span style="color:${BRAND.muted}">${escapeHtml(area)}</span>` : ""}`, "margin:0;font-size:14px"),
    text: `Order number: ${order.orderNumber}\nOrder date: ${formatDateTime(order.createdAt)}\nStatus: ${statusLabel(order.status)}\nPayment: ${paymentLabel(order.paymentMethod)}\n\n${items.text}\n\n${totals.text}\n\nDelivery address: ${address}${area ? `\nDelivery area: ${area}` : ""}`,
  };
}

/**
 * The internal "new order" notification.
 *
 * Operational, not promotional: the headline numbers first, then who and where,
 * then what was bought, then the two actions. Both actions are admin routes, so
 * the link in the email is only a pointer — lib/supabase/proxy.ts sends a
 * signed-out visitor to /login?returnTo=<that exact path>, and the page itself
 * still requires staff permission after sign-in.
 */
function adminNewOrderEmail(recipient: string | string[], snapshot: OrderReceiptSnapshot, store: StoreIdentity, images: ProductImageMap): EmailMessage {
  const order = snapshot.order;
  const orderPath = `/admin/orders/${encodeURIComponent(order.id)}`;
  const orderUrl = `${EMAIL_ORIGIN}${orderPath}`;
  const receiptUrl = `${EMAIL_ORIGIN}${orderPath}/invoice`;
  const payment = paymentLabel(order.paymentMethod);
  const status = order.status === "pending" ? "New Order" : statusLabel(order.status);
  const total = formatTaka(order.total);
  // The street address on one line and the delivery area under it: compact, and
  // the area is what decides which courier rate applies.
  const inlineAddress = formatOrderAddressInline(order.shippingAddress);
  const zoneLabel = formatOrderAddress(order.shippingAddress).zoneLabel;
  const addressLines = [inlineAddress, zoneLabel].filter(Boolean);
  const items = itemRows(snapshot, images);
  const totals = totalRows(snapshot);

  const customerRows: Array<[string, string]> = [
    ["Order date", formatDateTime(order.createdAt)],
    ["Customer", order.customerName],
    ["Phone", order.customerPhone],
    ...(order.customerEmail ? [["Email", order.customerEmail] as [string, string]] : []),
    ["Delivery address", addressLines.join("\n") || "—"],
    ["Payment method", payment],
    ["Order status", statusLabel(order.status)],
  ];

  const summaryCard = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.ivory};border-radius:6px;margin:4px 0 8px"><tr><td align="center" style="padding:22px 16px">`
    + `<p style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:1.4;letter-spacing:1px;color:${BRAND.muted}">Order #${escapeHtml(order.orderNumber)}</p>`
    + `<p style="margin:0 0 10px;font-family:${SERIF};font-size:34px;line-height:1.15;color:${BRAND.wine}">${escapeHtml(total)}</p>`
    + `<p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.5;color:${BRAND.black}">${escapeHtml(payment)}&nbsp;&nbsp;·&nbsp;&nbsp;<span style="display:inline-block;padding:3px 10px;border-radius:999px;background-color:${BRAND.wine};color:${BRAND.white};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${escapeHtml(status)}</span></p>`
    + `</td></tr></table>`;

  const content = heading("A New Order Has Arrived")
    + paragraph("A customer has just placed a new order on TARA. Review the order details below and open the order from the admin panel when you are ready to process it.", `color:${BRAND.muted}`)
    + summaryCard
    + sectionTitle("Customer and order")
    + detailRows(customerRows)
    + sectionTitle("Products")
    + items.html
    + totals.html
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px"><tr><td align="center">${primaryButton("Open Order", orderUrl)}</td></tr>`
    + `<tr><td align="center" style="padding-top:16px;font-family:${FONT};font-size:14px;line-height:1.5"><a href="${escapeHtml(receiptUrl)}" target="_blank" style="color:${BRAND.wine};text-decoration:underline;font-weight:700">View Receipt</a></td></tr>`
    + `<tr><td align="center" style="padding-top:14px;font-family:${FONT};font-size:12px;line-height:1.5;color:${BRAND.muted}">Staff sign-in is required to view the order and receipt.</td></tr></table>`;

  const footer = `<strong style="color:${BRAND.black};letter-spacing:2px">${escapeHtml(store.storeName)}</strong><br>This is an automatic order notification from the TARA website.<br><a href="${escapeHtml(EMAIL_ORIGIN)}" style="color:${BRAND.wine};text-decoration:none">${escapeHtml(displayHost())}</a>`;

  return {
    to: recipient,
    subject: `New Order Arrived at ${store.storeName} | Order #${order.orderNumber}`,
    text: [
      "A New Order Has Arrived",
      "",
      "A customer has just placed a new order on TARA. Review the order details below and open the order from the admin panel when you are ready to process it.",
      "",
      `Order #${order.orderNumber}`,
      `Total: ${total}`,
      `${payment} · ${status}`,
      "",
      ...customerRows.map(([label, value]) => `${label}: ${value.replaceAll("\n", ", ")}`),
      "",
      "Products:",
      items.text,
      "",
      totals.text,
      "",
      `Open Order: ${orderUrl}`,
      `View Receipt: ${receiptUrl}`,
      "",
      "TARA",
      "This is an automatic order notification from the TARA website.",
      EMAIL_ORIGIN,
    ].join("\n"),
    html: shell({ preheader: `Order #${order.orderNumber} · ${total} · ${payment}`, content, footer }),
  };
}

export function buildOrderNotificationEmail(template: string, recipient: string | string[], snapshot: OrderReceiptSnapshot, store: StoreIdentity, images: ProductImageMap = {}): EmailMessage | null {
  const order = snapshot.order;
  const summary = orderSummary(snapshot);
  const tracking = `${EMAIL_ORIGIN}/track-order`;
  const trackingText = order.trackingToken ? `\n\nTrack at ${tracking}\nOrder number: ${order.orderNumber}\nTracking token: ${order.trackingToken}` : "";
  const trackingHtml = order.trackingToken
    ? sectionTitle("Track your order")
      + paragraph(`<a href="${escapeHtml(tracking)}" style="color:${BRAND.wine};font-weight:700">Track your order</a><br>Order number: <strong>${escapeHtml(order.orderNumber)}</strong><br>Tracking token: <code style="font-size:12px;word-break:break-all">${escapeHtml(order.trackingToken)}</code>`, "margin:0;font-size:14px")
    : "";

  const customer = (title: string, intro: string, subject: string): EmailMessage => {
    const support = store.supportEmail || store.supportPhone || EMAIL_ORIGIN;
    return {
      to: recipient,
      subject,
      text: `${intro}\n\nHello ${order.customerName},\n\n${summary.text}${trackingText}\n\nSupport: ${support}\nThank you for shopping with ${store.storeName}.`,
      html: shell({
        preheader: intro,
        content: heading(title)
          + paragraph(`Hello ${escapeHtml(order.customerName)},<br><br>${escapeHtml(intro)}`)
          + summary.html
          + trackingHtml
          + paragraph(`Support: ${escapeHtml(support)}`, `margin:24px 0 0;font-size:13px;color:${BRAND.muted}`),
        footer: standardFooter(store.storeName),
      }),
      ...(store.supportEmail ? { replyTo: store.supportEmail } : {}),
    };
  };

  switch (template) {
    case "order_placed": return customer("Thank you for your order", "We have received your cash-on-delivery order. Your PDF receipt is attached.", `${store.storeName} — order ${order.orderNumber} received`);
    case "order_confirmed": return customer("Your order is confirmed", "Your order has been confirmed and is being prepared.", `${store.storeName} — order ${order.orderNumber} confirmed`);
    case "order_shipped": return customer("Your order is on its way", `Your order has been shipped. Please have ${formatTaka(order.total)} ready for the delivery agent.`, `${store.storeName} — order ${order.orderNumber} shipped`);
    case "order_delivered": return customer("Your order was delivered", "We hope you love your purchase. You can now leave a verified review from the product page.", `${store.storeName} — order ${order.orderNumber} delivered`);
    case "order_cancelled": return customer("Your order was cancelled", "Your order has been cancelled and nothing has been charged.", `${store.storeName} — order ${order.orderNumber} cancelled`);
    case "admin_new_order": return adminNewOrderEmail(recipient, snapshot, store, images);
    default: return null;
  }
}

export function buildContactNotificationEmail(recipient: string | string[], contact: ContactNotificationSnapshot, store: StoreIdentity): EmailMessage {
  const subject = contact.subject?.trim() || "Website contact message";
  const messagesUrl = `${EMAIL_ORIGIN}/admin/messages`;
  return {
    to: recipient,
    replyTo: contact.email,
    subject: `New ${store.storeName} Contact Message — ${contact.name}`,
    text: `New website contact message\n\nFrom: ${contact.name}\nEmail: ${contact.email}\nPhone: ${contact.phone || "Not provided"}\nSubject: ${subject}\n\n${contact.message}\n\nOpen messages: ${messagesUrl}`,
    html: shell({
      preheader: `${contact.name}: ${subject}`,
      content: heading("New website contact message")
        + detailRows([
          ["From", contact.name],
          ["Email", contact.email],
          ["Phone", contact.phone || "Not provided"],
          ["Subject", subject],
        ])
        + `<div style="margin:20px 0 28px;padding:16px;background-color:${BRAND.ivory};border-radius:4px;white-space:pre-wrap;font-family:${FONT};font-size:14px;line-height:1.7;color:${BRAND.black}">${escapeHtml(contact.message)}</div>`
        + primaryButton("Open Messages", messagesUrl),
      footer: standardFooter(store.storeName),
    }),
  };
}

export function buildTestEmail(recipient: string | string[], store: StoreIdentity): EmailMessage {
  return {
    to: recipient,
    subject: `${store.storeName} email test`,
    text: `Your ${store.storeName} transactional email configuration is working.`,
    html: shell({
      preheader: "Your transactional email configuration is working.",
      content: heading("Email configuration is working")
        + paragraph("This test was sent from Admin settings. Order and contact notifications can now be delivered.", "margin:0"),
      footer: standardFooter(store.storeName),
    }),
  };
}
