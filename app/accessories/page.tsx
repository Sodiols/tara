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
  slug: "accessories",
  name: "Accessories",
  description:
    "Women's fashion accessories from TARA — bags, jewellery and finishing pieces chosen to sit alongside the clothing.",
  intro:
    "Bags, jewellery and the small finishing pieces chosen to sit alongside the clothing rather than compete with it.",
};

export const generateMetadata = categoryMetadata(config);

export default async function Page({ searchParams }: { searchParams: ListingSearchParams }) {
  return <CategoryListingPage config={config} searchParams={searchParams} />;
}
