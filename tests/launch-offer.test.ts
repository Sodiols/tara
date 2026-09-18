import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  applyOfferToTotals,
  offerBadge,
  offerIncludesProduct,
  offerIsLive,
  offerIsQuotable,
  offerSentence,
  quoteOffer,
  type LaunchOffer,
} from "../lib/launch-offer";

/**
 * The launch offer.
 *
 * The rule this file exists to hold: THE NUMBER SHOWN IS THE NUMBER CHARGED.
 * `quoteOffer()` is what a customer reads in the bag and at checkout;
 * `launch_offer_benefit()` in migration 0026 is what `place_order()` actually
 * applies. Every case below is one the database is expected to answer the same
 * way, and the last block reads the migration to check that the bounds really
 * are the same in both — the same shape as tests/delivery.test.ts, for the same
 * reason.
 *
 * The other rule: NOTHING IS OFFERED BY DEFAULT. A disabled offer, an expired
 * one, one that has not started, and a basket that does not qualify all produce
 * no discount and no badge.
 */

const migration = readFile(
  new URL("../supabase/migrations/0026_launch_offer_and_first_party_analytics.sql", import.meta.url),
  "utf8",
);

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function offer(overrides: Partial<LaunchOffer> = {}): LaunchOffer {
  return {
    title: "TARA Launch Week",
    description: "",
    offerType: "percentage",
    appliesTo: "selected_products",
    discountValue: 20,
    minimumOrderAmount: 0,
    giftDescription: "",
    startsAt: null,
    endsAt: null,
    productIds: [PRODUCT],
    heroSlugs: [],
    ...overrides,
  };
}

describe("who the offer applies to", () => {
  test("a selected-products offer covers only its products", () => {
    assert.equal(offerIncludesProduct(offer(), PRODUCT), true);
    assert.equal(offerIncludesProduct(offer(), OTHER), false);
  });

  test("a site-wide offer covers everything, including products it never lists", () => {
    const siteWide = offer({ appliesTo: "site_wide", productIds: [] });
    assert.equal(offerIncludesProduct(siteWide, OTHER), true);
  });

  test("a basket with no participating product gets nothing", () => {
    assert.equal(quoteOffer(offer(), 5000, [OTHER]), null);
  });
});

describe("the offer's window", () => {
  const now = new Date("2026-03-12T12:00:00Z");

  test("before it starts, nothing", () => {
    const upcoming = offer({ startsAt: "2026-03-13T00:00:00Z" });
    assert.equal(offerIsLive(upcoming, now), false);
    assert.equal(quoteOffer(upcoming, 5000, [PRODUCT], now), null);
  });

  test("after it ends, nothing — this is the expiry case", () => {
    const expired = offer({ endsAt: "2026-03-12T11:59:59Z" });
    assert.equal(offerIsLive(expired, now), false);
    assert.equal(quoteOffer(expired, 5000, [PRODUCT], now), null);
  });

  test("inside the window it applies", () => {
    const live = offer({ startsAt: "2026-03-01T00:00:00Z", endsAt: "2026-03-20T00:00:00Z" });
    assert.equal(offerIsLive(live, now), true);
    assert.equal(quoteOffer(live, 1000, [PRODUCT], now)?.discount, 200);
  });

  test("no dates at all means it runs until it is switched off", () => {
    assert.equal(offerIsLive(offer(), now), true);
  });
});

describe("what each offer type is worth", () => {
  test("free delivery waives the charge and discounts nothing", () => {
    const quote = quoteOffer(offer({ offerType: "free_delivery", discountValue: null }), 1000, [
      PRODUCT,
    ]);
    assert.deepEqual(quote, { discount: 0, freeDelivery: true, label: "TARA Launch Week" });
  });

  test("a percentage comes off the goods", () => {
    assert.equal(quoteOffer(offer({ discountValue: 15 }), 2000, [PRODUCT])?.discount, 300);
  });

  test("a percentage is capped at 90, exactly as the database caps it", () => {
    // A mistyped 1000 must not make the order free.
    assert.equal(quoteOffer(offer({ discountValue: 1000 }), 1000, [PRODUCT])?.discount, 900);
  });

  test("a fixed amount never exceeds the goods", () => {
    const large = offer({ offerType: "fixed_amount", discountValue: 5000 });
    assert.equal(quoteOffer(large, 1200, [PRODUCT])?.discount, 1200);
  });

  test("below the minimum, nothing", () => {
    const withMinimum = offer({ minimumOrderAmount: 2000 });
    assert.equal(quoteOffer(withMinimum, 1999, [PRODUCT]), null);
    assert.equal(quoteOffer(withMinimum, 2000, [PRODUCT])?.discount, 400);
  });

  test("a first-order offer is never quoted before checkout", () => {
    // Whether this is somebody's first order depends on their phone number,
    // which the shop does not know while they are browsing. Quoting it would
    // show a saving the order might not get.
    const firstOrder = offer({ offerType: "first_order", discountValue: 10 });
    assert.equal(offerIsQuotable(firstOrder), false);
    assert.equal(quoteOffer(firstOrder, 5000, [PRODUCT]), null);
  });

  test("a gift carries no money", () => {
    const gift = offer({ offerType: "gift", giftDescription: "A TARA scrunchie" });
    assert.equal(quoteOffer(gift, 5000, [PRODUCT]), null);
  });
});

describe("applying the offer to a basket", () => {
  const baseline = { subtotal: 2000, deliveryFee: 120, couponDiscount: 0 };

  test("free delivery removes the charge and nothing else", () => {
    const totals = applyOfferToTotals({
      ...baseline,
      quote: { discount: 0, freeDelivery: true, label: "Launch" },
    });
    assert.deepEqual(totals, { deliveryFee: 0, offerDiscount: 0, total: 2000 });
  });

  test("a money offer comes off the goods and leaves delivery alone", () => {
    const totals = applyOfferToTotals({
      ...baseline,
      quote: { discount: 400, freeDelivery: false, label: "Launch" },
    });
    assert.deepEqual(totals, { deliveryFee: 120, offerDiscount: 400, total: 1720 });
  });

  test("it stacks with a coupon, clamped so the goods never go below zero", () => {
    const totals = applyOfferToTotals({
      subtotal: 1000,
      deliveryFee: 120,
      couponDiscount: 800,
      quote: { discount: 500, freeDelivery: false, label: "Launch" },
    });
    // 800 of coupon leaves 200 of goods, so that is all the offer can take.
    assert.equal(totals.offerDiscount, 200);
    // The delivery charge is still owed: a discount on goods is not a discount
    // on delivery.
    assert.equal(totals.total, 120);
  });

  test("no offer changes nothing", () => {
    const totals = applyOfferToTotals({ ...baseline, quote: null });
    assert.deepEqual(totals, { deliveryFee: 120, offerDiscount: 0, total: 2120 });
  });
});

describe("the words a customer reads", () => {
  test("the badge says what is given", () => {
    assert.equal(offerBadge(offer({ offerType: "free_delivery" })), "Free delivery");
    assert.equal(offerBadge(offer({ discountValue: 20 })), "20% off");
    assert.equal(offerBadge(offer({ offerType: "fixed_amount", discountValue: 200 })), "৳200 off");
    assert.equal(offerBadge(offer({ offerType: "gift" })), "Free gift");
  });

  test("the sentence states the condition, so it is not discovered at checkout", () => {
    const sentence = offerSentence(offer({ minimumOrderAmount: 1500 }));
    assert.match(sentence, /20% off/);
    assert.match(sentence, /selected pieces/);
    assert.match(sentence, /1,500/);
  });

  test("a percentage is written as a person would write it", () => {
    assert.equal(offerBadge(offer({ discountValue: 20 })), "20% off");
    assert.equal(offerBadge(offer({ discountValue: 12.5 })), "12.5% off");
  });
});

describe("the database is the authority", () => {
  test("it ships disabled, with no dates and no discount", async () => {
    const sql = await migration;
    assert.match(sql, /is_enabled boolean not null default false/);
    assert.match(sql, /insert into public\.launch_offer \(id\) values \(1\) on conflict \(id\) do nothing/);
    // Nothing in the migration switches it on or fills in a discount.
    assert.doesNotMatch(sql, /update public\.launch_offer\s+set is_enabled = true/);
  });

  test("only one offer can ever exist", async () => {
    const sql = await migration;
    assert.match(sql, /id smallint primary key default 1 check \(id = 1\)/);
  });

  test("the benefit function re-checks the window, the minimum and participation", async () => {
    const sql = await migration;
    const fn = sql.slice(
      sql.indexOf("function public.launch_offer_benefit"),
      sql.indexOf("revoke execute on function public.launch_offer_benefit"),
    );
    assert.match(fn, /if not found or not offer\.is_enabled then return null; end if;/);
    assert.match(fn, /offer\.starts_at > now\(\)/);
    assert.match(fn, /offer\.ends_at <= now\(\)/);
    assert.match(fn, /< offer\.minimum_order_amount then return null/);
    assert.match(fn, /from public\.launch_offer_products lp/);
    // The same 90% ceiling the TypeScript quote applies.
    assert.match(fn, /least\(greatest\(coalesce\(offer\.discount_value, 0\), 0\), 90\)/);
  });

  test("the benefit function is not callable by a client", async () => {
    const sql = await migration;
    assert.match(
      sql,
      /revoke execute on function public\.launch_offer_benefit\(numeric, uuid\[\], boolean\) from public/,
    );
    assert.doesNotMatch(
      sql,
      /grant execute on function public\.launch_offer_benefit[^;]*to (anon|authenticated)/,
    );
  });

  test("place_order applies the offer itself and takes no discount from the caller", async () => {
    const sql = await migration;
    const fn = sql.slice(sql.indexOf("create or replace function public.place_order"));
    assert.match(fn, /offer := public\.launch_offer_benefit\(/);
    assert.match(fn, /first_order := not exists \(/);
    assert.match(fn, /launch_offer_discount, launch_offer_label/);
    // The signature still has nowhere to put a price or an offer.
    const signature = fn.slice(0, fn.indexOf(")"));
    assert.doesNotMatch(signature, /discount|offer|price/i);
  });

  test("an offer a visitor may see is one that is live", async () => {
    const sql = await migration;
    const policy = sql.slice(
      sql.indexOf("create policy launch_offer_public_read"),
      sql.indexOf("create policy launch_offer_staff_manage"),
    );
    assert.match(policy, /is_enabled/);
    assert.match(policy, /starts_at is null or starts_at <= now\(\)/);
    assert.match(policy, /ends_at is null or ends_at > now\(\)/);
    assert.match(policy, /public\.is_staff\(\)/);
  });
});
