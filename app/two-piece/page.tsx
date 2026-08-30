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
  slug: "two-piece",
  name: "Two Piece",
  description:
    "Two piece sets from TARA — kameez and bottom in matched fabric, made up and ready to wear. Cash on delivery across Bangladesh.",
  intro:
    "Kameez and bottom in matched fabric, made up and ready to wear straight from the packet. Sized S to XL where the set allows.",
};

export const generateMetadata = categoryMetadata(config);

export default async function Page({ searchParams }: { searchParams: ListingSearchParams }) {
  return <CategoryListingPage config={config} searchParams={searchParams} />;
}
