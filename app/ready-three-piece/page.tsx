import type { Metadata } from "next";
import { getProductsByCategory } from "@/lib/supabase/queries/products";
import { ProductListingClient } from "@/components/product/ProductListingClient";
import { parseListingParams, type ListingSearchParams } from "@/lib/product-listing";

export const metadata: Metadata = {
  title: "Ready Three Piece",
  description:
    "Shop ready-to-wear three piece sets from TARA, tailored for an effortless fit — from everyday cotton to festive embellished styles.",
};

export default async function ReadyPage({ searchParams }: { searchParams: ListingSearchParams }) {
  const parsed = await parseListingParams(searchParams);
  const result = await getProductsByCategory("ready-three-piece", parsed.filters);
  return <ProductListingClient titleKey="nav.ready" products={result.products} initialFilters={parsed.initialFilters} initialSort={parsed.initialSort} />;
}
