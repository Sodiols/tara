import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProductsByCollection,
  getPublicCollectionBySlug,
} from "@/lib/supabase/queries/products";
import { ProductListingClient } from "@/components/product/ProductListingClient";
import { parseListingParams, type ListingSearchParams } from "@/lib/product-listing";
import { siteConfig } from "@/data/site";

/**
 * Every collection that is not one of the four with a hand-written page.
 *
 * Staff can create collections freely in /admin/collections, and before this
 * route existed those had nowhere to live: the collection appeared in the
 * admin, its products were assigned to it, and the sitemap advertised
 * /collection/<slug> — which returned 404. Next.js matches the static segments
 * (eid, festive, summer, winter) ahead of this dynamic one, so those four keep
 * their bespoke copy untouched.
 */

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
  searchParams: ListingSearchParams;
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getPublicCollectionBySlug(slug);
  if (!collection) return { title: "Collection Not Found" };

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

  const parsed = await parseListingParams(searchParams);
  const result = await getProductsByCollection(collection.slug, parsed.filters);

  return (
    <ProductListingClient
      title={collection.name}
      products={result.products}
      initialFilters={parsed.initialFilters}
      initialSort={parsed.initialSort}
    />
  );
}
