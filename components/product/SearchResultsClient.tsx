"use client";

import type { Product } from "@/types";
import { useLanguage } from "@/lib/i18n";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Container } from "@/components/layout/Container";
import { ProductGrid } from "./ProductGrid";

export function SearchResultsClient({ query, results }: { query: string; results: Product[] }) {
  const { t } = useLanguage();
  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: t("search.results") }]} />
      <h1 className="mt-3 mb-2 font-serif text-3xl text-ink sm:text-4xl lg:text-[2.75rem]">{t("search.results")}</h1>
      <p className="mb-8 text-sm text-muted">&ldquo;{query}&rdquo; — {results.length} {t("listing.productsFound")}</p>
      <ProductGrid products={results} />
    </Container>
  );
}
