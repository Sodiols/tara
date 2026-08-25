import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  ALL_DISTRICTS,
  DISTRICTS_BY_DIVISION,
  DIVISIONS,
  districtsForDivision,
  resolveDistrict,
  resolveDivision,
  resolveLocation,
} from "../data/bangladesh-geography";

/**
 * Shipping geography.
 *
 * The list this replaced named 30 places. Four of them — Sylhet Sadar,
 * Zakiganj, Golapganj and Beanibazar — are upazilas of Sylhet district, not
 * districts, and 40 of the country's 64 real districts were missing entirely,
 * so a customer in Barguna could not enter their own address. These tests fix
 * the shape of the corrected data so it cannot drift back.
 */

describe("Bangladesh divisions and districts", () => {
  test("there are exactly 8 divisions", () => {
    assert.equal(DIVISIONS.length, 8);
  });

  test("there are exactly 64 districts", () => {
    assert.equal(ALL_DISTRICTS.length, 64);
  });

  test("no district is listed under two divisions", () => {
    const seen = new Set<string>();
    for (const division of DIVISIONS) {
      for (const district of DISTRICTS_BY_DIVISION[division]) {
        assert.ok(!seen.has(district), `${district} is listed more than once`);
        seen.add(district);
      }
    }
    assert.equal(seen.size, 64);
  });

  test("every division has at least one district", () => {
    for (const division of DIVISIONS) {
      assert.ok(DISTRICTS_BY_DIVISION[division].length > 0, `${division} has no districts`);
    }
  });

  test("the district counts match the official split", () => {
    // Barishal 6, Chattogram 11, Dhaka 13, Khulna 10, Mymensingh 4,
    // Rajshahi 8, Rangpur 8, Sylhet 4 — 64 in total.
    assert.deepEqual(
      Object.fromEntries(
        DIVISIONS.map((division) => [division, DISTRICTS_BY_DIVISION[division].length]),
      ),
      {
        Barishal: 6,
        Chattogram: 11,
        Dhaka: 13,
        Khulna: 10,
        Mymensingh: 4,
        Rajshahi: 8,
        Rangpur: 8,
        Sylhet: 4,
      },
    );
  });

  test("upazilas are not listed as districts", () => {
    // Every one of these was in the old dropdown as if it were a district.
    for (const upazila of ["Sylhet Sadar", "Zakiganj", "Golapganj", "Beanibazar"]) {
      assert.equal(resolveDistrict("Sylhet", upazila), null, `${upazila} is not a district`);
      assert.ok(!ALL_DISTRICTS.includes(upazila));
    }
  });

  test("districts the old list omitted are present", () => {
    for (const district of ["Barguna", "Jhalokati", "Bandarban", "Meherpur", "Panchagarh"]) {
      assert.ok(ALL_DISTRICTS.includes(district), `${district} is missing`);
    }
  });
});

describe("resolveDivision", () => {
  test("accepts the canonical names", () => {
    assert.equal(resolveDivision("Sylhet"), "Sylhet");
    assert.equal(resolveDivision("Chattogram"), "Chattogram");
  });

  test("is insensitive to case and stray whitespace", () => {
    assert.equal(resolveDivision("  sYLHET "), "Sylhet");
    assert.equal(resolveDivision("dhaka"), "Dhaka");
  });

  test("accepts the pre-2018 spellings and returns the current one", () => {
    assert.equal(resolveDivision("Barisal"), "Barishal");
    assert.equal(resolveDivision("Chittagong"), "Chattogram");
  });

  test("rejects anything that is not a division", () => {
    for (const value of ["", "   ", "Zakiganj", "x1", "Kolkata", null, undefined, 42, {}]) {
      assert.equal(resolveDivision(value), null, `accepted ${JSON.stringify(value)}`);
    }
  });
});

describe("resolveLocation — the pair, not the parts", () => {
  test("accepts a district that belongs to the division", () => {
    assert.deepEqual(resolveLocation("Sylhet", "Moulvibazar"), {
      division: "Sylhet",
      district: "Moulvibazar",
    });
  });

  test("normalises spelling on the way through", () => {
    assert.deepEqual(resolveLocation("chittagong", "  comilla "), {
      division: "Chattogram",
      district: "Cumilla",
    });
    assert.deepEqual(resolveLocation("Khulna", "jessore"), {
      division: "Khulna",
      district: "Jashore",
    });
  });

  test("rejects two real places that do not belong together", () => {
    // This is the case a length check cannot catch, and the one that used to
    // reach place_order() and create a real order for an impossible address.
    assert.equal(resolveLocation("Sylhet", "Dhaka"), null);
    assert.equal(resolveLocation("Dhaka", "Sylhet"), null);
    assert.equal(resolveLocation("Barishal", "Rangpur"), null);
  });

  test("rejects invented values", () => {
    assert.equal(resolveLocation("x1", "y2"), null);
    assert.equal(resolveLocation("Sylhet", "Nowhere"), null);
    assert.equal(resolveLocation("", ""), null);
  });

  test("never throws, whatever it is given", () => {
    for (const value of [null, undefined, 0, [], {}, "a".repeat(500)]) {
      assert.doesNotThrow(() => resolveLocation(value, value));
    }
  });
});

describe("districtsForDivision", () => {
  test("returns the division's own districts", () => {
    assert.deepEqual([...districtsForDivision("Sylhet")], [
      "Habiganj",
      "Moulvibazar",
      "Sunamganj",
      "Sylhet",
    ]);
  });

  test("returns an empty list rather than throwing for an unknown division", () => {
    assert.deepEqual([...districtsForDivision("Nowhere")], []);
    assert.deepEqual([...districtsForDivision(undefined)], []);
  });

  test("every district it offers resolves against its own division", () => {
    // The checkout dropdown is built from this, so any value it offers must be
    // one the server will accept.
    for (const division of DIVISIONS) {
      for (const district of districtsForDivision(division)) {
        assert.ok(
          resolveLocation(division, district),
          `${division} offers ${district}, which does not resolve`,
        );
      }
    }
  });
});
