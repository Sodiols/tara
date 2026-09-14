import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import { getPublicCollectionBySlug } from "@/lib/supabase/queries/products";
import type { ListingSearchParams } from "@/lib/product-listing";
import { collectionMetadata } from "@/lib/collection-metadata";

const SLUG = "eid";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: ListingSearchParams;
}): Promise<Metadata> {
  return collectionMetadata(SLUG, searchParams);
}

/**
 * This route has its own URL, but it is not a special case for visibility.
 *
 * A collection that has been deactivated, or that is scheduled for a future
 * season, or whose season has ended, must disappear from every entry point at
 * once. Before this check the four hand-written seasonal pages stayed live
 * while the dynamic /collection/[slug] route, the navigation and the sitemap
 * all correctly hid the same collection.
 */
export default async function Page({ searchParams }: { searchParams: ListingSearchParams }) {
  const collection = await getPublicCollectionBySlug(SLUG);
  if (!collection) notFound();

  return (
    <ProductListingSection
      title={collection.name}
      searchParams={searchParams}
      scope={{ collection: SLUG }}
    />
  );
}
