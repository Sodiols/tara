import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/admin/ui";
import { TaxonomyAdmin } from "@/components/admin/TaxonomyAdmin";

export default async function AdminCollectionsPage() {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();

  const [{ data: collections }, { data: products }] = await Promise.all([
    supabase.from("collections").select("*").order("sort_order").order("name_en"),
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
        eyebrow="Selling"
        title="Collections"
        description="Seasonal and curated edits. Scheduled collections appear and disappear on their own dates."
      />
      <TaxonomyAdmin
        kind="collections"
        items={collections ?? []}
        productCounts={productCounts}
      />
    </>
  );
}
