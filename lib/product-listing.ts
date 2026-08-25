import "server-only";

import {
  getCatalogueFacets,
  getProducts,
  productFiltersFromParams,
  type CatalogueFacets,
  type ProductFilters,
  type ProductPage,
} from "@/lib/supabase/queries/products";

export type ListingSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * What a particular listing route is *about*, as opposed to what the shopper
 * has filtered it down to.
 *
 * The scope comes from the route (/accessories is the accessories category,
 * /collection/eid is the Eid collection) and cannot be changed from the URL
 * query, so a crafted `?category=` can never widen a listing beyond what the
 * page is supposed to show.
 */
export interface ListingScope {
  category?: string;
  collection?: string;
  isNew?: boolean;
  featured?: boolean;
  bestSeller?: boolean;
}

export interface ResolvedListing {
  filters: ProductFilters;
  scope: ListingScope;
  page: ProductPage;
  facets: CatalogueFacets;
}

/**
 * Everything a listing page needs, in two database round trips.
 *
 * The filters come entirely from the URL, so the page is shareable, survives a
 * refresh, and behaves correctly under the back and forward buttons — there is
 * no second copy of the filter state in a React hook that could disagree with
 * the address bar.
 */
export async function resolveListing(
  searchParams: ListingSearchParams,
  scope: ListingScope = {},
): Promise<ResolvedListing> {
  const params = await searchParams;
  const urlFilters = productFiltersFromParams(params);

  const filters: ProductFilters = {
    ...urlFilters,
    category: scope.category,
    collection: scope.collection,
    isNew: scope.isNew || urlFilters.isNew,
    featured: scope.featured,
    bestSeller: scope.bestSeller,
  };

  const [page, facets] = await Promise.all([
    getProducts(filters),
    // Facets are computed for the route's scope, not for the shopper's current
    // selections: a list of options that shrank every time you ticked one would
    // make the filters impossible to undo.
    getCatalogueFacets({
      category: scope.category,
      collection: scope.collection,
      query: filters.query,
    }),
  ]);

  return { filters, scope, page, facets };
}
