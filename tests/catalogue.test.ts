import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  categoryHref,
  getBuiltInCategoryLabel,
  humanizeSlug,
  resolveCategoryLabel,
} from "../lib/utils";
import {
  formatSizeLabel,
  hasSelectableSizes,
  isPlaceholderSize,
  normaliseSizeValue,
} from "../lib/product-size";

/**
 * Category labelling.
 *
 * Regression cover for a crash that took out the entire product grid: staff can
 * create any category they like in the admin, but only four ship with a
 * built-in label. The old code looked the slug up in a fixed map, got
 * `undefined` for anything else, and passed it straight through as a React
 * child — which threw and unmounted every component below it. A blank page,
 * from one unrecognised slug.
 */

describe("built-in category labels", () => {
  test("returns a label for each built-in category", () => {
    // The slug and the label are deliberately different for the two three-piece
    // categories: the routes, the sitemap, every product row and several
    // migrations use these slugs, and renaming one would 404 every shared link
    // to change words the label already changes. Migration 0007 exists because
    // a previous careless rename of exactly this slug made the category vanish.
    assert.equal(getBuiltInCategoryLabel("unstitched-three-piece"), "Unready Three Piece");
    assert.equal(getBuiltInCategoryLabel("ready-three-piece"), "Two Piece");
    assert.equal(getBuiltInCategoryLabel("hijab"), "Hijab");
    assert.equal(getBuiltInCategoryLabel("accessories"), "Accessories");
    assert.equal(getBuiltInCategoryLabel("collection"), "Collection");
  });

  test("every built-in category has a route of its own", () => {
    // A built-in label without a route is a breadcrumb link to a 404, which is
    // exactly what a new category added to the label map but not to app/ would
    // produce.
    for (const slug of [
      "unstitched-three-piece",
      "ready-three-piece",
      "hijab",
      "accessories",
      "collection",
    ]) {
      assert.equal(categoryHref(slug), `/${slug}`, slug);
    }
  });

  test("returns null — never undefined — for a staff-created category", () => {
    // The distinction matters: `undefined` used to flow onward and crash.
    // `null` forces the caller to decide on a fallback.
    assert.equal(getBuiltInCategoryLabel("eid-special-2026"), null);
    assert.equal(getBuiltInCategoryLabel(""), null);
    assert.equal(getBuiltInCategoryLabel("toString"), null);
    assert.equal(getBuiltInCategoryLabel("constructor"), null);
  });

  test("does not inherit a label from Object.prototype", () => {
    // A category slugged "__proto__" or "valueOf" must not resolve to a
    // function via the prototype chain.
    assert.equal(getBuiltInCategoryLabel("__proto__"), null);
    assert.equal(getBuiltInCategoryLabel("valueOf"), null);
  });
});

describe("humanizeSlug", () => {
  test("turns a slug into a readable label", () => {
    assert.equal(humanizeSlug("eid-special-2026"), "Eid Special 2026");
    assert.equal(humanizeSlug("ready-three-piece"), "Ready Three Piece");
    assert.equal(humanizeSlug("accessories"), "Accessories");
    assert.equal(humanizeSlug("winter_edit"), "Winter Edit");
  });

  test("survives malformed slugs without throwing", () => {
    assert.equal(humanizeSlug(""), "");
    assert.equal(humanizeSlug("---"), "");
    assert.equal(humanizeSlug("-leading"), "Leading");
  });
});

describe("resolveCategoryLabel", () => {
  test("prefers the English name stored in the database", () => {
    const product = {
      category: "eid-special-2026",
      categoryName: "Eid Special 2026",
    };
    assert.equal(resolveCategoryLabel(product), "Eid Special 2026");
  });

  test("falls back to the built-in name for a shipped category", () => {
    const product = { category: "ready-three-piece", categoryName: undefined };
    assert.equal(resolveCategoryLabel(product), "Two Piece");
  });

  test("the database name wins over the built-in label", () => {
    // Migration 0014 renames categories.name_en to match, so both sources agree
    // — but the database is the one an administrator can change, so it leads.
    assert.equal(
      resolveCategoryLabel({ category: "ready-three-piece", categoryName: "Two Piece" }),
      "Two Piece",
    );
  });

  test("falls back to the humanised slug for an unknown category", () => {
    // This is the exact input that used to crash the product grid.
    const product = { category: "eid-special-2026", categoryName: undefined };
    assert.equal(resolveCategoryLabel(product), "Eid Special 2026");
  });

  test("ignores a categoryName that is blank or only whitespace", () => {
    // A database row can legitimately hold "" — it must not win over the
    // built-in label and render an empty breadcrumb.
    assert.equal(resolveCategoryLabel({ category: "accessories", categoryName: "" }), "Accessories");
    assert.equal(resolveCategoryLabel({ category: "accessories", categoryName: "   " }), "Accessories");
  });

  test("never returns an empty label, whatever the data looks like", () => {
    const cases = [
      { category: "collection", categoryName: undefined },
      { category: "some-new-category", categoryName: "" },
      { category: "another", categoryName: "" },
    ];
    for (const product of cases) {
      const label = resolveCategoryLabel(product);
      assert.ok(label.length > 0, `empty label for ${JSON.stringify(product)}`);
    }
  });

  test("does not throw for any category value", () => {
    for (const category of ["", "---", "toString", "__proto__", "a".repeat(200)]) {
      assert.doesNotThrow(() => resolveCategoryLabel({ category, categoryName: undefined }));
    }
  });
});

describe("product size placeholders", () => {
  test("every spelling the unready placeholder has had resolves to the current one", () => {
    // It has been three things: "Undready" (a corrupted find-and-replace,
    // repaired by migration 0007), "Unstitched", and now "Unready". A cart
    // saved before either rename, and every order already placed, still carry
    // an older spelling — and must still match a live variant.
    assert.equal(normaliseSizeValue("Undready"), "Unready");
    assert.equal(normaliseSizeValue("Unstitched"), "Unready");
    assert.equal(normaliseSizeValue("Unready"), "Unready");
    assert.equal(normaliseSizeValue("  Unstitched  "), "Unready");
  });

  test("a real size is passed through untouched", () => {
    for (const size of ["S", "M", "L", "XL", "One Size", "38", "Free Size"]) {
      assert.equal(normaliseSizeValue(size), size);
    }
  });

  test("placeholders are recognised in every spelling", () => {
    for (const size of ["One Size", "Unready", "Unstitched", "Undready"]) {
      assert.equal(isPlaceholderSize(size), true, size);
    }
    for (const size of ["S", "M", "XL", "Large"]) {
      assert.equal(isPlaceholderSize(size), false, size);
    }
  });

  test("a size selector is offered only when there are real sizes", () => {
    // A product sold as fabric has one variant whose size is a placeholder;
    // offering a selector for it would be a dropdown with one meaningless
    // option.
    assert.equal(hasSelectableSizes(["S", "M", "L"]), true);
    assert.equal(hasSelectableSizes(["Unready"]), false);
    assert.equal(hasSelectableSizes(["Unstitched"]), false);
    assert.equal(hasSelectableSizes(["One Size"]), false);
    assert.equal(hasSelectableSizes([]), false);
  });
});

describe("size labels on historic records", () => {
  test("an order placed under an older spelling still reads correctly", () => {
    // order_items.size is a snapshot and is deliberately never rewritten —
    // rewriting delivered orders to today's vocabulary would falsify a record
    // an invoice was issued from. The admin panel, the invoice and the packing
    // slip normalise it for display instead.
    assert.equal(formatSizeLabel("Unstitched"), "Unready");
    assert.equal(formatSizeLabel("Undready"), "Unready");
  });

  test("a real size on an old order is shown exactly as recorded", () => {
    for (const size of ["S", "M", "XL", "One Size"]) {
      assert.equal(formatSizeLabel(size), size);
    }
  });

  test("a missing size renders as nothing rather than as 'null'", () => {
    // order_items.size is not null, but a projection can omit it and a legacy
    // cart line can carry undefined. Neither should print into the page.
    assert.equal(formatSizeLabel(null), "");
    assert.equal(formatSizeLabel(undefined), "");
    assert.equal(formatSizeLabel(""), "");
  });
});
