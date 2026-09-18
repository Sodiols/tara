import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/admin/ui";
import { TaxonomyAdmin } from "@/components/admin/TaxonomyAdmin";

export default async function AdminCollectionsPage() {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();

  const [{ data: collections }, { data: products }] = await Promise.all([
    // Archived collections live in Archive & Trash, not here.
    supabase.from("collections").select("*").is("archived_at", null).order("sort_order").order("name_en"),
    supabase
      .from("products")
      .select("collection_id")
      .not("collection_id", "is", null)
      .neq("status", "archived"),
  ]);

  const productCounts: Record<string, number> = {};
  for (const product of products ?? []) {
    if (product.collection_id) {
      productCounts[product.collection_id] = (productCounts[product.collection_id] ?? 0) + 1;
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Collections"
        description="A seasonal or curated edit — Eid, Summer, Festive. Optional for a product, and can be scheduled to appear and disappear on its own dates. For what a product is, use Categories."
      />
      <TaxonomyAdmin
        relatedHref="/admin/categories"
        kind="collections"
        items={collections ?? []}
        productCounts={productCounts}
      />
    </>
  );
}
