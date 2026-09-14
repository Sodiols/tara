/**
 * A product's rating, computed from reviews that actually exist.
 *
 * WHY THE PRODUCT ROW IS NOT TRUSTED FOR THIS
 * -------------------------------------------
 * `products.average_rating` and `products.review_count` are denormalised
 * columns. The `reviews_recalculate_rating` trigger keeps them right as long as
 * every change arrives through the reviews table — and nothing forces that. The
 * development seed writes them directly, and a database that had it loaded was
 * observed publishing, in Product JSON-LD:
 *
 *     "aggregateRating": { "ratingValue": 4.6, "reviewCount": 27 }
 *
 * for a product with zero approved reviews and none on the page. The page also
 * showed "4.6 (27 Customer Reviews)" above an empty reviews section.
 *
 * Structured data asserting ratings that are not visible on the page is exactly
 * what Google's review snippet policy penalises, and an invented count shown to
 * a customer is worse. So the storefront no longer asks the row what the rating
 * is; it asks the approved reviews and counts them.
 *
 * Pure so the rounding and the empty case are pinned by tests.
 */

export interface ReviewSummary {
  /** Mean of approved ratings to one decimal place; 0 when there are none. */
  rating: number;
  /** Number of approved reviews. */
  reviewCount: number;
}

/**
 * @param ratings approved ratings that were read back. May be a bounded sample
 *        when a product has more reviews than one query returns.
 * @param total the exact approved count from the database, when known. Used for
 *        the count so a sampled read never understates it.
 */
export function summariseReviews(
  ratings: readonly number[],
  total: number | null = null,
): ReviewSummary {
  // Only values that could be a real 1–5 rating. The column is constrained, but
  // this is what reaches structured data, so it is not assumed.
  const valid = ratings.filter(
    (value) => Number.isInteger(value) && value >= 1 && value <= 5,
  );
  const reviewCount = Math.max(valid.length, total ?? 0);
  if (valid.length === 0 || reviewCount === 0) return { rating: 0, reviewCount: 0 };

  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  return { rating: Math.round(mean * 10) / 10, reviewCount };
}
