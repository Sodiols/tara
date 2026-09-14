import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { adminSettingsSchema, reviewSchema } from "../lib/validation";
import { parseOrderReceiptSnapshot, type OrderReceiptSnapshot } from "../lib/order-receipt";
import { generateOrderReceiptPdf } from "../lib/pdf/order-receipt";
import { buildContactNotificationEmail, buildOrderNotificationEmail } from "../lib/email/templates";
import { createResendProvider } from "../lib/email/provider";
import { parseRecipientList } from "../lib/email/recipients";

const orderNotificationSettingsSchema = adminSettingsSchema.shape.order_notification_email;

const snapshot: OrderReceiptSnapshot = {
  order: {
    id: "16de7294-88bb-486e-95b5-fd8cbea83c0a",
    orderNumber: "TARA-1052",
    createdAt: "2026-08-27T12:00:00Z",
    customerName: "Ayesha Rahman",
    customerEmail: "ayesha@example.com",
    customerPhone: "01712345678",
    shippingAddress: { address: "House 12, Road 3", apartment: "Flat 4B", city: "Sylhet", postalCode: "3100", deliveryZone: "inside_sylhet", country: "Bangladesh" },
    status: "pending",
    paymentMethod: "cash_on_delivery",
    subtotal: "3850.00",
    deliveryFee: "60.00",
    discountAmount: "100.00",
    total: "3810.00",
    currency: "BDT",
    trackingToken: "a".repeat(48),
  },
  items: [{
    id: "item-1", productId: "product-1", productName: "A very long embroidered three piece made for receipt wrapping verification", productCode: "TARA-001", sku: "TARA-001-M-WINE", size: "M", colour: "Wine", unitPrice: "1925.00", quantity: 2, lineTotal: "3850.00",
  }],
};

const store = {
  storeName: "TARA", supportPhone: "01700000000", whatsappNumber: "", supportEmail: "support@tarabd.co", storeAddress: "Sylhet, Bangladesh", facebookUrl: "", instagramUrl: "", tiktokUrl: "",
};

describe("verified review input", () => {
  test("accepts 1 and 5 stars, bounds title/comment, and never accepts an order item id", () => {
    for (const rating of [1, 5]) assert.equal(reviewSchema.safeParse({ productId: "3f1e9a6c-1d2b-4c3a-9e5f-6a7b8c9d0e1f", rating, title: "Beautiful quality", commentEn: "This was exactly as pictured." }).success, true);
    assert.equal(reviewSchema.safeParse({ productId: "3f1e9a6c-1d2b-4c3a-9e5f-6a7b8c9d0e1f", rating: 0, commentEn: "This was exactly as pictured." }).success, false);
    const parsed = reviewSchema.safeParse({ productId: "3f1e9a6c-1d2b-4c3a-9e5f-6a7b8c9d0e1f", orderItemId: "attacker", rating: 5, commentEn: "This was exactly as pictured." });
    assert.equal(parsed.success, true);
    if (parsed.success) assert.equal("orderItemId" in parsed.data, false);
  });

  test("migration makes the database choose an owned delivered item and prevents duplicate insertion", async () => {
    const sql = await readFile(new URL("../supabase/migrations/0015_email_receipts_reviews_and_contact_notifications.sql", import.meta.url), "utf8");
    assert.match(sql, /o\.user_id = auth\.uid\(\)/);
    assert.match(sql, /o\.status = 'delivered'/);
    assert.match(sql, /r\.order_item_id = oi\.id/);
    assert.match(sql, /when unique_violation/);
    assert.match(sql, /revoke insert on table public\.reviews from anon, authenticated/);
  });
});

describe("customer receipt", () => {
  test("parses saved order snapshots and rejects an incomplete order", () => {
    assert.equal(parseOrderReceiptSnapshot(snapshot)?.order.total, "3810.00");
    assert.equal(parseOrderReceiptSnapshot({ items: [] }), null);
  });

  test("generates a real readable PDF binary", async () => {
    const bytes = await generateOrderReceiptPdf(snapshot, store);
    assert.equal(Buffer.from(bytes.subarray(0, 5)).toString("ascii"), "%PDF-");
    const document = await PDFDocument.load(bytes);
    assert.ok(document.getPageCount() >= 1);
  });
});

describe("transactional email", () => {
  test("customer and admin templates use saved order values and keep tracking out of admin mail", () => {
    const customer = buildOrderNotificationEmail("order_placed", "ayesha@example.com", snapshot, store);
    const admin = buildOrderNotificationEmail("admin_new_order", "owner@example.com", snapshot, store);
    assert.match(customer?.text ?? "", /TARA-1052/);
    assert.match(customer?.text ?? "", /Tracking token:/);
    assert.match(customer?.html ?? "", /BDT|৳/);
    assert.doesNotMatch(admin?.text ?? "", new RegExp("a".repeat(48)));
    assert.match(admin?.text ?? "", /Ayesha Rahman/);
  });

  test("admin new-order mail carries the logo, the summary and protected absolute actions", () => {
    const admin = buildOrderNotificationEmail("admin_new_order", ["owner@example.com", "staff@example.com"], snapshot, store, {
      "product-1": "https://images.example.com/kurta.jpg",
    });
    assert.ok(admin);
    const html = admin.html ?? "";
    assert.equal(admin.subject, "New Order Arrived at TARA | Order #TARA-1052");
    assert.deepEqual(admin.to, ["owner@example.com", "staff@example.com"]);
    assert.match(html, /<img src="https:\/\/[^"]+\/logo\/logo-meroon\.png"[^>]*alt="TARA"/);
    assert.match(html, /A New Order Has Arrived/);
    assert.match(html, /Order #TARA-1052/);
    assert.match(html, /Cash on Delivery/);
    assert.match(html, /New Order/);
    assert.match(html, /Ayesha Rahman/);
    assert.match(html, /01712345678/);
    assert.match(html, /House 12, Road 3/);
    assert.match(html, /Size: M/);
    assert.match(html, /Colour: Wine/);
    assert.match(html, /Qty: 2/);
    assert.match(html, /Delivery charge/);
    assert.match(html, /Discount/);
    assert.match(html, /Grand total/);
    assert.match(html, /https:\/\/images\.example\.com\/kurta\.jpg/);
    assert.match(html, /href="https:\/\/[^"]+\/admin\/orders\/16de7294-88bb-486e-95b5-fd8cbea83c0a"[^>]*>Open Order</);
    assert.match(html, /href="https:\/\/[^"]+\/admin\/orders\/16de7294-88bb-486e-95b5-fd8cbea83c0a\/invoice"[^>]*>View Receipt</);
    assert.match(html, /This is an automatic order notification from the TARA website\./);
    // Every link and image must survive being opened in Gmail on a phone.
    for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      assert.match(url, /^https:\/\//, url);
      assert.doesNotMatch(url, /localhost|127\.0\.0\.1/, url);
    }
    // The tracking token grants customer access to the order; staff mail never carries it.
    assert.doesNotMatch(html, new RegExp("a".repeat(48)));
    assert.match(admin.text, /Open Order: https:\/\/.+\/admin\/orders\//);
  });

  test("notification recipients are a de-duplicated list and a bad entry drops out", () => {
    assert.deepEqual(parseRecipientList("Owner@tarabd.co, staff@tarabd.co;owner@TARABD.co  not-an-email"), ["owner@tarabd.co", "staff@tarabd.co"]);
    assert.deepEqual(parseRecipientList(""), []);
    assert.deepEqual(parseRecipientList(null), []);
    assert.equal(orderNotificationSettingsSchema.parse("a@tarabd.co; b@tarabd.co, A@tarabd.co"), "a@tarabd.co, b@tarabd.co");
    assert.equal(orderNotificationSettingsSchema.safeParse("a@tarabd.co, nope").success, false);
  });

  test("contact mail keeps the verified sender and assigns customer Reply-To", () => {
    const message = buildContactNotificationEmail("owner@example.com", { id: "message-1", name: "Sodiol Sayem", email: "customer@example.com", phone: "01712345678", message: "Please help me choose the right size.", createdAt: "2026-08-27T12:00:00Z" }, store);
    assert.equal(message.to, "owner@example.com");
    assert.equal(message.replyTo, "customer@example.com");
    assert.match(message.subject, /Sodiol Sayem/);
  });

  test("Resend receives PDF bytes as Base64 plus a stable idempotency key", async () => {
    const originalFetch = globalThis.fetch;
    const previousFrom = process.env.EMAIL_FROM;
    let requestBody: Record<string, unknown> = {};
    let requestHeaders: HeadersInit | undefined;
    process.env.EMAIL_FROM = "TARA <orders@tarabd.co>";
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      requestHeaders = init?.headers;
      return new Response(JSON.stringify({ id: "email-1" }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    try {
      const list = await createResendProvider("test-key").send({ to: ["owner@tarabd.co", "staff@tarabd.co"], subject: "New order", text: "Order" });
      assert.equal(list.status, "sent");
      assert.deepEqual(requestBody.to, ["owner@tarabd.co", "staff@tarabd.co"]);
      const outcome = await createResendProvider("test-key").send({ to: "customer@example.com", subject: "Receipt", text: "Attached", idempotencyKey: "tara-notification-one", attachments: [{ filename: "receipt.pdf", content: new Uint8Array([37, 80, 68, 70]), contentType: "application/pdf" }] });
      assert.equal(outcome.status, "sent");
      assert.equal(new Headers(requestHeaders).get("idempotency-key"), "tara-notification-one");
      const attachments = requestBody.attachments as Array<Record<string, unknown>>;
      assert.equal(attachments[0].content, Buffer.from([37, 80, 68, 70]).toString("base64"));
      assert.equal(attachments[0].content_type, "application/pdf");
    } finally {
      globalThis.fetch = originalFetch;
      if (previousFrom === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = previousFrom;
    }
  });

  test("migration queues contact mail once and retries the same notification row", async () => {
    const sql = await readFile(new URL("../supabase/migrations/0015_email_receipts_reviews_and_contact_notifications.sql", import.meta.url), "utf8");
    assert.match(sql, /unique index if not exists notification_outbox_contact_once_idx/);
    assert.match(sql, /template = 'admin_contact_message'/);
    assert.match(sql, /set status = 'queued'/);
    assert.doesNotMatch(sql, /set status = 'queued',\s*attempts = 0/);
    assert.match(sql, /status = 'sending'/);
  });
});
