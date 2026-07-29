import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchResultsClient } from "@/components/product/SearchResultsClient";
import { Container } from "@/components/layout/Container";
import { ProductGridSkeleton } from "@/components/ui/LoadingSkeleton";
import { searchProducts } from "@/lib/supabase/queries/products";

export const metadata: Metadata = {
  title: "Search Results",
  description: "Search results for products at TARA.",
};

function SearchFallback() {
  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <ProductGridSkeleton />
    </Container>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = (await searchParams).q?.trim() ?? "";
  const results = query ? await searchProducts(query, 48) : [];
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchResultsClient query={query} results={results} />
    </Suspense>
  );
}
