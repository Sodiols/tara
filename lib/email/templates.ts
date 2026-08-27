import "server-only";

import { siteConfig } from "@/data/site";
import { formatDateTime, formatTaka } from "@/lib/format";
import { formatOrderAddress, formatOrderAddressInline } from "@/lib/order-address";
import type { OrderReceiptSnapshot } from "@/lib/order-receipt";
import type { StoreIdentity } from "@/lib/supabase/queries/settings";
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

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function shell(storeName: string, heading: string, content: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f7f3ef;color:#1f1c1b;font-family:Arial,sans-serif"><div style="max-width:640px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #e2dcd6;padding:34px"><div style="color:#74223c;font-size:22px;font-weight:700;letter-spacing:5px">TARA</div><h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400;margin:24px 0 18px">${escapeHtml(heading)}</h1>${content}<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e2dcd6;color:#6d6661;font-size:12px;line-height:1.6">${escapeHtml(storeName)} · ${escapeHtml(siteConfig.url)}</p></div></div></body></html>`;
}

function rows(snapshot: OrderReceiptSnapshot): { html: string; text: string } {
  const html = snapshot.items.map((item) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">${escapeHtml(item.productName)}<br><span style="color:#777;font-size:12px">${escapeHtml([item.productCode || item.sku, item.size, item.colour].filter(Boolean).join(" · "))}</span></td><td style="text-align:center;border-bottom:1px solid #eee">${item.quantity}</td><td style="text-align:right;border-bottom:1px solid #eee">${escapeHtml(formatTaka(item.lineTotal))}</td></tr>`).join("");
  const text = snapshot.items.map((item) => `- ${item.productName} (${[item.productCode || item.sku, item.size, item.colour].filter(Boolean).join(", ")}) x ${item.quantity}: ${formatTaka(item.lineTotal)}`).join("\n");
  return { html, text };
}

function orderSummary(snapshot: OrderReceiptSnapshot): { html: string; text: string } {
  const itemRows = rows(snapshot);
  const address = formatOrderAddressInline(snapshot.order.shippingAddress);
  const area = formatOrderAddress(snapshot.order.shippingAddress).zoneLabel;
  const discount = Number(snapshot.order.discountAmount) > 0;
  return {
    html: `<p style="line-height:1.6"><strong>Order:</strong> ${escapeHtml(snapshot.order.orderNumber)}<br><strong>Order date:</strong> ${escapeHtml(formatDateTime(snapshot.order.createdAt))}<br><strong>Status:</strong> ${escapeHtml(snapshot.order.status.replaceAll("_", " "))}<br><strong>Payment:</strong> Cash on delivery</p><table style="width:100%;border-collapse:collapse;font-size:14px"><tbody>${itemRows.html}</tbody></table><p style="line-height:1.7;text-align:right"><strong>Subtotal:</strong> ${escapeHtml(formatTaka(snapshot.order.subtotal))}<br>${discount ? `<strong>Discount:</strong> -${escapeHtml(formatTaka(snapshot.order.discountAmount))}<br>` : ""}<strong>Delivery:</strong> ${escapeHtml(formatTaka(snapshot.order.deliveryFee))}<br><strong>Total / amount due:</strong> ${escapeHtml(formatTaka(snapshot.order.total))}</p><p style="line-height:1.6"><strong>Delivery address:</strong><br>${escapeHtml(address)}${area ? `<br>${escapeHtml(area)}` : ""}</p>`,
    text: `Order number: ${snapshot.order.orderNumber}\nOrder date: ${formatDateTime(snapshot.order.createdAt)}\nStatus: ${snapshot.order.status.replaceAll("_", " ")}\nPayment: Cash on delivery\n\n${itemRows.text}\n\nSubtotal: ${formatTaka(snapshot.order.subtotal)}\n${discount ? `Discount: -${formatTaka(snapshot.order.discountAmount)}\n` : ""}Delivery: ${formatTaka(snapshot.order.deliveryFee)}\nTotal / amount due: ${formatTaka(snapshot.order.total)}\n\nDelivery address: ${address}${area ? `\nDelivery area: ${area}` : ""}`,
  };
}

export function buildOrderNotificationEmail(template: string, recipient: string, snapshot: OrderReceiptSnapshot, store: StoreIdentity): EmailMessage | null {
  const order = snapshot.order;
  const summary = orderSummary(snapshot);
  const tracking = `${siteConfig.url}/track-order`;
  const trackingText = order.trackingToken ? `\n\nTrack at ${tracking}\nOrder number: ${order.orderNumber}\nTracking token: ${order.trackingToken}` : "";
  const trackingHtml = order.trackingToken ? `<p style="line-height:1.6"><a href="${escapeHtml(tracking)}" style="color:#74223c">Track your order</a><br>Order number: <strong>${escapeHtml(order.orderNumber)}</strong><br>Tracking token: <code>${escapeHtml(order.trackingToken)}</code></p>` : "";

  const customer = (heading: string, intro: string, subject: string): EmailMessage => ({
    to: recipient,
    subject,
    text: `${intro}\n\nHello ${order.customerName},\n\n${summary.text}${trackingText}\n\nSupport: ${store.supportEmail || store.supportPhone || siteConfig.url}\nThank you for shopping with ${store.storeName}.`,
    html: shell(store.storeName, heading, `<p style="line-height:1.7">Hello ${escapeHtml(order.customerName)},<br><br>${escapeHtml(intro)}</p>${summary.html}${trackingHtml}<p style="color:#6d6661;font-size:13px">Support: ${escapeHtml(store.supportEmail || store.supportPhone || siteConfig.url)}</p>`),
    ...(store.supportEmail ? { replyTo: store.supportEmail } : {}),
  });

  switch (template) {
    case "order_placed": return customer("Thank you for your order", "We have received your cash-on-delivery order. Your PDF receipt is attached.", `${store.storeName} — order ${order.orderNumber} received`);
    case "order_confirmed": return customer("Your order is confirmed", "Your order has been confirmed and is being prepared.", `${store.storeName} — order ${order.orderNumber} confirmed`);
    case "order_shipped": return customer("Your order is on its way", `Your order has been shipped. Please have ${formatTaka(order.total)} ready for the delivery agent.`, `${store.storeName} — order ${order.orderNumber} shipped`);
    case "order_delivered": return customer("Your order was delivered", "We hope you love your purchase. You can now leave a verified review from the product page.", `${store.storeName} — order ${order.orderNumber} delivered`);
    case "order_cancelled": return customer("Your order was cancelled", "Your order has been cancelled and nothing has been charged.", `${store.storeName} — order ${order.orderNumber} cancelled`);
    case "admin_new_order": {
      const adminUrl = `${siteConfig.url}/admin/orders/${encodeURIComponent(order.id)}`;
      return {
        to: recipient,
        subject: `New order ${order.orderNumber} — ${formatTaka(order.total)}`,
        text: `A new cash-on-delivery order has been placed.\n\nCustomer: ${order.customerName}\nEmail: ${order.customerEmail}\nPhone: ${order.customerPhone}\n${summary.text}\n\nOpen order: ${adminUrl}`,
        html: shell(store.storeName, `New order ${order.orderNumber}`, `<p><strong>Customer:</strong> ${escapeHtml(order.customerName)}<br><strong>Email:</strong> ${escapeHtml(order.customerEmail)}<br><strong>Phone:</strong> ${escapeHtml(order.customerPhone)}</p>${summary.html}<p><a href="${escapeHtml(adminUrl)}" style="color:#74223c">Open this order in Admin</a></p>`),
      };
    }
    default: return null;
  }
}

export function buildContactNotificationEmail(recipient: string, contact: ContactNotificationSnapshot, store: StoreIdentity): EmailMessage {
  const subject = contact.subject?.trim() || "Website contact message";
  return {
    to: recipient,
    replyTo: contact.email,
    subject: `New ${store.storeName} Contact Message — ${contact.name}`,
    text: `New website contact message\n\nFrom: ${contact.name}\nEmail: ${contact.email}\nPhone: ${contact.phone || "Not provided"}\nSubject: ${subject}\n\n${contact.message}\n\nOpen messages: ${siteConfig.url}/admin/messages`,
    html: shell(store.storeName, "New website contact message", `<p style="line-height:1.7"><strong>From:</strong> ${escapeHtml(contact.name)}<br><strong>Email:</strong> ${escapeHtml(contact.email)}<br><strong>Phone:</strong> ${escapeHtml(contact.phone || "Not provided")}<br><strong>Subject:</strong> ${escapeHtml(subject)}</p><div style="white-space:pre-wrap;line-height:1.7;padding:16px;background:#f7f3ef">${escapeHtml(contact.message)}</div><p><a href="${escapeHtml(`${siteConfig.url}/admin/messages`)}" style="color:#74223c">Open messages in Admin</a></p>`),
  };
}

export function buildTestEmail(recipient: string, store: StoreIdentity): EmailMessage {
  return {
    to: recipient,
    subject: `${store.storeName} email test`,
    text: `Your ${store.storeName} transactional email configuration is working.`,
    html: shell(store.storeName, "Email configuration is working", "<p style=\"line-height:1.7\">This test was sent from Admin settings. Order and contact notifications can now be delivered.</p>"),
  };
}
