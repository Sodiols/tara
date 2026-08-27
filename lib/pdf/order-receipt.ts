import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate, toPoisha } from "@/lib/format";
import { receiptAddressLines, type OrderReceiptSnapshot } from "@/lib/order-receipt";
import type { StoreIdentity } from "@/lib/supabase/queries/settings";
import { siteConfig } from "@/data/site";

const PAGE = { width: 595.28, height: 841.89, margin: 48 };
const WINE = rgb(0.44, 0.12, 0.23);
const INK = rgb(0.12, 0.11, 0.1);
const MUTED = rgb(0.42, 0.4, 0.38);
const RULE = rgb(0.86, 0.83, 0.79);

function taka(value: number | string): string {
  const amount = toPoisha(value) / 100;
  return `BDT ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Generate the customer receipt in memory; no order data is written to disk. */
export async function generateOrderReceiptPdf(snapshot: OrderReceiptSnapshot, store: StoreIdentity): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page!: PDFPage;
  let y = 0;

  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - PAGE.margin;
    page.drawText("TARA", { x: PAGE.margin, y, font: bold, size: 18, color: WINE });
    page.drawText(`Order receipt ${snapshot.order.orderNumber}`, { x: 330, y: y + 2, font: regular, size: 9, color: MUTED });
    y -= 35;
  };
  const ensure = (height: number) => { if (y - height < PAGE.margin) newPage(); };
  const line = (label: string, value: string, options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    ensure(18);
    page.drawText(label, { x: PAGE.margin, y, font: options.bold ? bold : regular, size: options.size ?? 10, color: options.color ?? INK });
    if (value) page.drawText(value, { x: 185, y, font: options.bold ? bold : regular, size: options.size ?? 10, color: options.color ?? INK });
    y -= 17;
  };
  const drawItemColumns = (continued = false) => {
    ensure(55);
    if (continued) {
      page.drawText("ITEMS CONTINUED", { x: PAGE.margin, y, font: bold, size: 10, color: WINE });
      y -= 20;
    }
    page.drawText("ITEM", { x: PAGE.margin, y, font: bold, size: 9, color: WINE });
    page.drawText("UNIT", { x: 340, y, font: bold, size: 9, color: WINE });
    page.drawText("QTY", { x: 420, y, font: bold, size: 9, color: WINE });
    page.drawText("TOTAL", { x: 458, y, font: bold, size: 9, color: WINE });
    y -= 10;
    page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.width - PAGE.margin, y }, thickness: 1, color: RULE });
    y -= 20;
  };

  newPage();
  try {
    const logoBytes = await readFile(path.join(process.cwd(), "public", "logo", "logo-black.png"));
    const logo = await doc.embedPng(logoBytes);
    const scale = Math.min(116 / logo.width, 42 / logo.height);
    page.drawImage(logo, { x: PAGE.margin, y: PAGE.height - 95, width: logo.width * scale, height: logo.height * scale });
  } catch {
    // The text wordmark already makes the receipt valid if the optional image is unavailable.
  }

  page.drawText("RECEIPT", { x: 400, y: PAGE.height - 95, font: bold, size: 22, color: WINE });
  y = PAGE.height - 130;
  page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.width - PAGE.margin, y }, thickness: 1, color: RULE });
  y -= 26;
  line("Order number", snapshot.order.orderNumber, { bold: true });
  line("Order date", formatDate(snapshot.order.createdAt));
  line("Payment", snapshot.order.paymentMethod === "cash_on_delivery" ? "Cash on delivery" : snapshot.order.paymentMethod);
  line("Status", snapshot.order.status.replaceAll("_", " "));
  y -= 8;

  page.drawText("CUSTOMER", { x: PAGE.margin, y, font: bold, size: 10, color: WINE });
  y -= 20;
  line("Name", snapshot.order.customerName);
  line("Email", snapshot.order.customerEmail);
  line("Phone", snapshot.order.customerPhone);
  const addressLines = receiptAddressLines(snapshot);
  if (!addressLines.some((addressLine) => /bangladesh/i.test(addressLine))) addressLines.push("Bangladesh");
  for (const addressLine of addressLines) {
    const wrapped = wrap(addressLine, regular, 10, 350);
    wrapped.forEach((part, index) => line(index === 0 ? "Delivery address" : "", part));
  }
  y -= 10;

  drawItemColumns();

  for (const item of snapshot.items) {
    const detail = [item.productCode || item.sku, item.size, item.colour].filter(Boolean).join(" · ");
    const nameLines = wrap(item.productName || "Product", bold, 10, 270);
    const height = Math.max(42, nameLines.length * 14 + 22);
    if (y - height < PAGE.margin) {
      newPage();
      drawItemColumns(true);
    }
    nameLines.forEach((part, index) => page.drawText(part, { x: PAGE.margin, y: y - index * 14, font: bold, size: 10, color: INK }));
    page.drawText(taka(item.unitPrice), { x: 340, y, font: regular, size: 9, color: INK });
    page.drawText(String(item.quantity), { x: 428, y, font: regular, size: 10, color: INK });
    const total = taka(item.lineTotal);
    page.drawText(total, { x: PAGE.width - PAGE.margin - regular.widthOfTextAtSize(total, 10), y, font: regular, size: 10, color: INK });
    if (detail) page.drawText(detail, { x: PAGE.margin, y: y - nameLines.length * 14 - 2, font: regular, size: 8, color: MUTED });
    y -= height;
  }

  ensure(105);
  page.drawLine({ start: { x: 330, y }, end: { x: PAGE.width - PAGE.margin, y }, thickness: 1, color: RULE });
  y -= 20;
  const totals: [string, number | string, boolean][] = [
    ["Subtotal", snapshot.order.subtotal, false],
    ["Delivery", snapshot.order.deliveryFee, false],
    ["Discount", snapshot.order.discountAmount, false],
    ["Total", snapshot.order.total, true],
  ];
  for (const [label, value, strong] of totals) {
    const rendered = taka(value);
    page.drawText(label, { x: 330, y, font: strong ? bold : regular, size: strong ? 12 : 10, color: strong ? WINE : INK });
    page.drawText(rendered, { x: PAGE.width - PAGE.margin - (strong ? bold : regular).widthOfTextAtSize(rendered, strong ? 12 : 10), y, font: strong ? bold : regular, size: strong ? 12 : 10, color: strong ? WINE : INK });
    y -= strong ? 22 : 17;
  }
  page.drawText(`Amount due on delivery: ${taka(snapshot.order.total)}`, { x: 330, y, font: bold, size: 9, color: INK });
  y -= 18;

  ensure(55);
  y -= 18;
  page.drawText(`Thank you for shopping with ${store.storeName}.`, { x: PAGE.margin, y, font: bold, size: 10, color: INK });
  y -= 16;
  const footer = [store.supportEmail, store.supportPhone, siteConfig.domain, store.storeAddress].filter(Boolean).join(" · ");
  wrap(footer, regular, 8, PAGE.width - PAGE.margin * 2).forEach((part) => { page.drawText(part, { x: PAGE.margin, y, font: regular, size: 8, color: MUTED }); y -= 12; });

  doc.setTitle(`TARA Order ${snapshot.order.orderNumber}`);
  doc.setCreator("TARA");
  return doc.save();
}
