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
  slug: "hijab",
  name: "Hijab",
  description:
    "Hijab from TARA — everyday and occasion styles in soft, breathable fabrics, finished for comfortable all-day wear.",
  intro:
    "Everyday and occasion styles in soft, breathable fabrics, hemmed to sit well and hold a drape without constant adjusting.",
};

export const generateMetadata = categoryMetadata(config);

export default async function Page({ searchParams }: { searchParams: ListingSearchParams }) {
  return <CategoryListingPage config={config} searchParams={searchParams} />;
}
