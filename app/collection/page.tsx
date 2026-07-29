import type { Metadata } from "next";
import { getProducts } from "@/lib/supabase/queries/products";
import { ProductListingClient } from "@/components/product/ProductListingClient";
import { parseListingParams, type ListingSearchParams } from "@/lib/product-listing";

export const metadata: Metadata = {
  title: "Collections",
  description: "Explore TARA's curated collections — Everyday Elegance, Festive Edit, Office Edit, and more.",
};

export default async function CollectionPage({ searchParams }: { searchParams: ListingSearchParams }) {
  const parsed = await parseListingParams(searchParams);
  const result = await getProducts({ ...parsed.filters, pageSize: 48 });
  return <ProductListingClient titleKey="nav.collection" products={result.products} initialFilters={parsed.initialFilters} initialSort={parsed.initialSort} />;
}
