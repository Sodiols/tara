import Link from "next/link";
import { getTaxonomyOptions } from "@/lib/supabase/queries/admin";
import { requirePermission } from "@/lib/supabase/auth";
import { AdminEmptyState, PageHeader, Panel } from "@/components/admin/ui";
import { ProductCreateForm } from "@/components/admin/ProductCreateForm";

export default async function NewProductPage() {
  await requirePermission("catalogue.manage");
  const { categories, collections } = await getTaxonomyOptions();

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/admin/products" className="underline-offset-4 hover:underline">
            ← Products
          </Link>
        }
        title="New product"
        description="Add the product details and images. Variants can be added once the product is created."
      />

      {categories.length === 0 ? (
        <Panel>
          <AdminEmptyState
            title="Create a category first"
            description="Every product must belong to a category, and none exist yet."
            action={
              <Link
                href="/admin/categories"
                className="mt-2 inline-flex h-11 items-center rounded-control border border-taraWine bg-taraWine px-5 font-sans text-[13px] font-semibold uppercase tracking-wide text-taraIvory"
              >
                Manage categories
              </Link>
            }
          />
        </Panel>
      ) : (
        <ProductCreateForm categories={categories} collections={collections} />
      )}
    </>
  );
}
