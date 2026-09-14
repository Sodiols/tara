import type { Metadata } from "next";
import { listingMetadata } from "@/lib/seo";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import type { ListingSearchParams } from "@/lib/product-listing";

/**
 * Generated per request rather than exported as a constant, because the robots
 * directive depends on the URL.
 *
 * It was `export const metadata`, which never sees `searchParams` — so every
 * filter, sort and page combination of the whole catalogue
 * (/collection?size=M&colour=Black&price=0-1500&sort=price-low&page=4, and
 * thousands like it) was served as an indexable page. The canonical pointed back
 * at /collection, but a canonical is a hint a crawler may ignore; noindex is
 * not. listingMetadata() applies both, the same way every category page does,
 * and leaves the clean /collection indexable.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: ListingSearchParams;
}): Promise<Metadata> {
  return listingMetadata({
    title: "Collections",
    description:
      "Browse TARA collections — seasonal and occasion edits of women's clothing, from Sylhet to the whole of Bangladesh.",
    path: "/collection",
    searchParams: await searchParams,
  });
}

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
