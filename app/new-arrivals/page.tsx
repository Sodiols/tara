import type { Metadata } from "next";
import { ProductListingClient } from "@/components/product/ProductListingClient";
import { getProducts } from "@/lib/supabase/queries/products";
import { parseListingParams, type ListingSearchParams } from "@/lib/product-listing";

export const metadata: Metadata = {
  title: "New Arrivals",
  description: "Discover the newest arrivals from TARA — freshly added clothing and accessories.",
};

export default async function NewArrivalsPage({ searchParams }: { searchParams: ListingSearchParams }) {
  const parsed = await parseListingParams(searchParams);
  const result = await getProducts({ ...parsed.filters, isNew: true, pageSize: 48 });
  return <ProductListingClient title="New Arrivals" products={result.products} initialFilters={{ ...parsed.initialFilters, newIn: true }} initialSort={parsed.initialSort} />;
}
