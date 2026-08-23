import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/admin/ui";
import { TaxonomyAdmin } from "@/components/admin/TaxonomyAdmin";

export default async function AdminCategoriesPage() {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order").order("name_en"),
    // Only the foreign key is fetched, so counting stays cheap even on a large
    // catalogue and no product row is transferred unnecessarily.
    supabase.from("products").select("category_id").neq("status", "archived"),
  ]);

  const productCounts: Record<string, number> = {};
  for (const product of products ?? []) {
    productCounts[product.category_id] = (productCounts[product.category_id] ?? 0) + 1;
  }

  return (
    <>
      <PageHeader
        eyebrow="Selling"
        title="Categories"
        description="The top-level structure of the catalogue. A category still in use cannot be deleted."
      />
      <TaxonomyAdmin
        kind="categories"
        items={categories ?? []}
        productCounts={productCounts}
      />
    </>
  );
}
