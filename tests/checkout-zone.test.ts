import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DELIVERY_SETTINGS,
  DELIVERY_ZONES,
  deliveryZoneLabel,
  isDeliveryZone,
  quoteDelivery,
  quoteDeliveryForZone,
  zoneForDivision,
  type DeliverySettings,
} from "../lib/delivery";
import { formatOrderAddress, formatOrderAddressInline } from "../lib/order-address";

/**
 * Delivery zones, and rendering an address in either shape it can be stored in.
 *
 * Checkout stopped asking for a division and a district and started asking the
 * one question the charge depends on: inside Sylhet, or outside it. Two things
 * have to keep holding across that change — the fee has to come out the same
 * for the same destination, and an order placed before it still has to render.
 */

const SETTINGS: DeliverySettings = {
  insideFee: 60,
  outsideFee: 120,
  freeDeliveryThreshold: 1500,
  freeDeliveryEnabled: true,
  freeDeliveryDivision: "Sylhet",
};

describe("delivery zones", () => {
  test("there are exactly two, and nothing else is one", () => {
    assert.deepEqual([...DELIVERY_ZONES], ["inside_sylhet", "outside_sylhet"]);
    for (const value of ["dhaka", "inside", "", "INSIDE_SYLHET", null, undefined, 0, {}]) {
      assert.equal(isDeliveryZone(value), false, `accepted ${JSON.stringify(value)}`);
    }
    assert.equal(isDeliveryZone("inside_sylhet"), true);
    assert.equal(isDeliveryZone("outside_sylhet"), true);
  });

  test("inside the zone: below the threshold pays, at and above is free", () => {
    assert.equal(quoteDeliveryForZone(1499, "inside_sylhet", SETTINGS).fee, 60);
    // The boundary is inclusive: "orders above ৳1500" in the announcement means
    // reaching it, and the database uses >=. An off-by-one here would charge a
    // customer the site had just told they would not be charged.
    assert.equal(quoteDeliveryForZone(1500, "inside_sylhet", SETTINGS).fee, 0);
    assert.equal(quoteDeliveryForZone(9999, "inside_sylhet", SETTINGS).fee, 0);
  });

  test("outside the zone always pays, however large the order", () => {
    assert.equal(quoteDeliveryForZone(0, "outside_sylhet", SETTINGS).fee, 120);
    assert.equal(quoteDeliveryForZone(1500, "outside_sylhet", SETTINGS).fee, 120);
    assert.equal(quoteDeliveryForZone(999_999, "outside_sylhet", SETTINGS).fee, 120);
    assert.equal(
      quoteDeliveryForZone(999_999, "outside_sylhet", SETTINGS).amountToFreeDelivery,
      null,
      "no amount earns free delivery outside the eligible zone",
    );
  });

  test("the offer switched off charges the inside fee at any subtotal", () => {
    const off = { ...SETTINGS, freeDeliveryEnabled: false };
    assert.equal(quoteDeliveryForZone(50_000, "inside_sylhet", off).fee, 60);
    assert.equal(quoteDeliveryForZone(50_000, "outside_sylhet", off).fee, 120);
  });

  test("the quote reports the zone it priced, so the UI cannot mislabel it", () => {
    assert.equal(quoteDeliveryForZone(100, "outside_sylhet", SETTINGS).zone, "outside_sylhet");
    assert.equal(quoteDeliveryForZone(100, "inside_sylhet", SETTINGS).isEligibleDivision, true);
  });
});

describe("division to zone", () => {
  test("the configured division maps inside, everything else outside", () => {
    assert.equal(zoneForDivision("Sylhet", SETTINGS), "inside_sylhet");
    assert.equal(zoneForDivision("sylhet", SETTINGS), "inside_sylhet");
    for (const division of ["Dhaka", "Khulna", "Barishal", "Rangpur"]) {
      assert.equal(zoneForDivision(division, SETTINGS), "outside_sylhet", division);
    }
  });

  test("an unknown or missing division is outside, never free", () => {
    // The safe direction: a display bug must never quote less than the database
    // will charge.
    for (const division of ["Nowhere", "Zakiganj", "", null, undefined, 42]) {
      assert.equal(zoneForDivision(division, SETTINGS), "outside_sylhet");
    }
  });

  test("a saved address prices the same through either entry point", () => {
    // quoteDelivery() is what the address book and historic orders use; it must
    // not become a second implementation of the rule.
    for (const subtotal of [0, 1499, 1500, 9999]) {
      assert.equal(
        quoteDelivery(subtotal, "Sylhet", SETTINGS).fee,
        quoteDeliveryForZone(subtotal, "inside_sylhet", SETTINGS).fee,
      );
      assert.equal(
        quoteDelivery(subtotal, "Dhaka", SETTINGS).fee,
        quoteDeliveryForZone(subtotal, "outside_sylhet", SETTINGS).fee,
      );
    }
  });

  test("the zone is configurable, not hardcoded to Sylhet", () => {
    const dhaka = { ...SETTINGS, freeDeliveryDivision: "Dhaka" as const };
    assert.equal(zoneForDivision("Dhaka", dhaka), "inside_sylhet");
    assert.equal(zoneForDivision("Sylhet", dhaka), "outside_sylhet");
    assert.equal(deliveryZoneLabel("inside_sylhet", dhaka), "Inside Dhaka");
    assert.equal(deliveryZoneLabel("outside_sylhet", dhaka), "Outside Dhaka");
  });

  test("the labels follow the settings", () => {
    assert.equal(deliveryZoneLabel("inside_sylhet", SETTINGS), "Inside Sylhet");
    assert.equal(deliveryZoneLabel("outside_sylhet", SETTINGS), "Outside Sylhet");
    assert.equal(deliveryZoneLabel("inside_sylhet", DEFAULT_DELIVERY_SETTINGS), "Inside Sylhet");
  });
});

describe("order addresses render in either shape", () => {
  const labels = { inside: "Inside Sylhet", outside: "Outside Sylhet" };

  test("a current order renders address, apartment, city, postal code, country", () => {
    const formatted = formatOrderAddress(
      {
        address: "House 12, Road 3, Batortal Bazar",
        apartment: "Flat 4B",
        city: "Sylhet",
        postalCode: "3100",
        deliveryZone: "inside_sylhet",
        country: "Bangladesh",
      },
      labels,
    );

    assert.deepEqual(formatted.lines, [
      "House 12, Road 3, Batortal Bazar",
      "Flat 4B",
      "Sylhet",
      "3100",
      "Bangladesh",
    ]);
    assert.equal(formatted.zoneLabel, "Inside Sylhet");
    assert.equal(formatted.zone, "inside_sylhet");
    assert.equal(formatted.isEmpty, false);
  });

  test("optional lines are omitted rather than rendered blank", () => {
    const formatted = formatOrderAddress(
      {
        address: "House 12, Road 3",
        city: "Habiganj",
        deliveryZone: "outside_sylhet",
        country: "Bangladesh",
      },
      labels,
    );
    assert.deepEqual(formatted.lines, ["House 12, Road 3", "Habiganj", "Bangladesh"]);
    assert.equal(formatted.zoneLabel, "Outside Sylhet");
  });

  test("a LEGACY order still renders everything it was shipped with", () => {
    // This is the case that must not regress: an order placed before the
    // checkout change has no `address`, no `city` and no zone, and it must not
    // suddenly show a blank block in the admin.
    const formatted = formatOrderAddress(
      {
        fullAddress: "House 12, Road 3, Batortal Bazar",
        area: "Batortal",
        upazila: "Zakiganj",
        district: "Sylhet",
        division: "Sylhet",
        postalCode: "3100",
      },
      labels,
    );

    assert.deepEqual(formatted.lines, [
      "House 12, Road 3, Batortal Bazar",
      "Batortal, Zakiganj",
      "Sylhet, Sylhet",
      "3100",
    ]);
    assert.equal(formatted.isEmpty, false);
    // A legacy order recorded no zone, so none is invented for it.
    assert.equal(formatted.zoneLabel, null);
    assert.equal(formatted.zone, null);
  });

  test("the oldest shape — street plus division and district only — still renders", () => {
    const formatted = formatOrderAddress(
      { fullAddress: "House 12, Road 3", district: "Cumilla", division: "Chattogram" },
      labels,
    );
    assert.deepEqual(formatted.lines, ["House 12, Road 3", "Cumilla, Chattogram"]);
  });

  test("nothing usable produces no lines rather than a row of undefined", () => {
    for (const value of [null, undefined, {}, [], "House 12", 42, { deliveryZone: "x" }]) {
      const formatted = formatOrderAddress(value, labels);
      assert.deepEqual(formatted.lines, [], JSON.stringify(value));
      assert.equal(formatted.isEmpty, true);
    }
  });

  test("never throws, whatever is in the column", () => {
    for (const value of [null, undefined, 0, "", [], { address: 12 }, { city: {} }]) {
      assert.doesNotThrow(() => formatOrderAddress(value, labels));
    }
  });

  test("the inline form is the same lines, comma separated", () => {
    assert.equal(
      formatOrderAddressInline(
        { address: "House 12, Road 3", city: "Sylhet", deliveryZone: "inside_sylhet" },
        labels,
      ),
      "House 12, Road 3, Sylhet",
    );
  });
});
