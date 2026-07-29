import type { Metadata } from "next";
import { getProductsByCollection } from "@/lib/supabase/queries/products";
import { ProductListingClient } from "@/components/product/ProductListingClient";
import { parseListingParams, type ListingSearchParams } from "@/lib/product-listing";

export const metadata: Metadata = { title: "Summer Collection", description: "Shop TARA's Summer Collection." };
export default async function SummerCollectionPage({ searchParams }: { searchParams: ListingSearchParams }) {
  const parsed = await parseListingParams(searchParams);
  const result = await getProductsByCollection("summer", parsed.filters);
  return <ProductListingClient titleText={{ en: "Summer Collection", bn: "সামার কালেকশন" }} products={result.products} initialFilters={parsed.initialFilters} initialSort={parsed.initialSort} />;
}
