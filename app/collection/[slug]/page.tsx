import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import { getPublicCollectionBySlug } from "@/lib/supabase/queries/products";
import type { ListingSearchParams } from "@/lib/product-listing";
import { siteConfig } from "@/data/site";

/**
 * Every collection that is not one of the four with a hand-written page.
 *
 * Staff can create collections freely in /admin/collections, and before this
 * route existed those had nowhere to live. Next.js matches the static segments
 * (eid, festive, summer, winter) ahead of this dynamic one, so those four keep
 * their own metadata — and, since this release, the identical visibility check.
 */

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
  searchParams: ListingSearchParams;
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getPublicCollectionBySlug(slug);
  if (!collection) return { title: "Collection Not Found", robots: { index: false } };

  const description =
    collection.description?.trim() || `Shop the ${collection.name} collection from TARA.`;

  return {
    title: collection.name,
    description,
    openGraph: { title: collection.name, description },
    alternates: { canonical: `${siteConfig.url}/collection/${collection.slug}` },
  };
}

export default async function CollectionSlugPage({ params, searchParams }: CollectionPageProps) {
  const { slug } = await params;
  const collection = await getPublicCollectionBySlug(slug);
  if (!collection) notFound();

  return (
    <ProductListingSection
      title={collection.name}
      searchParams={searchParams}
      scope={{ collection: collection.slug }}
    />
  );
}
