import type { Metadata } from "next";
import { getProductsByCategory } from "@/lib/supabase/queries/products";
import { ProductListingClient } from "@/components/product/ProductListingClient";
import { parseListingParams, type ListingSearchParams } from "@/lib/product-listing";

export const metadata: Metadata = {
  title: "Undready Three Piece",
  description:
    "Shop premium undready three piece sets from TARA — lawn, cotton, and georgette fabrics with hand embroidery, ready to be tailored to your fit.",
};

export default async function UnstitchedPage({ searchParams }: { searchParams: ListingSearchParams }) {
  const parsed = await parseListingParams(searchParams);
  const result = await getProductsByCategory("unstitched-three-piece", parsed.filters);
  return <ProductListingClient titleKey="nav.unstitched" products={result.products} initialFilters={parsed.initialFilters} initialSort={parsed.initialSort} />;
}
