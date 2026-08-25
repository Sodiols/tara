import test, { describe, before } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SKIP_REASON, anonClient, hasDatabase, signedInClient } from "./client";

/**
 * Row level security, proved against a real database.
 *
 * Every assertion here is made through the anon key with a real session, which
 * is exactly what a browser has. No service-role key is used, so nothing here
 * can accidentally test a path that bypasses the policies it is checking.
 *
 * The shape of each test is "this role tries to do the thing it must not be
 * able to do, and fails". A policy that is missing shows up as a passing write
 * or a returned row, not as an error.
 */

describe("row level security", { skip: hasDatabase ? false : SKIP_REASON }, () => {
  let anon: SupabaseClient;
  let customer: SupabaseClient | null = null;
  let otherCustomer: SupabaseClient | null = null;
  let support: SupabaseClient | null = null;
  let fulfilment: SupabaseClient | null = null;

  before(async () => {
    anon = anonClient();
    customer = await signedInClient("TEST_CUSTOMER");
    otherCustomer = await signedInClient("TEST_CUSTOMER_B");
    support = await signedInClient("TEST_SUPPORT");
    fulfilment = await signedInClient("TEST_FULFILMENT");
  });

  describe("anonymous visitor", () => {
    test("can read active products", async () => {
      const { error } = await anon.from("products").select("id,slug").eq("status", "active").limit(1);
      assert.equal(error, null);
    });

    test("cannot read any order", async () => {
      const { data } = await anon.from("orders").select("id").limit(1);
      assert.deepEqual(data ?? [], []);
    });

    test("cannot read any profile", async () => {
      const { data } = await anon.from("profiles").select("id").limit(1);
      assert.deepEqual(data ?? [], []);
    });

    test("cannot read the newsletter list", async () => {
      const { data, error } = await anon.from("newsletter_subscribers").select("email").limit(1);
      assert.ok(error || (data ?? []).length === 0, "the subscriber list must not be readable");
    });

    test("cannot read contact messages", async () => {
      const { data, error } = await anon.from("contact_messages").select("email").limit(1);
      assert.ok(error || (data ?? []).length === 0);
    });

    test("cannot read a private store setting", async () => {
      const { data } = await anon
        .from("store_settings")
        .select("key")
        .eq("key", "order_notification_email");
      assert.deepEqual(data ?? [], [], "private settings must not be world-readable");
    });

    test("can read the public delivery settings it needs to quote a price", async () => {
      const { data } = await anon
        .from("store_settings")
        .select("key,value")
        .in("key", ["delivery_fee_inside_sylhet", "free_delivery_threshold"]);
      assert.ok((data ?? []).length > 0);
    });

    test("cannot write a product", async () => {
      const { error } = await anon.from("products").insert({
        slug: `rls-probe-${Date.now()}`,
        name_en: "RLS probe",
      } as never);
      assert.ok(error, "an anonymous product insert must be refused");
    });

    test("cannot move stock directly", async () => {
      const { data: variant } = await anon
        .from("product_variants")
        .select("id,stock_quantity")
        .limit(1)
        .maybeSingle();
      if (!variant) return;
      const { error } = await anon
        .from("product_variants")
        .update({ stock_quantity: 9999 })
        .eq("id", variant.id);
      assert.ok(error, "stock must only move through place_order or admin_adjust_inventory");
    });

    test("cannot consume a rate-limit bucket with a limit of its own choosing", async () => {
      const { error } = await anon.rpc("consume_rate_limit", {
        p_bucket: "order:phone",
        p_identifier: "01700000000",
        p_limit: 1_000_000,
        p_window_seconds: 1,
      } as never);
      assert.ok(error, "consume_rate_limit must not be callable by a client");
    });

    test("cannot unsubscribe anyone by email address", async () => {
      // The old, insecure entry point. Migration 0012 dropped it.
      const { error } = await anon.rpc("unsubscribe_newsletter", {
        p_email: "someone@example.com",
      } as never);
      assert.ok(error, "the email-based unsubscribe RPC must no longer exist");
    });

    test("a made-up unsubscribe token does nothing", async () => {
      const { data, error } = await anon.rpc("unsubscribe_newsletter_by_token", {
        p_token: "f".repeat(48),
      });
      assert.equal(error, null);
      assert.equal(data, false);
    });
  });

  describe("signed-in customer", () => {
    test("sees only their own orders", async (t) => {
      if (!customer || !otherCustomer) return t.skip("Two customer accounts are not configured.");

      const { data: mine } = await customer.from("orders").select("id,user_id");
      const { data: theirs } = await otherCustomer.from("orders").select("id,user_id");

      const myIds = new Set((mine ?? []).map((row) => row.id));
      for (const order of theirs ?? []) {
        assert.equal(myIds.has(order.id), false, "one customer can see another's order");
      }
    });

    test("cannot read another customer's address book", async (t) => {
      if (!customer) return t.skip("No customer account configured.");
      const { data } = await customer.from("addresses").select("user_id");
      const {
        data: { user },
      } = await customer.auth.getUser();
      for (const row of data ?? []) {
        assert.equal(row.user_id, user?.id, "addresses must be visible to their owner only");
      }
    });

    test("cannot change their own role", async (t) => {
      if (!customer) return t.skip("No customer account configured.");
      const {
        data: { user },
      } = await customer.auth.getUser();
      const { error } = await customer
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", user?.id ?? "");
      assert.ok(error, "self-promotion to admin must be blocked by the role guard trigger");
    });

    test("cannot save an address for an impossible location", async (t) => {
      if (!customer) return t.skip("No customer account configured.");
      const {
        data: { user },
      } = await customer.auth.getUser();
      const { error } = await customer.from("addresses").insert({
        user_id: user?.id,
        recipient_name: "RLS probe",
        phone: "01712345678",
        division: "Sylhet",
        district: "Dhaka",
        full_address: "House 12, Road 3",
      } as never);
      assert.ok(error, "a district under the wrong division must be refused");
    });

    test("cannot read the audit log", async (t) => {
      if (!customer) return t.skip("No customer account configured.");
      const { data } = await customer.from("admin_audit_log").select("id").limit(1);
      assert.deepEqual(data ?? [], []);
    });
  });

  describe("support staff", () => {
    test("cannot edit the catalogue", async (t) => {
      if (!support) return t.skip("No support account configured.");
      const { data: product } = await support.from("products").select("id").limit(1).maybeSingle();
      if (!product) return t.skip("No products to probe.");

      const { error } = await support
        .from("products")
        .update({ base_price: 1 })
        .eq("id", product.id);
      assert.ok(error, "support must not hold catalogue.manage");
    });

    test("cannot delete a product image", async (t) => {
      if (!support) return t.skip("No support account configured.");
      const { data: image } = await support
        .from("product_images")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (!image) return t.skip("No product images to probe.");

      const { error } = await support.rpc("delete_product_image", { p_image_id: image.id });
      assert.ok(error, "support must not be able to delete catalogue imagery");
    });

    test("cannot upload into the product image bucket", async (t) => {
      if (!support) return t.skip("No support account configured.");
      const { error } = await support.storage
        .from("product-images")
        .upload(`rls-probe/${Date.now()}.jpg`, new Blob([new Uint8Array([0xff, 0xd8, 0xff])]), {
          contentType: "image/jpeg",
        });
      assert.ok(error, "storage writes must require catalogue.manage, not merely a staff login");
    });
  });

  describe("fulfilment staff", () => {
    test("cannot delete a product image", async (t) => {
      if (!fulfilment) return t.skip("No fulfilment account configured.");
      const { data: image } = await fulfilment
        .from("product_images")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (!image) return t.skip("No product images to probe.");

      const { error } = await fulfilment.rpc("delete_product_image", { p_image_id: image.id });
      assert.ok(error, "fulfilment must not inherit catalogue image permissions");
    });

    test("cannot change store settings", async (t) => {
      if (!fulfilment) return t.skip("No fulfilment account configured.");
      const { error } = await fulfilment.rpc("admin_save_settings", {
        p_settings: { free_delivery_threshold: 0 },
      });
      assert.ok(error, "settings.manage is admin-only");
    });

    test("cannot change a staff member's role", async (t) => {
      if (!fulfilment) return t.skip("No fulfilment account configured.");
      const {
        data: { user },
      } = await fulfilment.auth.getUser();
      const { error } = await fulfilment.rpc("set_profile_role", {
        p_profile_id: user?.id ?? "",
        p_role: "admin",
      });
      assert.ok(error, "staff.manage is admin-only");
    });
  });
});
