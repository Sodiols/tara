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
  sortSizes,
} from "../lib/product-size";
import { HERO_INITIAL_INDEX, heroCategories } from "../data/hero-categories";

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
    assert.equal(getBuiltInCategoryLabel("unready-three-piece"), "Unready Three Piece");
    // "three-piece" is its own category, not an alias of either neighbour: the
    // three slugs are three different products on three different pages.
    assert.equal(getBuiltInCategoryLabel("three-piece"), "Three Piece");
    assert.equal(getBuiltInCategoryLabel("two-piece"), "Two Piece");
    assert.equal(getBuiltInCategoryLabel("hijab"), "Hijab");
    assert.equal(getBuiltInCategoryLabel("accessories"), "Accessories");
    assert.equal(getBuiltInCategoryLabel("collection"), "Collection");
  });

  test("every built-in category has a route of its own", () => {
    // A built-in label without a route is a breadcrumb link to a 404, which is
    // exactly what a new category added to the label map but not to app/ would
    // produce.
    for (const slug of [
      "unready-three-piece",
      "three-piece",
      "two-piece",
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
    assert.equal(humanizeSlug("two-piece"), "Two Piece");
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
    const product = { category: "two-piece", categoryName: undefined };
    assert.equal(resolveCategoryLabel(product), "Two Piece");
  });

  test("the database name wins over the built-in label", () => {
    // Migration 0014 renames categories.name_en to match, so both sources agree
    // — but the database is the one an administrator can change, so it leads.
    assert.equal(
      resolveCategoryLabel({ category: "two-piece", categoryName: "Two Piece" }),
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

/**
 * The homepage hero cards.
 *
 * The hero hard-codes five hrefs and five names. Nothing at runtime checks that
 * they are the real ones, so a category renamed in lib/utils.ts or a slug
 * changed in a migration would leave the hero quietly pointing at a 404, or
 * showing a customer a name the rest of the site stopped using — on the first
 * screen of the shop. These assertions are that check.
 */
describe("hero category cards", () => {
  test("every card points at a category that actually has a route", () => {
    for (const category of heroCategories) {
      const slug = category.href.replace(/^\//, "");
      assert.equal(
        categoryHref(slug),
        category.href,
        `${category.href} is not a built-in category route`,
      );
    }
  });

  test("every card shows the same wording as the rest of the site", () => {
    // Not cosmetic: "Two Piece" and "Ready Three Piece" are the same slug under
    // its new and old names, and the hero must never revive the old one.
    for (const category of heroCategories) {
      const slug = category.href.replace(/^\//, "");
      assert.equal(getBuiltInCategoryLabel(slug), category.name, slug);
    }
  });

  test("the five categories are distinct", () => {
    // The fan has five slots and the position maths assumes five different
    // cards; the same category twice would render two identical cards and leave
    // one category unreachable from the homepage.
    assert.equal(new Set(heroCategories.map((c) => c.href)).size, heroCategories.length);
    assert.equal(heroCategories.length, 5);
  });

  test("every card carries a local image path and real alt text", () => {
    for (const category of heroCategories) {
      // A remote URL here would need a next.config remotePatterns entry and
      // would put the hero — the LCP element — behind someone else's server.
      assert.ok(category.image.startsWith("/images/"), category.image);
      assert.ok(category.alt.length > 10, `${category.name} needs real alt text`);
    }
  });

  test("the carousel opens on Unready Three Piece", () => {
    assert.ok(HERO_INITIAL_INDEX >= 0 && HERO_INITIAL_INDEX < heroCategories.length);
    assert.equal(heroCategories[HERO_INITIAL_INDEX].name, "Unready Three Piece");
  });
});

/**
 * Size ordering on a product card.
 *
 * The database returns sizes alphabetically, so a card advertised "L M S XL" —
 * four letters rather than a size run. These lock the garment order in.
 */
describe("sorting sizes for display", () => {
  test("named sizes come out in garment order, not alphabetical", () => {
    assert.deepEqual(sortSizes(["L", "M", "S", "XL"]), ["S", "M", "L", "XL"]);
    assert.deepEqual(sortSizes(["XL", "XS", "M"]), ["XS", "M", "XL"]);
    assert.deepEqual(sortSizes(["XXL", "S", "XXS"]), ["XXS", "S", "XXL"]);
  });

  test("the 2XL and XXL spellings rank together", () => {
    assert.deepEqual(sortSizes(["3XL", "2XL", "L"]), ["L", "2XL", "3XL"]);
  });

  test("numeric sizes sort numerically and follow the lettered run", () => {
    // Alphabetically "40" sorts before "8", which would list a size run backwards.
    assert.deepEqual(sortSizes(["40", "8", "38"]), ["8", "38", "40"]);
    assert.deepEqual(sortSizes(["40", "M", "38"]), ["M", "38", "40"]);
  });

  test("an unfamiliar size is kept, not dropped", () => {
    // Staff can type any size in the admin. Losing one from the card would
    // advertise a product as unavailable in a size that is actually stocked.
    const sorted = sortSizes(["Free Size", "M", "S"]);
    assert.equal(sorted.length, 3);
    assert.deepEqual(sorted, ["S", "M", "Free Size"]);
  });

  test("is case insensitive and does not mutate the input", () => {
    const input = ["l", "s", "m"];
    assert.deepEqual(sortSizes(input), ["s", "m", "l"]);
    assert.deepEqual(input, ["l", "s", "m"], "the caller's array must be untouched");
  });

  test("handles empty and single-item lists", () => {
    assert.deepEqual(sortSizes([]), []);
    assert.deepEqual(sortSizes(["M"]), ["M"]);
  });
});
