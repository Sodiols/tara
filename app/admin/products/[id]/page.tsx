import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductEditorData } from "@/lib/supabase/queries/admin";
import { formatDateTime } from "@/lib/format";
import { PageHeader, Badge } from "@/components/admin/ui";
import { ProductStatusBadge } from "@/components/admin/status";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductInventory } from "@/components/admin/ProductInventory";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getProductEditorData(id);
  if (!data) notFound();

  const { product, categories, collections, variants, images } = data;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/admin/products" className="underline-offset-4 hover:underline">
            ← Products
          </Link>
        }
        title={product.name_en}
        description={`Last updated ${formatDateTime(product.updated_at)}`}
        actions={
          product.status === "active" ? (
            <Link
              href={`/product/${product.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center rounded-control border border-border bg-taraWhite px-4 font-sans text-[13px] font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
            >
              View on storefront
            </Link>
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <ProductStatusBadge status={product.status} />
        <Badge tone="neutral">{product.product_code}</Badge>
        <Badge tone="neutral">
          {variants.length} variant{variants.length === 1 ? "" : "s"}
        </Badge>
        <Badge tone="neutral">
          {images.length} image{images.length === 1 ? "" : "s"}
        </Badge>
        {product.review_count > 0 && (
          <Badge tone="info">
            {Number(product.average_rating).toFixed(1)} ★ · {product.review_count} reviews
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <ProductForm product={product} categories={categories} collections={collections} />
        <ProductInventory
          productId={product.id}
          productName={product.name_en}
          variants={variants}
          images={images}
        />
      </div>
    </>
  );
}
