import type { Metadata } from "next";
import { getProductsByCollection } from "@/lib/supabase/queries/products";
import { ProductListingClient } from "@/components/product/ProductListingClient";
import { parseListingParams, type ListingSearchParams } from "@/lib/product-listing";

export const metadata: Metadata = { title: "Festive Collection", description: "Shop TARA's Festive Collection." };
export default async function FestiveCollectionPage({ searchParams }: { searchParams: ListingSearchParams }) {
  const parsed = await parseListingParams(searchParams);
  const result = await getProductsByCollection("festive", parsed.filters);
  return <ProductListingClient title="Festive Collection" products={result.products} initialFilters={parsed.initialFilters} initialSort={parsed.initialSort} />;
}
