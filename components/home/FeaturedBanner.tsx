import { collectionEditorials } from "@/data/collection-editorials";
import { getVisibleCollections } from "@/lib/supabase/queries/products";
import { CollectionEditorial } from "./CollectionEditorial";

/** Replace the existing homepage banner, preserving the catalogue's schedule. */
export async function FeaturedBanner() {
  const visible = new Set((await getVisibleCollections()).map(({ slug }) => slug));
  const collections = collectionEditorials.map((collection) => {
    const available = !collection.collectionSlug || visible.has(collection.collectionSlug);
    return {
      ...collection,
      href: available ? collection.href : "/collection",
      cta: available ? `Explore ${collection.name}` : "Explore collections",
    };
  });

  return <CollectionEditorial collections={collections} />;
}
