import type { Metadata } from "next";
import { getTaxonomyOptions } from "@/lib/supabase/queries/admin";
import { requirePermission } from "@/lib/supabase/auth";
import { AdminEmptyState, AdminPrimaryAction, PageHeader, Panel } from "@/components/admin/ui";
import { ProductBuilder } from "@/components/admin/product-builder/ProductBuilder";

export const metadata: Metadata = {
  title: "Add product",
  robots: { index: false, follow: false },
};

/**
 * Add product — the whole product, on one screen.
 *
 * Basics, colours and photographs, sizes and opening stock, details,
 * merchandising and a readiness review, saved as a draft or published from the
 * same action bar. There is no second screen to finish it on.
 */
export default async function NewProductPage() {
  await requirePermission("catalogue.manage");
  const { categories, collections } = await getTaxonomyOptions();

  return (
    <>
      <PageHeader
        back={{ href: "/admin/products", label: "Products" }}
        title="Add product"
        description="Everything the product needs, in order. Save a draft at any point; publish when the review says it is ready."
      />

      {categories.length === 0 ? (
        <Panel>
          <AdminEmptyState
            title="Create a category first"
            description="Every product belongs to a category, and none exist yet."
            action={<AdminPrimaryAction href="/admin/categories">Manage categories</AdminPrimaryAction>}
          />
        </Panel>
      ) : (
        <ProductBuilder categories={categories} collections={collections} />
      )}
    </>
  );
}
