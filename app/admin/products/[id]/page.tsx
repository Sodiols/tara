import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductEditorData } from "@/lib/supabase/queries/admin";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";
import { productTrustReport } from "@/lib/product-trust";
import { formatDateTime, formatNumber, formatTaka } from "@/lib/format";
import {
  AdminSecondaryAction,
  AdminStatusSummary,
  PageHeader,
} from "@/components/admin/ui";
import { ProductStatusBadge } from "@/components/admin/status";
import { ProductEditor } from "@/components/admin/ProductEditor";

export const metadata: Metadata = {
  title: "Edit product",
  robots: { index: false, follow: false },
};

/**
 * The product editor.
 *
 * A summary first — status, price, variants, stock, photographs, how complete
 * the listing is — so the state of the product is readable before anything is
 * scrolled. Then the workspace: every section in the order staff work in, one
 * Save for the product's own fields, and a panel-level button for each
 * individual operation. See components/admin/ProductEditor.tsx.
 */
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // The shop's own settings are part of the completeness answer: two of the
  // checks are whether the shop has stated its delivery estimate and exchange
  // window at all, which every product page shows.
  const [data, settings] = await Promise.all([
    getProductEditorData(id),
    getPublicStoreSettings(),
  ]);
  if (!data) notFound();

  const { product, categories, collections, variants, images, colours } = data;

  // How many photographs each colour owns, counted once here rather than in the
  // panel, so the colour list and the image grid cannot disagree.
  const imageCounts = images.reduce<Record<string, number>>((counts, image) => {
    if (image.product_colour_id) {
      counts[image.product_colour_id] = (counts[image.product_colour_id] ?? 0) + 1;
    }
    return counts;
  }, {});

  const trust = productTrustReport({
    description: product.description_en,
    fabric: product.fabric_en,
    careInstructions: product.care_instructions_en,
    status: product.status,
    images: images.map((image) => ({
      isPrimary: image.is_primary,
      role: image.media_role,
      altText: image.alt_en,
    })),
    variants: variants.map((variant) => ({
      size: variant.size,
      colourName: variant.colour_en,
      stock: variant.stock_quantity,
      isActive: variant.is_active,
    })),
    colourCount: colours.length,
    videoUrl: product.video_url,
    shop: {
      deliveryStated: Boolean(
        settings.policies.deliveryEstimateInside.trim() &&
          settings.policies.deliveryEstimateOutside.trim(),
      ),
      exchangeStated: settings.policies.exchangeWindowDays > 0,
    },
  });

  const activeVariants = variants.filter((variant) => variant.is_active);
  const totalStock = activeVariants.reduce((sum, variant) => sum + variant.stock_quantity, 0);
  const outOfStock = activeVariants.filter((variant) => variant.stock_quantity <= 0).length;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/products", label: "Products" }}
        title={product.name_en}
        meta={<ProductStatusBadge status={product.status} />}
        description={`${product.product_code} · last updated ${formatDateTime(product.updated_at)}`}
        actions={
          product.status === "active" ? (
            <AdminSecondaryAction href={`/product/${product.slug}`} external>
              View on storefront
            </AdminSecondaryAction>
          ) : null
        }
      />

      <div className="mb-8">
        <AdminStatusSummary
          items={[
            {
              label: "Status",
              value: product.status === "active" ? "Active" : product.status === "draft" ? "Draft" : "Archived",
              hint: product.status === "active" ? "Visible to customers" : "Hidden from customers",
            },
            {
              label: "Price",
              value: formatTaka(product.base_price),
              hint: product.compare_at_price ? `Was ${formatTaka(product.compare_at_price)}` : undefined,
            },
            {
              label: "Variants",
              value: formatNumber(variants.length),
              hint:
                variants.length === activeVariants.length
                  ? "All available"
                  : `${activeVariants.length} available`,
            },
            {
              label: "Total stock",
              value: formatNumber(totalStock),
              hint: outOfStock > 0 ? `${outOfStock} variant${outOfStock === 1 ? "" : "s"} sold out` : "Across active variants",
            },
            {
              label: "Photographs",
              value: formatNumber(images.length),
              hint: `${colours.length} colour${colours.length === 1 ? "" : "s"}`,
            },
            {
              label: "Listing",
              value: `${trust.score}%`,
              hint:
                trust.missingRequired > 0
                  ? `${trust.missingRequired} important item${trust.missingRequired === 1 ? "" : "s"} missing`
                  : "Complete",
            },
          ]}
        />
      </div>

      <ProductEditor
        product={product}
        categories={categories}
        collections={collections}
        colours={colours}
        images={images}
        variants={variants}
        imageCounts={imageCounts}
        trust={trust}
      />
    </>
  );
}
