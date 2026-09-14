import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListingSection } from "@/components/product/ProductListingSection";
import { getPublicCollectionBySlug } from "@/lib/supabase/queries/products";
import type { ListingSearchParams } from "@/lib/product-listing";
import { jsonLdScriptProps } from "@/lib/json-ld";
import { breadcrumbSchema } from "@/lib/seo";
import { collectionMetadata } from "@/lib/collection-metadata";

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
  const { slug } = await params;
  return collectionMetadata(slug, searchParams);
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
