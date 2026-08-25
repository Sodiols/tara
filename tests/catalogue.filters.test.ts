import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PAGE_SIZE,
  MAX_REVEALED_PAGES,
  MAX_REVEALED_PRODUCTS,
  PRICE_BANDS,
  hasActiveFilters,
  isPriceBandSelected,
  paramsFromProductFilters,
  parseSort,
  productFiltersFromParams,
  togglePriceBand,
  toggleListValue,
} from "../lib/catalogue-filters";

/**
 * Catalogue filter state and its URL encoding.
 *
 * Two things depend on this being exactly reversible: the listing page parses
 * the URL on the server, and the filter sidebar rebuilds it in the browser. If
 * they disagree, a shopper's filter resets on refresh or the address bar stops
 * matching what is on screen.
 */

describe("price bands stay disjoint", () => {
  test("two separate bands are encoded as two bands", () => {
    // The bug: the old encoding wrote min(all) and max(all) into minPrice and
    // maxPrice, so picking ৳0–1,500 and ৳3,500–10,000 asked for ৳0–10,000 and
    // showed the shopper the ৳2,000 products they had deliberately excluded.
    const params = paramsFromProductFilters({
      priceBands: [
        { min: 0, max: 1500 },
        { min: 3500, max: 10000 },
      ],
    });
    assert.equal(params.get("price"), "0-1500,3500-10000");
    assert.equal(params.get("minPrice"), null);
    assert.equal(params.get("maxPrice"), null);
  });

  test("parses back to the same two bands", () => {
    const filters = productFiltersFromParams({ price: "0-1500,3500-10000" });
    assert.deepEqual(filters.priceBands, [
      { min: 0, max: 1500 },
      { min: 3500, max: 10000 },
    ]);
  });

  test("a band the shopper did not choose is not implied", () => {
    const filters = productFiltersFromParams({ price: "0-1500,3500-10000" });
    const matches = (price: number) =>
      Boolean(filters.priceBands?.some((band) => price >= band.min && price <= band.max));
    assert.equal(matches(1000), true);
    assert.equal(matches(2000), false, "৳2,000 falls in neither chosen band");
    assert.equal(matches(5000), true);
  });

  test("legacy minPrice/maxPrice links still work", () => {
    const filters = productFiltersFromParams({ minPrice: "500", maxPrice: "2500" });
    assert.deepEqual(filters.priceBands, [{ min: 500, max: 2500 }]);
  });

  test("malformed bands are dropped rather than throwing", () => {
    const filters = productFiltersFromParams({ price: "abc,-5--1,1500-500,,2000-3000" });
    assert.deepEqual(filters.priceBands, [{ min: 2000, max: 3000 }]);
  });
});

describe("URL round trip", () => {
  test("every filter survives encode then decode", () => {
    const filters = {
      query: "lawn",
      priceBands: [{ min: 1500, max: 2500 }],
      sizes: ["M", "XL"],
      colours: ["Wine", "Ivory"],
      fabrics: ["Cotton"],
      collectionNames: ["Eid Collection"],
      inStock: true,
      onSale: true,
      isNew: true,
      sort: "price-low" as const,
      page: 3,
    };

    const round = productFiltersFromParams(
      Object.fromEntries(paramsFromProductFilters(filters).entries()),
    );

    assert.equal(round.query, "lawn");
    assert.deepEqual(round.priceBands, filters.priceBands);
    assert.deepEqual(round.sizes, filters.sizes);
    assert.deepEqual(round.colours, filters.colours);
    assert.deepEqual(round.fabrics, filters.fabrics);
    assert.deepEqual(round.collectionNames, filters.collectionNames);
    assert.equal(round.inStock, true);
    assert.equal(round.onSale, true);
    assert.equal(round.isNew, true);
    assert.equal(round.sort, "price-low");
    assert.equal(round.page, 3);
  });

  test("an unfiltered listing produces an empty query string", () => {
    // So the canonical URL of a category page is the bare path, not a path with
    // a trailing "?" or a redundant "sort=newest".
    assert.equal(paramsFromProductFilters({}).toString(), "");
    assert.equal(paramsFromProductFilters({ sort: "newest", page: 1 }).toString(), "");
  });

  test("page 1 is never written into the URL", () => {
    assert.equal(paramsFromProductFilters({ page: 1 }).get("page"), null);
    assert.equal(paramsFromProductFilters({ page: 2 }).get("page"), "2");
  });
});

describe("bounds and defaults", () => {
  test("page is clamped to something a database can serve", () => {
    assert.equal(productFiltersFromParams({ page: "0" }).page, 1);
    assert.equal(productFiltersFromParams({ page: "-4" }).page, 1);
    assert.equal(productFiltersFromParams({ page: "abc" }).page, 1);
    // Capped at what search_catalogue() will actually serve in one request:
    // the listing is cumulative, so page N asks for N * 24 products.
    assert.equal(productFiltersFromParams({ page: "99999999" }).page, MAX_REVEALED_PAGES);
    assert.equal(productFiltersFromParams({ page: "3.7" }).page, 3);
  });

  test("list filters are de-duplicated and bounded", () => {
    const many = Array.from({ length: 100 }, (_, index) => `size-${index}`).join(",");
    assert.equal(productFiltersFromParams({ size: many }).sizes?.length, 40);
    assert.deepEqual(productFiltersFromParams({ size: "M,M,L, M " }).sizes, ["M", "L"]);
  });

  test("a search term cannot be unbounded", () => {
    const long = "a".repeat(500);
    assert.equal(productFiltersFromParams({ q: long }).query?.length, 100);
  });

  test("an unknown sort falls back to newest rather than reaching SQL", () => {
    assert.equal(parseSort("price-low"), "price-low");
    assert.equal(parseSort("created_at desc; drop table products"), "newest");
    assert.equal(parseSort(undefined), "newest");
  });

  test("the default page size is what the listing renders", () => {
    assert.equal(productFiltersFromParams({}).pageSize, DEFAULT_PAGE_SIZE);
  });

  test("the cumulative ceiling matches the database cap", () => {
    // search_catalogue() clamps `limit` to 480. getProducts() asks for
    // pageSize * page. If the parser let page exceed this, a refresh deep in a
    // long list would render fewer products than were on screen while the
    // client still believed more were coming.
    assert.equal(MAX_REVEALED_PRODUCTS, 480);
    assert.equal(MAX_REVEALED_PAGES * DEFAULT_PAGE_SIZE, MAX_REVEALED_PRODUCTS);
  });
});

describe("toggles", () => {
  test("selecting and deselecting a band is symmetrical", () => {
    const band = PRICE_BANDS[1];
    const selected = togglePriceBand([], band);
    assert.equal(isPriceBandSelected(selected, band), true);
    assert.deepEqual(togglePriceBand(selected, band), []);
  });

  test("list toggles add then remove", () => {
    assert.deepEqual(toggleListValue(undefined, "M"), ["M"]);
    assert.deepEqual(toggleListValue(["M", "L"], "M"), ["L"]);
  });

  test("hasActiveFilters reflects what the shopper actually chose", () => {
    assert.equal(hasActiveFilters({ sort: "price-low", page: 4 }), false);
    assert.equal(hasActiveFilters({ sizes: ["XL"] }), true);
    assert.equal(hasActiveFilters({ inStock: true }), true);
    assert.equal(hasActiveFilters({ priceBands: [PRICE_BANDS[0]] }), true);
  });
});
