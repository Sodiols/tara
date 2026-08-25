import { ProductListingClient } from "./ProductListingClient";
import {
  resolveListing,
  type ListingScope,
  type ListingSearchParams,
} from "@/lib/product-listing";

interface ProductListingSectionProps {
  title: string;
  searchParams: ListingSearchParams;
  scope?: ListingScope;
}

/**
 * The one entry point every catalogue route uses.
 *
 * Each listing page used to repeat the same six lines — parse the URL, call a
 * query, hand the result to the client component — and they had already drifted
 * apart: some passed a page size of 48, one forced `newIn` into the client's
 * filter state but not into the query. Routing them all through here means a
 * fix to pagination or filtering lands on every listing at once.
 */
export async function ProductListingSection({
  title,
  searchParams,
  scope = {},
}: ProductListingSectionProps) {
  const { filters, page, facets } = await resolveListing(searchParams, scope);

  return (
    <ProductListingClient
      title={title}
      products={page.products}
      total={page.total}
      page={page.page}
      hasMore={page.hasMore}
      filters={filters}
      facets={facets}
      scope={scope}
    />
  );
}
