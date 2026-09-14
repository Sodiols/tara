import "server-only";

import type { Metadata } from "next";
import { getPublicCollectionBySlug } from "@/lib/supabase/queries/products";
import type { ListingSearchParams } from "@/lib/product-listing";
import { NOINDEX_NOFOLLOW, listingMetadata, metaDescription } from "@/lib/seo";

/**
 * Metadata for a single collection listing, shared by every collection route.
 *
 * There are five: the four hand-written seasonal pages (eid, festive, summer,
 * winter) and the dynamic /collection/[slug] for everything staff create. Only
 * the dynamic one used to do this properly. The four built their metadata by
 * hand without ever reading `searchParams`, so
 *
 *     /collection/festive?size=M&sort=price-low&page=3
 *
 * was an indexable page with its own canonical claim — the exact duplication
 * listingMetadata() exists to prevent on every category page. They also ignored
 * the SEO title and description staff write in /admin/collections, and emitted
 * no Twitter card.
 *
 * Now all five call this, so a collection is described the same way whichever
 * route happens to serve it.
 */
export async function collectionMetadata(
  slug: string,
  searchParams: ListingSearchParams,
): Promise<Metadata> {
  const [collection, params] = await Promise.all([
    getPublicCollectionBySlug(slug),
    searchParams,
  ]);

  // A collection outside its schedule, deactivated, or absent renders
  // notFound(). Its metadata must refuse indexing rather than describe a 404
  // that happens to return HTML.
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
    searchParams: params,
  });
}
