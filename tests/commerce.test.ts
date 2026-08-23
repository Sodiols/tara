import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  formatTaka,
  formatTakaCompact,
  fromPoisha,
  isoToStoreLocal,
  multiplyTaka,
  startOfStoreDay,
  storeLocalToIso,
  sumTaka,
  toPoisha,
} from "../lib/format";
import {
  formatBdPhone,
  isValidBdPhone,
  normalizeBdPhone,
  toInternationalBdPhone,
  toWhatsAppNumber,
} from "../lib/phone";
import {
  adminCategorySchema,
  adminCouponSchema,
  adminProductSchema,
  checkoutSchema,
  contactSchema,
} from "../lib/validation";
import { slugify } from "../lib/utils";

/**
 * Money, phone numbers, dates and input validation.
 *
 * Money is the one place where a rounding slip becomes a real financial
 * discrepancy, and the phone number is the key the COD abuse throttle is built
 * on — if two spellings of the same number normalise differently, the limit is
 * trivially bypassed.
 */

describe("money", () => {
  test("converts Taka to integer poisha without float drift", () => {
    assert.equal(toPoisha(0.1), 10);
    assert.equal(toPoisha(0.29), 29);
    assert.equal(toPoisha(1234.56), 123456);
    assert.equal(toPoisha("1234.56"), 123456);
    assert.equal(toPoisha(null), 0);
    assert.equal(toPoisha(undefined), 0);
    assert.equal(toPoisha(""), 0);
    assert.equal(toPoisha("not a number"), 0);
  });

  test("adds amounts that naive float addition gets wrong", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in binary floating point.
    assert.equal(sumTaka(0.1, 0.2), 0.3);
    assert.equal(sumTaka(1234.56, 78.9, 0.54), 1314);
    assert.equal(sumTaka("1000.10", "2000.20"), 3000.3);
  });

  test("multiplies a unit price by a quantity exactly", () => {
    assert.equal(multiplyTaka(1234.56, 3), 3703.68);
    assert.equal(multiplyTaka("0.29", 7), 2.03);
    assert.equal(multiplyTaka(1999, 2), 3998);
  });

  test("round-trips through poisha", () => {
    assert.equal(fromPoisha(toPoisha(4999.99)), 4999.99);
  });

  test("formats Taka with the correct symbol and grouping", () => {
    assert.equal(formatTaka(1500), "৳1,500");
    assert.equal(formatTaka(0), "৳0");
    assert.equal(formatTaka("2499"), "৳2,499");
  });

  test("keeps decimals when an amount actually has them", () => {
    // A percentage discount can produce a fractional amount; dropping it would
    // make the displayed total disagree with the charged total.
    assert.equal(formatTaka(1234.5), "৳1,234.50");
    assert.equal(formatTaka(0.05), "৳0.05");
    assert.equal(formatTaka(1500, { withDecimals: true }), "৳1,500.00");
  });

  test("compacts large amounts using lakh and crore", () => {
    assert.equal(formatTakaCompact(950), "৳950");
    assert.equal(formatTakaCompact(45_600), "৳45.6k");
    assert.equal(formatTakaCompact(250_000), "৳2.50L");
    assert.equal(formatTakaCompact(15_000_000), "৳1.50Cr");
  });
});

describe("Bangladesh phone numbers", () => {
  const spellings = [
    "01712345678",
    "8801712345678",
    "+8801712345678",
    "+880 1712 345678",
    "01712-345678",
    "  01712 345 678  ",
    "1712345678",
  ];

  test("every common spelling normalises to the same canonical number", () => {
    for (const spelling of spellings) {
      assert.equal(
        normalizeBdPhone(spelling),
        "01712345678",
        `failed for ${JSON.stringify(spelling)}`,
      );
    }
  });

  test("accepts every valid Bangladeshi operator prefix", () => {
    for (const prefix of ["013", "014", "015", "016", "017", "018", "019"]) {
      assert.equal(isValidBdPhone(`${prefix}12345678`), true, prefix);
    }
  });

  test("rejects numbers that are not Bangladeshi mobiles", () => {
    const invalid = [
      "0121234567",
      "012123456789",
      "01212345678",
      "+14155552671",
      "0171234567",
      "017123456789",
      "abcdefghijk",
      "",
      null,
      undefined,
    ];
    for (const value of invalid) {
      assert.equal(isValidBdPhone(value), false, `should reject ${JSON.stringify(value)}`);
    }
  });

  test("formats for display, tel: links and WhatsApp", () => {
    assert.equal(formatBdPhone("+8801712345678"), "01712-345678");
    assert.equal(toInternationalBdPhone("01712345678"), "+8801712345678");
    assert.equal(toWhatsAppNumber("01712345678"), "8801712345678");
    assert.equal(toInternationalBdPhone("nonsense"), null);
  });
});

describe("store time zone", () => {
  test("start of day is Bangladesh midnight, not UTC midnight", () => {
    // 2026-03-15T02:00:00Z is 08:00 on the 15th in Dhaka (UTC+6), so the store
    // day started at 18:00Z on the 14th.
    const iso = startOfStoreDay(new Date("2026-03-15T02:00:00Z"));
    assert.equal(iso, "2026-03-14T18:00:00.000Z");
  });

  test("late-evening UTC still belongs to the next Bangladesh day", () => {
    // 2026-03-14T20:00:00Z is 02:00 on the 15th in Dhaka.
    const iso = startOfStoreDay(new Date("2026-03-14T20:00:00Z"));
    assert.equal(iso, "2026-03-14T18:00:00.000Z");
  });

  test("datetime-local values round-trip through store time", () => {
    const local = "2026-06-01T09:30";
    const iso = storeLocalToIso(local);
    assert.equal(iso, "2026-06-01T03:30:00.000Z");
    assert.equal(isoToStoreLocal(iso), local);
  });

  test("blank and malformed datetime values are null rather than epoch", () => {
    assert.equal(storeLocalToIso(""), null);
    assert.equal(storeLocalToIso(null), null);
    assert.equal(storeLocalToIso("not a date"), null);
    assert.equal(isoToStoreLocal(null), "");
  });
});

describe("input validation", () => {
  const validCheckout = {
    customerName: "Ayesha Rahman",
    customerPhone: "+880 1712 345678",
    shippingAddress: {
      division: "Sylhet",
      district: "Zakiganj",
      upazila: "Zakiganj",
      area: "Batortal",
      fullAddress: "House 12, Road 3, Batortal Bazar",
    },
    items: [{ variantId: "3f1e9a6c-1d2b-4c3a-9e5f-6a7b8c9d0e1f", quantity: 2 }],
  };

  test("accepts a well-formed order and normalises the phone number", () => {
    const parsed = checkoutSchema.safeParse(validCheckout);
    assert.equal(parsed.success, true);
    if (parsed.success) assert.equal(parsed.data.customerPhone, "01712345678");
  });

  test("rejects an order with no items", () => {
    const parsed = checkoutSchema.safeParse({ ...validCheckout, items: [] });
    assert.equal(parsed.success, false);
  });

  test("rejects a quantity outside the allowed range", () => {
    for (const quantity of [0, -1, 21, 1.5]) {
      const parsed = checkoutSchema.safeParse({
        ...validCheckout,
        items: [{ variantId: validCheckout.items[0].variantId, quantity }],
      });
      assert.equal(parsed.success, false, `quantity ${quantity} should be rejected`);
    }
  });

  test("defaults to cash on delivery without the browser sending one", () => {
    // The checkout no longer presents a payment choice, so the schema supplies
    // the only method the store accepts.
    const parsed = checkoutSchema.safeParse(validCheckout);
    assert.equal(parsed.success, true);
    if (parsed.success) assert.equal(parsed.data.paymentMethod, "cash_on_delivery");
  });

  test("rejects any payment method other than cash on delivery", () => {
    // Online payment is not integrated anywhere. Accepting it here would let a
    // crafted request create an order the store cannot collect money for.
    for (const paymentMethod of ["online", "card", "bkash", "", null]) {
      const parsed = checkoutSchema.safeParse({ ...validCheckout, paymentMethod });
      assert.equal(
        parsed.success,
        false,
        `payment method ${JSON.stringify(paymentMethod)} should be rejected`,
      );
    }
  });

  test("ignores a delivery method sent by the browser", () => {
    // One delivery option exists. An express request must not survive parsing
    // and reach place_order(), which would price it differently.
    const parsed = checkoutSchema.safeParse({
      ...validCheckout,
      deliveryMethod: "express",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(
        "deliveryMethod" in parsed.data,
        false,
        "deliveryMethod must be stripped from the parsed input",
      );
    }
  });

  test("rejects a foreign phone number", () => {
    const parsed = checkoutSchema.safeParse({
      ...validCheckout,
      customerPhone: "+14155552671",
    });
    assert.equal(parsed.success, false);
  });

  test("a percentage coupon cannot exceed 100", () => {
    const base = {
      code: "EID25",
      discountType: "percentage",
      discountValue: "150",
      minimumOrderAmount: "0",
    };
    assert.equal(adminCouponSchema.safeParse(base).success, false);
    assert.equal(
      adminCouponSchema.safeParse({ ...base, discountValue: "25" }).success,
      true,
    );
  });

  test("a coupon cannot expire before it starts", () => {
    const parsed = adminCouponSchema.safeParse({
      code: "EID25",
      discountType: "fixed",
      discountValue: "200",
      startsAt: "2026-06-10T00:00",
      expiresAt: "2026-06-01T00:00",
    });
    assert.equal(parsed.success, false);
  });

  test("a coupon code is uppercased and restricted to safe characters", () => {
    const good = adminCouponSchema.safeParse({
      code: "eid-25",
      discountType: "fixed",
      discountValue: "200",
    });
    assert.equal(good.success, true);
    if (good.success) assert.equal(good.data.code, "EID-25");

    const bad = adminCouponSchema.safeParse({
      code: "EID 25%",
      discountType: "fixed",
      discountValue: "200",
    });
    assert.equal(bad.success, false);
  });

  test("a compare-at price below the selling price is rejected", () => {
    const product = {
      slug: "silk-kameez",
      productCode: "TARA-001",
      nameEn: "Silk Kameez",
      descriptionEn: "A refined silk kameez for everyday elegance.",
      categoryId: "3f1e9a6c-1d2b-4c3a-9e5f-6a7b8c9d0e1f",
      basePrice: "3200",
      fabricEn: "Silk",
      status: "active",
    };
    assert.equal(
      adminProductSchema.safeParse({ ...product, compareAtPrice: "2500" }).success,
      false,
    );
    assert.equal(
      adminProductSchema.safeParse({ ...product, compareAtPrice: "4000" }).success,
      true,
    );
  });

  test("a category slug must be lowercase, hyphenated and free of path characters", () => {
    const base = { nameEn: "Ready Three Piece" };
    for (const slug of ["Ready Piece", "ready/piece", "../etc/passwd", "ready--piece", "-ready"]) {
      assert.equal(
        adminCategorySchema.safeParse({ ...base, slug }).success,
        false,
        `slug ${JSON.stringify(slug)} should be rejected`,
      );
    }
    assert.equal(
      adminCategorySchema.safeParse({ ...base, slug: "ready-three-piece" }).success,
      true,
    );
  });

  test("a product no longer accepts a slug from the form at all", () => {
    // Product slugs are generated from the English name on create and then held
    // stable, so nothing the browser sends can set or change one.
    const product = {
      slug: "attacker-chosen-slug",
      productCode: "TARA-001",
      nameEn: "Silk Kameez",
      descriptionEn: "A refined silk kameez for everyday elegance.",
      categoryId: "3f1e9a6c-1d2b-4c3a-9e5f-6a7b8c9d0e1f",
      basePrice: "3200",
      fabricEn: "Silk",
      status: "active",
    };
    const parsed = adminProductSchema.safeParse(product);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal("slug" in parsed.data, false, "slug must be stripped from the parsed input");
    }
  });

  test("generated slugs are URL-safe whatever the product is called", () => {
    assert.equal(slugify("Silk Kameez"), "silk-kameez");
    assert.equal(slugify("  Eid Special — 2026!  "), "eid-special-2026");
    assert.equal(slugify("Silk / Kameez"), "silk-kameez");
    // Path traversal and separators cannot survive the character filter.
    assert.equal(slugify("../etc/passwd"), "etc-passwd");
    assert.equal(slugify(String.raw`a//b\c`), "a-b-c");
    // A name written entirely in a non-Latin script reduces to nothing; the
    // create action falls back to "product" rather than publishing at
    // "/product/".
    assert.equal(slugify("東京シルク"), "");
  });

  test("contact messages are bounded so the form cannot be used as storage", () => {
    const base = { name: "Ayesha", email: "ayesha@example.com" };
    assert.equal(contactSchema.safeParse({ ...base, message: "short" }).success, false);
    assert.equal(
      contactSchema.safeParse({ ...base, message: "a".repeat(3001) }).success,
      false,
    );
    assert.equal(
      contactSchema.safeParse({ ...base, message: "I would like to ask about sizing." }).success,
      true,
    );
  });
});
