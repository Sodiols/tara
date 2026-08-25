import type { Metadata } from "next";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import type { ListingSearchParams } from "@/lib/product-listing";

import { siteConfig } from "@/data/site";

export const metadata: Metadata = {
  title: "Collections",
  description:
    "Explore TARA's curated collections — Everyday Elegance, Festive Edit, Office Edit, and more.",
  // The bare path, not the filtered variant — see the note in the category
  // pages: every filter combination is a near-duplicate that would otherwise
  // compete with this one in the index.
  alternates: { canonical: `${siteConfig.url}/collection` },
};

/**
 * The collections landing page shows the whole catalogue, with the sidebar's
 * Collection filter as the way into a particular one. Its facet list is built
 * from collections that are visible right now, so a scheduled or expired
 * collection is not offered here either.
 */
export default async function CollectionPage({
  searchParams,
}: {
  searchParams: ListingSearchParams;
}) {
  return <ProductListingSection title="Collection" searchParams={searchParams} />;
}
