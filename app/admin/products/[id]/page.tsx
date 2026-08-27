import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductEditorData } from "@/lib/supabase/queries/admin";
import { formatDateTime } from "@/lib/format";
import { PageHeader, Badge } from "@/components/admin/ui";
import { ProductStatusBadge } from "@/components/admin/status";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductVariants } from "@/components/admin/ProductVariants";
import { ProductImageLibrary } from "@/components/admin/ProductImageManager";
import { ProductCreatedBanner } from "@/components/admin/ProductCreatedBanner";

/**
 * The product editor.
 *
 * The section order depends on why the staff member is here. Straight after
 * creation (`?created=1`) the images are done and the variants are not, so
 * variants come first and the page scrolls to them. On an ordinary edit the
 * usual order applies: what the product is, what it looks like, then what can
 * be bought.
 */
export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const data = await getProductEditorData(id);
  if (!data) notFound();

  const { product, categories, collections, variants, images } = data;
  const justCreated = created === "1";

  const productForm = (
    <ProductForm product={product} categories={categories} collections={collections} />
  );
  const variantsPanel = (
    <ProductVariants
      productId={product.id}
      productCode={product.product_code}
      productName={product.name_en}
      variants={variants}
      autoOpen={justCreated}
    />
  );
  const imagesPanel = <ProductImageLibrary productId={product.id} images={images} />;

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

      {justCreated && (
        <ProductCreatedBanner imageCount={images.length} variantCount={variants.length} />
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <ProductStatusBadge status={product.status} />
        <Badge tone="neutral">{product.product_code}</Badge>
        <Badge tone={variants.length === 0 ? "warning" : "neutral"}>
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
        {justCreated ? (
          <>
            {variantsPanel}
            {productForm}
            {imagesPanel}
          </>
        ) : (
          <>
            {productForm}
            {imagesPanel}
            {variantsPanel}
          </>
        )}
      </div>
    </>
  );
}
