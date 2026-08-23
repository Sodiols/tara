import type { Metadata } from "next";
import { getProductsByCollection } from "@/lib/supabase/queries/products";
import { ProductListingClient } from "@/components/product/ProductListingClient";
import { parseListingParams, type ListingSearchParams } from "@/lib/product-listing";

export const metadata: Metadata = { title: "Eid Collection", description: "Shop TARA's Eid Collection." };
export default async function EidCollectionPage({ searchParams }: { searchParams: ListingSearchParams }) {
  const parsed = await parseListingParams(searchParams);
  const result = await getProductsByCollection("eid", parsed.filters);
  return <ProductListingClient title="Eid Collection" products={result.products} initialFilters={parsed.initialFilters} initialSort={parsed.initialSort} />;
}
