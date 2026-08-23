import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  getBuiltInCategoryLabel,
  humanizeSlug,
  resolveCategoryLabel,
} from "../lib/utils";

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
    assert.equal(getBuiltInCategoryLabel("unstitched-three-piece"), "Unstitched Three Piece");
    assert.equal(getBuiltInCategoryLabel("ready-three-piece"), "Ready Three Piece");
    assert.equal(getBuiltInCategoryLabel("accessories"), "Accessories");
    assert.equal(getBuiltInCategoryLabel("collection"), "Collection");
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
    assert.equal(resolveCategoryLabel(product), "Ready Three Piece");
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
