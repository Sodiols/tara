import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import type { ListingSearchParams } from "@/lib/product-listing";


export const metadata: Metadata = buildMetadata({
  title: "Collections",
  description:
    "Browse TARA collections — seasonal and occasion edits of women's clothing, from Sylhet to the whole of Bangladesh.",
  path: "/collection",
});

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
