"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductVariant } from "@/types";

/**
 * The purchasable matrix for one product, fetched the first time a customer
 * engages with a card's options.
 *
 * WHY IT IS LAZY
 * --------------
 * A listing carries the flattened summary — `product.sizes` and
 * `product.colours` — which `search_catalogue()` builds with `distinct`. That
 * is the right payload for 24 cards and the wrong one for deciding what can be
 * bought: for a product stocked as 38/Black, 40/Maroon, 42/Black it advertises
 * six combinations, three of which have no row. See lib/product-variants.ts.
 *
 * The card therefore asks for the real matrix, but only for the product being
 * touched, and only once. A grid of 24 products where the customer picks a size
 * on one of them costs one request, not 24 — so the listing keeps the payload
 * the performance work gave it.
 *
 * WHY THE CACHE IS MODULE-LEVEL
 * -----------------------------
 * The same product appears in more than one place (a rail, the grid, recently
 * viewed) and a card unmounts whenever a filter changes. A cache per component
 * would refetch each time; this one holds the answer for the life of the page
 * and de-duplicates concurrent requests for the same product, which is what
 * stops a hover along a row turning into a burst of identical calls.
 *
 * Stock is never cached beyond that: the entry lives in memory for this page
 * view only, `place_order()` remains the authority, and the response itself is
 * sent `no-store`.
 */

type Entry = { variants: ProductVariant[] } | { error: true };

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<Entry>>();

async function fetchVariants(productId: string): Promise<Entry> {
  const cached = cache.get(productId);
  if (cached) return cached;

  const pending = inFlight.get(productId);
  if (pending) return pending;

  const request = (async (): Promise<Entry> => {
    try {
      const response = await fetch(
        `/api/products?variantsFor=${encodeURIComponent(productId)}`,
        { headers: { accept: "application/json" } },
      );
      if (!response.ok) throw new Error(`status ${response.status}`);
      const variants = (await response.json()) as ProductVariant[];
      const entry: Entry = { variants: Array.isArray(variants) ? variants : [] };
      cache.set(productId, entry);
      return entry;
    } catch {
      // Not cached: a failure is usually a dropped connection, and the next
      // attempt should be allowed to succeed. The card falls back to the
      // behaviour it had before the matrix existed — it sends the customer to
      // the product page rather than guessing a combination.
      return { error: true };
    } finally {
      inFlight.delete(productId);
    }
  })();

  inFlight.set(productId, request);
  return request;
}

export interface ProductVariantsState {
  /** Null until loaded; an empty array means the product has nothing to sell. */
  variants: ProductVariant[] | null;
  loading: boolean;
  failed: boolean;
  /** Starts the fetch. Safe to call repeatedly; resolves with the matrix. */
  load: () => Promise<ProductVariant[] | null>;
}

export function useProductVariants(productId: string): ProductVariantsState {
  const [variants, setVariants] = useState<ProductVariant[] | null>(() => {
    const cached = cache.get(productId);
    return cached && !("error" in cached) ? cached.variants : null;
  });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // A card can be unmounted by a filter change while its request is open.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const cached = cache.get(productId);
    if (cached && !("error" in cached)) return cached.variants;

    setLoading(true);
    const entry = await fetchVariants(productId);
    if (!mounted.current) return "error" in entry ? null : entry.variants;

    setLoading(false);
    if ("error" in entry) {
      setFailed(true);
      return null;
    }
    setFailed(false);
    setVariants(entry.variants);
    return entry.variants;
  }, [productId]);

  return { variants, loading, failed, load };
}
