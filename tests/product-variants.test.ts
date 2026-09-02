import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  allColours,
  allSizes,
  colourChoices,
  defaultSelection,
  findVariant,
  hasColourAxis,
  maxQuantityFor,
  requiresVariantChoice,
  resolveSelection,
  sizeChoices,
  unavailableReason,
} from "../lib/product-variants";
import type { ProductVariant } from "../types";

/**
 * The regression suite for the variant matrix.
 *
 * THE BUG
 * -------
 * `search_catalogue()` returns a product's variants flattened into two
 * independent `distinct` arrays plus `sum(stock_quantity)`. The storefront
 * selected from those arrays, so for a product stocked as
 *
 *     38 / Black  (1)    40 / Maroon  (5)    42 / Black  (4)
 *
 * it offered every one of the six pairings — three of which have no row — and
 * capped quantity at 10, the sum, rather than at the selected variant's own
 * stock. `place_order()` was never fooled: it locks and re-reads each row, so
 * nothing could be oversold or mispriced. What it did instead was refuse the
 * order at the end of the checkout form, which is the most expensive place in
 * the funnel to put a dead end.
 *
 * These are the exact figures from the bug report, kept as the fixture so the
 * numbers in the assertions are the numbers a person can check by hand.
 */
const BLACK = { name: "Black", hex: "#000000" };
const MAROON = { name: "Maroon", hex: "#702D42" };

const matrix: ProductVariant[] = [
  { id: "v-38-black", size: "38", colour: BLACK, stock: 1, price: 2500, available: true },
  { id: "v-40-maroon", size: "40", colour: MAROON, stock: 5, price: 2500, available: true },
  { id: "v-42-black", size: "42", colour: BLACK, stock: 4, price: 3200, available: true },
];

describe("the variant matrix decides what exists", () => {
  test("a combination with no row is not selectable", () => {
    // The whole bug in one assertion: 40 exists, Black exists, 40/Black does not.
    assert.equal(findVariant(matrix, "40", "Black"), null);
    assert.equal(unavailableReason(matrix, "40", "Black"), "missing");

    const sizes = sizeChoices(matrix, "Black");
    assert.deepEqual(
      sizes,
      [
        { size: "38", selectable: true },
        { size: "40", selectable: false },
        { size: "42", selectable: true },
      ],
      "40 must be offered but disabled while Black is chosen",
    );
  });

  test("choosing a size restricts the colours, and vice versa", () => {
    assert.deepEqual(
      colourChoices(matrix, "40").map((c) => [c.name, c.selectable]),
      [
        ["Black", false],
        ["Maroon", true],
      ],
    );
    assert.deepEqual(
      colourChoices(matrix, "38").map((c) => [c.name, c.selectable]),
      [
        ["Black", true],
        ["Maroon", false],
      ],
    );
  });

  test("options are disabled, never removed", () => {
    // A row of controls that changes length as you pick hides the fact that the
    // size exists at all. Both axes always list everything.
    assert.equal(sizeChoices(matrix, "Maroon").length, 3);
    assert.equal(colourChoices(matrix, "38").length, 2);
  });

  test("sizes come back in garment order, not the database's alphabetical", () => {
    assert.deepEqual(allSizes(matrix), ["38", "40", "42"]);
    assert.deepEqual(allColours(matrix).map((c) => c.name), ["Black", "Maroon"]);
    assert.equal(hasColourAxis(matrix), true);
  });
});

describe("quantity is capped by the selected variant, not the product total", () => {
  test("38 / Black allows exactly one", () => {
    const variant = findVariant(matrix, "38", "Black");
    // sum(stock) across the matrix is 10. Offering 10 here was the bug.
    assert.equal(maxQuantityFor(variant, 20), 1);
  });

  test("40 / Maroon allows five", () => {
    assert.equal(maxQuantityFor(findVariant(matrix, "40", "Maroon"), 20), 5);
  });

  test("42 / Black allows four", () => {
    assert.equal(maxQuantityFor(findVariant(matrix, "42", "Black"), 20), 4);
  });

  test("a nonexistent combination allows none", () => {
    assert.equal(maxQuantityFor(findVariant(matrix, "40", "Black"), 20), 0);
  });

  test("the per-line cap still wins over a large stock", () => {
    const plenty: ProductVariant = {
      id: "v", size: "M", colour: BLACK, stock: 500, price: 100, available: true,
    };
    assert.equal(maxQuantityFor(plenty, 20), 20);
  });

  test("a sold-out variant allows none even though the row exists", () => {
    const soldOut: ProductVariant = {
      id: "v", size: "M", colour: BLACK, stock: 0, price: 100, available: false,
    };
    assert.equal(maxQuantityFor(soldOut, 20), 0);
    assert.equal(maxQuantityFor(null, 20), 0);
  });
});

describe("price follows the selected variant", () => {
  test("a variant with an override prices differently from its siblings", () => {
    // 42/Black carries price_override 3200 against a 2500 base. Showing the
    // base here is how a shopper is quoted one figure and charged another by
    // place_order(), which reads coalesce(price_override, base_price).
    assert.equal(findVariant(matrix, "42", "Black")?.price, 3200);
    assert.equal(findVariant(matrix, "38", "Black")?.price, 2500);
  });
});

describe("changing one axis moves the other to something real", () => {
  test("picking Maroon while on 38 moves the size to 40", () => {
    const next = resolveSelection(matrix, { size: "38", colour: "Maroon" }, "colour");
    assert.deepEqual(next, { size: "40", colour: "Maroon" });
    assert.ok(findVariant(matrix, next.size, next.colour)?.available);
  });

  test("picking 40 while on Black moves the colour to Maroon", () => {
    const next = resolveSelection(matrix, { size: "40", colour: "Black" }, "size");
    assert.deepEqual(next, { size: "40", colour: "Maroon" });
  });

  test("a valid selection is left alone", () => {
    const same = resolveSelection(matrix, { size: "42", colour: "Black" }, "size");
    assert.deepEqual(same, { size: "42", colour: "Black" });
  });

  test("resolution can never produce a combination that does not exist", () => {
    // Exhaustive over the product of both axes: whatever is asked for, and
    // whichever axis moved, the result is always a real row.
    for (const size of ["38", "40", "42", "44"]) {
      for (const colour of ["Black", "Maroon", "Green"]) {
        for (const changed of ["size", "colour"] as const) {
          const next = resolveSelection(matrix, { size, colour }, changed);
          assert.ok(
            findVariant(matrix, next.size, next.colour),
            `resolving (${size}, ${colour}) via ${changed} produced a phantom variant`,
          );
        }
      }
    }
  });
});

describe("the opening selection", () => {
  test("opens on the first buyable combination in size order", () => {
    assert.deepEqual(defaultSelection(matrix), { size: "38", colour: "Black" });
  });

  test("a fully sold-out product still opens on a real row", () => {
    const soldOut = matrix.map((v) => ({ ...v, stock: 0, available: false }));
    const selection = defaultSelection(soldOut);
    assert.ok(findVariant(soldOut, selection.size, selection.colour));
    assert.equal(unavailableReason(soldOut, selection.size, selection.colour), "out-of-stock");
  });

  test("skips a sold-out first size to open on one that can be bought", () => {
    const partial = matrix.map((v) =>
      v.size === "38" ? { ...v, stock: 0, available: false } : v,
    );
    assert.deepEqual(defaultSelection(partial), { size: "40", colour: "Maroon" });
  });

  test("an empty matrix is handled rather than throwing", () => {
    assert.deepEqual(defaultSelection([]), { size: "", colour: "" });
    assert.deepEqual(resolveSelection([], { size: "M", colour: "Black" }, "size"), {
      size: "",
      colour: "",
    });
  });
});

describe("a product with no colour axis", () => {
  const sizedOnly: ProductVariant[] = [
    { id: "a", size: "S", colour: null, stock: 2, price: 900, available: true },
    { id: "b", size: "M", colour: null, stock: 0, price: 900, available: false },
  ];

  test("has no colours to choose and still resolves by size", () => {
    assert.equal(hasColourAxis(sizedOnly), false);
    assert.deepEqual(allColours(sizedOnly), []);
    assert.deepEqual(defaultSelection(sizedOnly), { size: "S", colour: "" });
    assert.deepEqual(
      sizeChoices(sizedOnly, "").map((s) => [s.size, s.selectable]),
      [
        ["S", true],
        ["M", false],
      ],
    );
  });
});

describe("listings only add straight to the bag when there is nothing to choose", () => {
  test("a single size and a single colour is safe to add", () => {
    assert.equal(
      requiresVariantChoice({ sizes: ["One Size"], colours: [{ name: "Ivory" }] }),
      false,
    );
    assert.equal(requiresVariantChoice({ sizes: [], colours: [] }), false);
  });

  test("more than one of either means the card must not guess", () => {
    // This is the card and Quick View case: they hold the flattened summary,
    // and `sizes[0] + colours[0]` for the fixture above is (38, Black) — right
    // by luck for one product and a phantom variant for the next.
    assert.equal(
      requiresVariantChoice({ sizes: ["38", "40", "42"], colours: [{ name: "Black" }] }),
      true,
    );
    assert.equal(
      requiresVariantChoice({ sizes: ["M"], colours: [{ name: "Black" }, { name: "Maroon" }] }),
      true,
    );
  });
});
