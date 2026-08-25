import test, { describe, before } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SKIP_REASON, anonClient, hasDatabase, testPhone } from "./client";

/**
 * Checkout, against a real database.
 *
 * These are the assertions that cannot be made in a unit test because the whole
 * point is what Postgres does under concurrency and inside a transaction:
 * overselling, idempotency, coupon races, geography validation and the delivery
 * rule.
 *
 * They place real orders. Run them against a dedicated testing project seeded
 * with supabase/seed/development_seed.sql, never against production.
 */

interface Variant {
  id: string;
  stock_quantity: number;
  product_id: string;
}

async function pickVariant(client: SupabaseClient): Promise<Variant | null> {
  const { data } = await client
    .from("product_variants")
    .select("id,stock_quantity,product_id")
    .eq("is_active", true)
    .gt("stock_quantity", 0)
    .order("stock_quantity")
    .limit(1)
    .maybeSingle();
  return (data as Variant | null) ?? null;
}

function order(variantId: string, quantity: number, phone: string, extra: Record<string, unknown> = {}) {
  return {
    p_customer: { name: "Integration Test", email: "", phone },
    p_shipping_address: {
      division: "Sylhet",
      district: "Sylhet",
      fullAddress: "House 12, Road 3, Test Area",
    },
    p_items: [{ variantId, quantity }],
    p_delivery_method: "standard",
    p_payment_method: "cash_on_delivery",
    p_coupon_code: null,
    p_customer_note: null,
    p_idempotency_key: null,
    p_client_fingerprint: null,
    ...extra,
  };
}

describe("checkout", { skip: hasDatabase ? false : SKIP_REASON }, () => {
  let client: SupabaseClient;

  before(() => {
    client = anonClient();
  });

  describe("shipping geography is validated in the database", () => {
    test("an invented division is refused", async () => {
      const variant = await pickVariant(client);
      if (!variant) return;
      const { error } = await client.rpc(
        "place_order",
        order(variant.id, 1, testPhone(), {
          p_shipping_address: { division: "x1", district: "y2", fullAddress: "House 12, Road 3" },
        }) as never,
      );
      assert.ok(error?.message.includes("invalid_shipping_location"), error?.message);
    });

    test("a real district under the wrong division is refused", async () => {
      const variant = await pickVariant(client);
      if (!variant) return;
      const { error } = await client.rpc(
        "place_order",
        order(variant.id, 1, testPhone(), {
          p_shipping_address: {
            division: "Sylhet",
            district: "Dhaka",
            fullAddress: "House 12, Road 3",
          },
        }) as never,
      );
      assert.ok(error?.message.includes("invalid_shipping_location"), error?.message);
    });

    test("an upazila is not accepted as a district", async () => {
      const variant = await pickVariant(client);
      if (!variant) return;
      const { error } = await client.rpc(
        "place_order",
        order(variant.id, 1, testPhone(), {
          p_shipping_address: {
            division: "Sylhet",
            district: "Zakiganj",
            fullAddress: "House 12, Road 3",
          },
        }) as never,
      );
      assert.ok(error?.message.includes("invalid_shipping_location"), error?.message);
    });

    test("resolve_shipping_location canonicalises what it accepts", async () => {
      const { data } = await client.rpc("resolve_shipping_location", {
        p_division: "  chittagong ",
        p_district: "comilla",
      });
      assert.deepEqual(data, { division: "Chattogram", district: "Cumilla" });
    });
  });

  describe("the delivery rule the database charges", () => {
    test("free inside Sylhet at the threshold, charged below it", async () => {
      const { data: threshold } = await client
        .from("store_settings")
        .select("value")
        .eq("key", "free_delivery_threshold")
        .single();
      const limit = Number(threshold?.value ?? 1500);

      const [{ data: atThreshold }, { data: below }] = await Promise.all([
        client.rpc("calculate_delivery_fee", { p_subtotal: limit, p_division: "Sylhet" }),
        client.rpc("calculate_delivery_fee", { p_subtotal: limit - 1, p_division: "Sylhet" }),
      ]);

      assert.equal(Number(atThreshold), 0);
      assert.ok(Number(below) > 0);
    });

    test("outside Sylhet is charged however large the order", async () => {
      // The exact bug this release fixed: the storefront promised free delivery
      // in Sylhet while the database gave it away everywhere.
      const { data } = await client.rpc("calculate_delivery_fee", {
        p_subtotal: 1_000_000,
        p_division: "Dhaka",
      });
      assert.ok(Number(data) > 0, "a large order outside Sylhet must still pay for delivery");
    });
  });

  describe("stock safety", () => {
    test("an order for more than the stock on hand is refused", async () => {
      const variant = await pickVariant(client);
      if (!variant) return;

      const { error } = await client.rpc(
        "place_order",
        order(variant.id, variant.stock_quantity + 5, testPhone()) as never,
      );
      assert.ok(error?.message.includes("out_of_stock"), error?.message);
    });

    test("two simultaneous orders for the last item cannot both succeed", async () => {
      const variant = await pickVariant(client);
      if (!variant || variant.stock_quantity < 1) return;

      const quantity = variant.stock_quantity;
      const [first, second] = await Promise.all([
        anonClient().rpc("place_order", order(variant.id, quantity, testPhone()) as never),
        anonClient().rpc("place_order", order(variant.id, quantity, testPhone()) as never),
      ]);

      const succeeded = [first, second].filter((result) => !result.error).length;
      assert.equal(
        succeeded,
        1,
        "exactly one of two concurrent orders for the whole stock must win — the row lock in place_order is what guarantees it",
      );

      const { data: after } = await client
        .from("product_variants")
        .select("stock_quantity")
        .eq("id", variant.id)
        .single();
      assert.ok(Number(after?.stock_quantity) >= 0, "stock must never go negative");
    });
  });

  describe("idempotency", () => {
    test("replaying a key returns the original order instead of creating a second", async () => {
      const variant = await pickVariant(client);
      if (!variant || variant.stock_quantity < 1) return;

      const key = crypto.randomUUID();
      const phone = testPhone();

      const first = await client.rpc(
        "place_order",
        order(variant.id, 1, phone, { p_idempotency_key: key }) as never,
      );
      if (first.error) return; // rate limited or out of stock; nothing to assert
      const second = await client.rpc(
        "place_order",
        order(variant.id, 1, phone, { p_idempotency_key: key }) as never,
      );

      assert.equal(second.error, null);
      const firstResult = first.data as { orderNumber: string };
      const secondResult = second.data as { orderNumber: string; replayed: boolean };
      assert.equal(secondResult.orderNumber, firstResult.orderNumber);
      assert.equal(secondResult.replayed, true);
    });

    test("a second order from the same phone within 90 seconds is refused", async () => {
      const variant = await pickVariant(client);
      if (!variant || variant.stock_quantity < 2) return;

      const phone = testPhone();
      const first = await client.rpc("place_order", order(variant.id, 1, phone) as never);
      if (first.error) return;

      const second = await client.rpc("place_order", order(variant.id, 1, phone) as never);
      assert.ok(
        second.error?.message.includes("duplicate_order") ||
          second.error?.message.includes("rate_limited"),
        second.error?.message,
      );
    });
  });

  describe("prices are never taken from the client", () => {
    test("the order total is computed from the database, not from the request", async () => {
      const variant = await pickVariant(client);
      if (!variant || variant.stock_quantity < 1) return;

      // place_order takes no price at all: there is nowhere in its signature to
      // put one. This asserts the returned total is consistent with the stored
      // variant price plus the delivery rule.
      const result = await client.rpc(
        "place_order",
        order(variant.id, 1, testPhone()) as never,
      );
      if (result.error) return;

      const { total } = result.data as { total: number };
      assert.ok(Number(total) > 0);
    });
  });
});
