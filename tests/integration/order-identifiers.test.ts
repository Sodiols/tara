import test, { describe, before } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SKIP_REASON, anonClient, hasDatabase, signedInClient, testPhone } from "./client";
import {
  ORDER_NUMBER_PATTERN,
  TRACKING_TOKEN_PATTERN,
} from "../../lib/order-identifiers";

/**
 * Order numbers and tracking tokens (migration 0027), against a real database.
 *
 * What the unit suite can only read in the migration's text, this proves by
 * running it: new orders get identifiers in the new shapes, a replayed
 * idempotency key returns the same ones, concurrent orders never share one, a
 * caller cannot supply its own, and the public lookup returns the allowlist and
 * nothing else. Collision retry and the immutability trigger need the database
 * owner, not the anon key, so they are covered by
 * supabase/tests/0027_order_identifiers.sql.
 *
 * Places real orders. Run against a dedicated testing project only.
 */

interface Placed {
  orderNumber: string;
  trackingToken: string;
  total: number;
  replayed: boolean;
}

async function pickVariant(client: SupabaseClient, minimumStock = 1) {
  const { data } = await client
    .from("product_variants")
    .select("id,stock_quantity")
    .eq("is_active", true)
    .gte("stock_quantity", minimumStock)
    .order("stock_quantity", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string; stock_quantity: number } | null) ?? null;
}

function order(variantId: string, phone: string, extra: Record<string, unknown> = {}) {
  return {
    p_customer: { name: "Identifier Test", email: "identifier-test@example.com", phone },
    p_shipping_address: {
      address: "House 12, Road 3, Test Area",
      city: "Sylhet",
      deliveryZone: "inside_sylhet",
    },
    p_items: [{ variantId, quantity: 1 }],
    p_delivery_method: "standard",
    p_payment_method: "cash_on_delivery",
    p_coupon_code: null,
    p_customer_note: null,
    p_idempotency_key: null,
    p_client_fingerprint: null,
    ...extra,
  };
}

/** YY-MM in the store's time zone, which is what the order number carries. */
function storeYearMonth(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "2-digit",
    month: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}`;
}

describe("order identifiers", { skip: hasDatabase ? false : SKIP_REASON }, () => {
  let client: SupabaseClient;
  let placed: Placed | null = null;

  before(async () => {
    client = anonClient();
    const variant = await pickVariant(client);
    if (!variant) return;
    const { data, error } = await client.rpc("place_order", order(variant.id, testPhone()) as never);
    if (!error) placed = data as Placed;
  });

  test("a new guest order receives a TARA-YY-MM order number and a TRK- token", (t) => {
    if (!placed) return t.skip("No order could be placed (no stock, or rate limited).");
    assert.match(placed.orderNumber, ORDER_NUMBER_PATTERN);
    assert.match(placed.trackingToken, TRACKING_TOKEN_PATTERN);
    // Checked either side of midnight on the first of a month.
    const now = new Date();
    const months = new Set([storeYearMonth(new Date(now.getTime() - 60_000)), storeYearMonth(now)]);
    assert.ok(months.has(placed.orderNumber.slice(5, 10)), `${placed.orderNumber} is not this month`);
    assert.equal(placed.replayed, false);
    // The token is not derived from the order number, or vice versa.
    assert.ok(!placed.trackingToken.includes(placed.orderNumber.slice(-10)));
  });

  test("a signed-in customer's order gets the same shapes", async (t) => {
    const customer = await signedInClient("TEST_CUSTOMER");
    if (!customer) return t.skip("No customer account configured.");
    const variant = await pickVariant(customer);
    if (!variant) return t.skip("No stock.");
    const { data, error } = await customer.rpc("place_order", order(variant.id, testPhone()) as never);
    if (error) return t.skip(`Could not place an order: ${error.message}`);
    const result = data as Placed;
    assert.match(result.orderNumber, ORDER_NUMBER_PATTERN);
    assert.match(result.trackingToken, TRACKING_TOKEN_PATTERN);

    // Their order history lists it under its public number.
    const { data: history } = await customer.from("orders").select("order_number").eq("order_number", result.orderNumber);
    assert.equal(history?.length, 1);
  });

  test("replaying an idempotency key returns the same order number and token", async (t) => {
    const variant = await pickVariant(client);
    if (!variant) return t.skip("No stock.");
    const key = crypto.randomUUID();
    const phone = testPhone();
    const first = await client.rpc("place_order", order(variant.id, phone, { p_idempotency_key: key }) as never);
    if (first.error) return t.skip(`Could not place an order: ${first.error.message}`);
    const second = await client.rpc("place_order", order(variant.id, phone, { p_idempotency_key: key }) as never);
    assert.equal(second.error, null);
    const a = first.data as Placed;
    const b = second.data as Placed;
    assert.equal(b.replayed, true);
    assert.equal(b.orderNumber, a.orderNumber);
    assert.equal(b.trackingToken, a.trackingToken);
  });

  test("concurrent orders never share an order number or a token", async (t) => {
    const variant = await pickVariant(client, 6);
    if (!variant) return t.skip("Not enough stock for a concurrent batch.");
    const results = await Promise.all(
      Array.from({ length: 5 }, () => client.rpc("place_order", order(variant.id, testPhone()) as never)),
    );
    const orders = results.filter((result) => !result.error).map((result) => result.data as Placed);
    if (orders.length < 2) return t.skip("Too few concurrent orders succeeded to compare.");
    assert.equal(new Set(orders.map((o) => o.orderNumber)).size, orders.length);
    assert.equal(new Set(orders.map((o) => o.trackingToken)).size, orders.length);
  });

  test("a caller cannot supply an order number or token", async (t) => {
    const variant = await pickVariant(client);
    if (!variant) return t.skip("No stock.");

    // As an extra RPC argument: PostgREST finds no function with that
    // parameter, so nothing is created at all.
    const named = await client.rpc("place_order", {
      ...order(variant.id, testPhone()),
      p_order_number: "TARA-26-09-AAAAAAAAAA",
      p_tracking_token: "TRK-AAAAAAAAAAAAAAAAAAAA",
    } as never);
    assert.ok(named.error, "place_order accepted an order number parameter");

    // Smuggled inside the customer object: ignored.
    const smuggled = await client.rpc("place_order", order(variant.id, testPhone(), {
      p_customer: {
        name: "Identifier Test",
        email: "identifier-test@example.com",
        phone: testPhone(),
        orderNumber: "TARA-26-09-AAAAAAAAAA",
        order_number: "TARA-26-09-AAAAAAAAAA",
        trackingToken: "TRK-AAAAAAAAAAAAAAAAAAAA",
        tracking_token: "TRK-AAAAAAAAAAAAAAAAAAAA",
      },
    }) as never);
    if (smuggled.error) return t.skip(`Could not place an order: ${smuggled.error.message}`);
    const result = smuggled.data as Placed;
    assert.notEqual(result.orderNumber, "TARA-26-09-AAAAAAAAAA");
    assert.notEqual(result.trackingToken, "TRK-AAAAAAAAAAAAAAAAAAAA");

    // And a client cannot write the table directly.
    const direct = await client.from("orders").insert({ order_number: "TARA-26-09-BBBBBBBBBB" } as never);
    assert.ok(direct.error, "anon inserted into orders");
  });

  test("public tracking works with the token and returns only allowlisted fields", async (t) => {
    if (!placed) return t.skip("No order was placed.");
    const { data, error } = await client.rpc("get_order_tracking", { p_tracking_token: placed.trackingToken });
    assert.equal(error, null);
    const snapshot = data as Record<string, unknown>;
    assert.equal(snapshot.orderNumber, placed.orderNumber);
    assert.deepEqual(
      Object.keys(snapshot).sort(),
      ["currency", "deliveryZone", "events", "items", "orderNumber", "paymentMethod", "placedAt", "status", "total", "updatedAt"],
    );
    const serialised = JSON.stringify(snapshot);
    for (const secret of ["Identifier Test", "identifier-test@example.com", "House 12", "Test Area", placed.trackingToken, "customer", "phone", "email", "address", "userId", "\"id\""]) {
      assert.ok(!serialised.includes(secret), `tracking response contains ${secret}`);
    }
  });

  test("public tracking does not work with the order number, the internal id or a guess", async (t) => {
    if (!placed) return t.skip("No order was placed.");
    const staff = await signedInClient("TEST_ADMIN");
    const { data: row } = staff
      ? await staff.from("orders").select("id").eq("order_number", placed.orderNumber).maybeSingle()
      : { data: null };

    for (const guess of [
      placed.orderNumber,
      (row as { id: string } | null)?.id ?? "16de7294-88bb-486e-95b5-fd8cbea83c0a",
      "18427",
      "TRK-AAAAAAAAAAAAAAAAAAAA",
      placed.trackingToken.toLowerCase(),
      placed.trackingToken.slice(0, -1),
      `${placed.trackingToken.slice(0, 10)}%`,
      "",
    ]) {
      const { data, error } = await client.rpc("get_order_tracking", { p_tracking_token: guess });
      assert.equal(error, null, `a malformed token must be a quiet null, not an error: ${guess}`);
      assert.equal(data, null, `tracked an order with ${guess}`);
    }
  });

  test("anonymous visitors still cannot read orders directly", async () => {
    const { data } = await client.from("orders").select("id,order_number,tracking_token").limit(5);
    assert.deepEqual(data ?? [], []);
  });

  test("the confirmation-time receipt still downloads with the token", async (t) => {
    if (!placed) return t.skip("No order was placed.");
    const { data, error } = await client.rpc("get_customer_receipt", {
      p_order_number: placed.orderNumber,
      p_tracking_token: placed.trackingToken,
    });
    assert.equal(error, null);
    assert.equal((data as { order?: { orderNumber?: string } } | null)?.order?.orderNumber, placed.orderNumber);
  });

  test("one customer cannot open another customer's order", async (t) => {
    const customer = await signedInClient("TEST_CUSTOMER");
    const other = await signedInClient("TEST_CUSTOMER_B");
    if (!customer || !other) return t.skip("Two customer accounts are not configured.");
    const { data: mine } = await customer.from("orders").select("order_number").limit(1).maybeSingle();
    if (!mine) return t.skip("The first customer has no orders.");
    const { data } = await other
      .from("orders")
      .select("order_number")
      .eq("order_number", (mine as { order_number: string }).order_number);
    assert.deepEqual(data ?? [], []);
  });
});
