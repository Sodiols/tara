"use client";

import type { Product } from "@/types";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Container } from "@/components/layout/Container";
import { ProductGrid } from "./ProductGrid";

export function SearchResultsClient({ query, results }: { query: string; results: Product[] }) {
  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Search Results" }]} />
      <h1 className="mt-3 mb-2 font-serif text-3xl text-ink sm:text-4xl lg:text-[2.75rem]">{"Search Results"}</h1>
      <p className="mb-8 text-sm text-muted">&ldquo;{query}&rdquo; — {results.length} {"products found"}</p>
      <ProductGrid products={results} />
    </Container>
  );
}
