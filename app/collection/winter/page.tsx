import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import { getPublicCollectionBySlug } from "@/lib/supabase/queries/products";
import type { ListingSearchParams } from "@/lib/product-listing";
import { siteConfig } from "@/data/site";

const SLUG = "winter";

export async function generateMetadata(): Promise<Metadata> {
  const collection = await getPublicCollectionBySlug(SLUG);
  if (!collection) return { title: "Collection Not Found", robots: { index: false } };
  const description = collection.description?.trim() || "Shop TARA's Winter Collection.";
  return {
    title: collection.name,
    description,
    openGraph: { title: collection.name, description },
    alternates: { canonical: `${siteConfig.url}/collection/${SLUG}` },
  };
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
