import type { Metadata } from "next";
import { ProductListingSection } from "./ProductListingSection";
import { getPublicCategoryBySlug } from "@/lib/supabase/queries/products";
import type { ListingSearchParams } from "@/lib/product-listing";
import { jsonLdScriptProps } from "@/lib/json-ld";
import { breadcrumbSchema, listingMetadata, metaDescription } from "@/lib/seo";

/**
 * The five built-in category routes, assembled in one place.
 *
 * Each route file used to carry its own hard-coded title, description and
 * canonical, which meant three things: the SEO fields staff filled in under
 * /admin/categories had no effect on the live site, the copy drifted between
 * routes, and every filtered permutation of a listing was as indexable as the
 * clean page.
 *
 * This resolves all three. The database is consulted first and the route's
 * static copy is the fallback — so an edit in the admin panel changes the page,
 * and an unconfigured or unreachable Supabase still renders a complete,
 * correctly-described page rather than an empty one.
 */

export interface CategoryRouteConfig {
  /** The category slug, which is also the route path. */
  slug: string;
  /** Heading and title fallback, used when the database has nothing to say. */
  name: string;
  /** Meta description fallback. */
  description: string;
  /**
   * Short visible introduction, shown under the heading. The database
   * description wins when one exists.
   */
  intro: string;
}

export function categoryMetadata(config: CategoryRouteConfig) {
  return async function generateMetadata({
    searchParams,
  }: {
    searchParams: ListingSearchParams;
  }): Promise<Metadata> {
    const [category, params] = await Promise.all([
      getPublicCategoryBySlug(config.slug),
      searchParams,
    ]);

    // A staff-written SEO title is used verbatim; otherwise the category name,
    // which the root template turns into "Hijab | TARA".
    const customTitle = category?.seoTitle ?? null;

    return listingMetadata({
      title: customTitle ?? category?.name ?? config.name,
      description: metaDescription(
        category?.seoDescription ?? category?.description,
        config.description,
      ),
      path: `/${config.slug}`,
      ...(category?.imageUrl ? { images: [category.imageUrl] } : {}),
      searchParams: params,
    });
  };
}

export async function CategoryListingPage({
  config,
  searchParams,
}: {
  config: CategoryRouteConfig;
  searchParams: ListingSearchParams;
}) {
  const category = await getPublicCategoryBySlug(config.slug);
  const heading = category?.name ?? config.name;
  // The visible introduction: what a shopper reads, and the only category copy
  // a crawler can see. Never hidden, never duplicated across categories.
  const intro = category?.description ?? config.intro;

  return (
    <>
      <script
        {...jsonLdScriptProps(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: heading, path: `/${config.slug}` },
          ]),
        )}
      />
      <ProductListingSection
        title={heading}
        intro={intro}
        searchParams={searchParams}
        scope={{ category: config.slug }}
      />
    </>
  );
}
