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
  slug: "unready-three-piece",
  name: "Unready Three Piece",
  description:
    "Unready three piece sets from TARA — unstitched kameez, salwar and dupatta fabric, ready to be tailored to your own measurements. Delivered across Bangladesh.",
  intro:
    "Unstitched kameez, salwar and dupatta sold together, so the set can be tailored to your own measurements. Choose the fabric here and have it made up however you like.",
};

export const generateMetadata = categoryMetadata(config);

export default async function Page({ searchParams }: { searchParams: ListingSearchParams }) {
  return <CategoryListingPage config={config} searchParams={searchParams} />;
}
