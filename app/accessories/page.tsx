import type { Metadata } from "next";
import { getProductsByCategory } from "@/lib/supabase/queries/products";
import { ProductListingClient } from "@/components/product/ProductListingClient";
import { parseListingParams, type ListingSearchParams } from "@/lib/product-listing";

export const metadata: Metadata = {
  title: "Accessories",
  description: "Shop bags, jewellery, and fashion accessories from TARA, designed to complete every look.",
};

export default async function AccessoriesPage({ searchParams }: { searchParams: ListingSearchParams }) {
  const parsed = await parseListingParams(searchParams);
  const result = await getProductsByCategory("accessories", parsed.filters);
  return <ProductListingClient title="Accessories" products={result.products} initialFilters={parsed.initialFilters} initialSort={parsed.initialSort} />;
}
