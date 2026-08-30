import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import { getPublicCollectionBySlug } from "@/lib/supabase/queries/products";
import type { ListingSearchParams } from "@/lib/product-listing";
import { jsonLdScriptProps } from "@/lib/json-ld";
import {
  NOINDEX_NOFOLLOW,
  breadcrumbSchema,
  listingMetadata,
  metaDescription,
} from "@/lib/seo";

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

export async function generateMetadata({
  params,
  searchParams,
}: CollectionPageProps): Promise<Metadata> {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const collection = await getPublicCollectionBySlug(slug);

  // A collection outside its schedule, deactivated, or simply absent renders
  // notFound() below. Its metadata must refuse indexing rather than leave a
  // 404 that returns HTML looking like a real page.
  if (!collection) {
    return { title: "Collection not found", robots: NOINDEX_NOFOLLOW };
  }

  return listingMetadata({
    title: collection.seoTitle ?? collection.name,
    description: metaDescription(
      collection.seoDescription ?? collection.description,
      `Shop the ${collection.name} collection from TARA — women's clothing delivered across Bangladesh.`,
    ),
    path: `/collection/${collection.slug}`,
    ...(collection.imageUrl ? { images: [collection.imageUrl] } : {}),
    searchParams: resolvedSearchParams,
  });
}

export default async function CollectionSlugPage({ params, searchParams }: CollectionPageProps) {
  const { slug } = await params;
  const collection = await getPublicCollectionBySlug(slug);
  if (!collection) notFound();

  return (
    <>
      <script
        {...jsonLdScriptProps(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Collections", path: "/collection" },
            { name: collection.name, path: `/collection/${collection.slug}` },
          ]),
        )}
      />
      <ProductListingSection
        title={collection.name}
        intro={collection.description ?? undefined}
        searchParams={searchParams}
        scope={{ collection: collection.slug }}
      />
    </>
  );
}
