import type { Metadata } from "next";
import { getProductsByCollection } from "@/lib/supabase/queries/products";
import { ProductListingClient } from "@/components/product/ProductListingClient";
import { parseListingParams, type ListingSearchParams } from "@/lib/product-listing";

export const metadata: Metadata = { title: "Winter Collection", description: "Shop TARA's Winter Collection." };
export default async function WinterCollectionPage({ searchParams }: { searchParams: ListingSearchParams }) {
  const parsed = await parseListingParams(searchParams);
  const result = await getProductsByCollection("winter", parsed.filters);
  return <ProductListingClient title="Winter Collection" products={result.products} initialFilters={parsed.initialFilters} initialSort={parsed.initialSort} />;
}
