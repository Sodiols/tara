import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/admin/ui";
import { TaxonomyAdmin } from "@/components/admin/TaxonomyAdmin";

export default async function AdminCategoriesPage() {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();

  const [{ data: categories }, { data: products }] = await Promise.all([
    // Archived categories live in Archive & Trash, not here.
    supabase.from("categories").select("*").is("archived_at", null).order("sort_order").order("name_en"),
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
        eyebrow="Catalogue"
        title="Categories"
        description="What a product IS — Two Piece, Hijab, Accessories. Every product belongs to exactly one category, and each category is a page in the storefront menu. For seasonal or curated groups, use Collections."
      />
      <TaxonomyAdmin
        // The other taxonomy, one tap away, so the difference is visible.
        relatedHref="/admin/collections"
        kind="categories"
        items={categories ?? []}
        productCounts={productCounts}
      />
    </>
  );
}
