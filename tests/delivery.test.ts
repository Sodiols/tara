import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DELIVERY_SETTINGS,
  deliveryFeeFor,
  freeDeliveryHeadline,
  quoteDelivery,
  type DeliverySettings,
} from "../lib/delivery";

/**
 * The delivery-charge rule.
 *
 * The bug these cover: the storefront and the database both priced delivery as
 * "one flat fee, waived above the threshold, anywhere in Bangladesh", while the
 * announcement bar promised — and the business intended — free delivery in
 * Sylhet only. Every order over the threshold shipping to Dhaka was therefore
 * delivered free at TARA's expense.
 *
 * `public.calculate_delivery_fee()` implements the identical branches in SQL and
 * is the authority; this module is what the customer is shown. The two must
 * agree, so every case below is one the database is expected to answer the same
 * way.
 */

const SETTINGS: DeliverySettings = {
  insideFee: 60,
  outsideFee: 120,
  freeDeliveryThreshold: 1500,
  freeDeliveryEnabled: true,
  freeDeliveryDivision: "Sylhet",
};

describe("delivery charge — inside the free-delivery division", () => {
  test("below the threshold pays the inside fee", () => {
    const quote = quoteDelivery(1499, "Sylhet", SETTINGS);
    assert.equal(quote.fee, 60);
    assert.equal(quote.isFree, false);
    assert.equal(quote.isEligibleDivision, true);
    assert.equal(quote.amountToFreeDelivery, 1);
  });

  test("exactly at the threshold is free", () => {
    // The boundary is inclusive: "orders above ৳1500" in the announcement means
    // reaching it, and the database uses >=. An off-by-one here would charge a
    // customer the site had just told they would not be charged.
    const quote = quoteDelivery(1500, "Sylhet", SETTINGS);
    assert.equal(quote.fee, 0);
    assert.equal(quote.isFree, true);
    assert.equal(quote.amountToFreeDelivery, 0);
  });

  test("above the threshold is free", () => {
    assert.equal(deliveryFeeFor(5000, "Sylhet", SETTINGS), 0);
  });
});

describe("delivery charge — everywhere else", () => {
  test("below the threshold pays the outside fee", () => {
    const quote = quoteDelivery(500, "Dhaka", SETTINGS);
    assert.equal(quote.fee, 120);
    assert.equal(quote.isEligibleDivision, false);
  });

  test("above the threshold still pays the outside fee", () => {
    // This is the case the old code got wrong.
    const quote = quoteDelivery(9999, "Dhaka", SETTINGS);
    assert.equal(quote.fee, 120);
    assert.equal(quote.isFree, false);
    assert.equal(
      quote.amountToFreeDelivery,
      null,
      "there is no amount that earns free delivery outside the eligible division",
    );
  });

  test("every other division is treated the same way", () => {
    for (const division of [
      "Barishal",
      "Chattogram",
      "Dhaka",
      "Khulna",
      "Mymensingh",
      "Rajshahi",
      "Rangpur",
    ]) {
      assert.equal(deliveryFeeFor(10_000, division, SETTINGS), 120, division);
    }
  });
});

describe("delivery charge — invalid and missing locations", () => {
  test("an unknown division is priced as outside, never as free", () => {
    // The safe direction: a display bug must not quote less than the database
    // will charge. Checkout refuses an unknown division outright, so this only
    // affects the screens shown before an address is entered.
    assert.equal(deliveryFeeFor(10_000, "Nowhere", SETTINGS), 120);
    assert.equal(deliveryFeeFor(10_000, "", SETTINGS), 120);
    assert.equal(deliveryFeeFor(10_000, null, SETTINGS), 120);
    assert.equal(deliveryFeeFor(10_000, undefined, SETTINGS), 120);
  });

  test("an upazila is not the division it sits in", () => {
    assert.equal(deliveryFeeFor(10_000, "Zakiganj", SETTINGS), 120);
  });

  test("a nonsensical subtotal is treated as zero rather than throwing", () => {
    for (const subtotal of [Number.NaN, -100, Number.POSITIVE_INFINITY]) {
      assert.doesNotThrow(() => quoteDelivery(subtotal, "Sylhet", SETTINGS));
    }
    assert.equal(deliveryFeeFor(-100, "Sylhet", SETTINGS), 60);
  });
});

describe("delivery charge — configuration", () => {
  test("turning the offer off charges the inside fee at any subtotal", () => {
    const off = { ...SETTINGS, freeDeliveryEnabled: false };
    assert.equal(deliveryFeeFor(50_000, "Sylhet", off), 60);
    assert.equal(deliveryFeeFor(50_000, "Dhaka", off), 120);
  });

  test("the eligible division is configurable, not hardcoded to Sylhet", () => {
    const dhaka = { ...SETTINGS, freeDeliveryDivision: "Dhaka" as const };
    assert.equal(deliveryFeeFor(2000, "Dhaka", dhaka), 0);
    assert.equal(deliveryFeeFor(2000, "Sylhet", dhaka), 120);
  });

  test("a negative fee in settings is clamped rather than credited", () => {
    const broken = { ...SETTINGS, insideFee: -50, outsideFee: -50 };
    assert.equal(deliveryFeeFor(100, "Sylhet", broken), 0);
    assert.equal(deliveryFeeFor(100, "Dhaka", broken), 0);
  });

  test("the defaults match what the database falls back to", () => {
    assert.equal(DEFAULT_DELIVERY_SETTINGS.freeDeliveryThreshold, 1500);
    assert.equal(DEFAULT_DELIVERY_SETTINGS.freeDeliveryDivision, "Sylhet");
    assert.equal(DEFAULT_DELIVERY_SETTINGS.freeDeliveryEnabled, true);
  });
});

describe("the promise shown to customers", () => {
  test("names the configured division and threshold", () => {
    assert.equal(
      freeDeliveryHeadline(SETTINGS),
      "Free delivery in Sylhet on orders above ৳1,500",
    );
  });

  test("changes with the settings rather than staying hardcoded", () => {
    assert.equal(
      freeDeliveryHeadline({ ...SETTINGS, freeDeliveryThreshold: 2500 }),
      "Free delivery in Sylhet on orders above ৳2,500",
    );
  });

  test("says nothing at all when the offer is switched off", () => {
    assert.equal(freeDeliveryHeadline({ ...SETTINGS, freeDeliveryEnabled: false }), null);
  });
});
