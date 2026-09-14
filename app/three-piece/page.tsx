import {
  CategoryListingPage,
  categoryMetadata,
  type CategoryRouteConfig,
} from "@/components/product/CategoryListingPage";
import type { ListingSearchParams } from "@/lib/product-listing";

/**
 * Title, description and the visible introduction all come from
 * /admin/categories when the category has them, and fall back to this config
 * when it does not — so the page is complete on an unconfigured environment and
 * editable without a deploy on a configured one.
 */
const config: CategoryRouteConfig = {
  slug: "three-piece",
  name: "Ready Three Piece",
  description:
    "Ready three piece sets from TARA — kameez, bottom and dupatta together, in fabrics chosen for Bangladesh's weather and finished for everyday wear.",
  intro:
    "Kameez, bottom and dupatta as one set, in fabrics chosen for the weather here and finished for wearing rather than saving for an occasion.",
};

export const generateMetadata = categoryMetadata(config);

export default async function Page({ searchParams }: { searchParams: ListingSearchParams }) {
  return <CategoryListingPage config={config} searchParams={searchParams} />;
}
