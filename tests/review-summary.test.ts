import test, { describe } from "node:test";
import assert from "node:assert/strict";

import { summariseReviews } from "../lib/review-summary";

/**
 * The product rating is derived from approved reviews, never from the cached
 * product columns — see lib/review-summary.ts for the seeded database that
 * published aggregateRating { 4.6, 27 } for products with no reviews.
 */
describe("review summary", () => {
  test("no approved reviews means no rating at all", () => {
    // What stops structured data claiming a rating nobody wrote.
    assert.deepEqual(summariseReviews([]), { rating: 0, reviewCount: 0 });
    assert.deepEqual(summariseReviews([], 0), { rating: 0, reviewCount: 0 });
  });

  test("an exact count can never be conjured without ratings behind it", () => {
    // A total with no readable ratings is not evidence of anything.
    assert.deepEqual(summariseReviews([], 27), { rating: 0, reviewCount: 0 });
  });

  test("the mean is rounded to one decimal", () => {
    assert.deepEqual(summariseReviews([5, 4, 4]), { rating: 4.3, reviewCount: 3 });
    assert.deepEqual(summariseReviews([5, 5, 4, 4]), { rating: 4.5, reviewCount: 4 });
    assert.deepEqual(summariseReviews([5]), { rating: 5, reviewCount: 1 });
  });

  test("the exact count wins when the ratings read back were a bounded sample", () => {
    assert.deepEqual(summariseReviews([5, 4], 1200), { rating: 4.5, reviewCount: 1200 });
  });

  test("impossible values are ignored rather than averaged in", () => {
    assert.deepEqual(summariseReviews([5, 0, 6, 4.5, Number.NaN, 3]), {
      rating: 4,
      reviewCount: 2,
    });
  });
});
