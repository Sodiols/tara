"use client";

import { useRouter } from "next/navigation";
import { saveProductAction } from "@/lib/supabase/actions/admin";
import type { Tables } from "@/types/database";
import { ActionForm, Disclosure, SubmitButton } from "./AdminForm";
import { ProductImagePicker } from "./ProductImagePicker";
import { Field, Panel, PanelHeader, adminInputClass, adminTextareaClass } from "./ui";

type Product = Tables<"products">;
type Option = { id: string; name_en: string };

/**
 * Product editor.
 *
 * Grouped into disclosures so a staff member adding a quick draft sees only the
 * essentials, while SEO, care and size copy stay one click away rather than
 * being buried in a forty-field wall.
 *
 * Two fields are deliberately absent:
 *
 *   - The URL slug. It is generated from the English name when the product is
 *     created, then held stable, so a later rename cannot break a link already
 *     shared with a customer or an entry already in the sitemap.
 *   - Stock. It lives on variants and moves only through an audited inventory
 *     adjustment.
 *
 * When creating, images can be attached here and are uploaded as soon as the
 * product row exists; the editor then takes over for reordering and alt text.
 */
export function ProductForm({
  product,
  categories,
  collections,
}: {
  product?: Product;
  categories: Option[];
  collections: Option[];
}) {
  const router = useRouter();
  const checkboxClass = "h-4 w-4 accent-[#702D42]";

  return (
    <ActionForm
      action={saveProductAction}
      className="flex flex-col gap-5"
      onSuccess={(result) => {
        // A new product lands on its own editor, where variants and image
        // ordering live. Editing an existing one stays put.
        if (!product && typeof result.data === "string") {
          router.push(`/admin/products/${result.data}`);
        }
      }}
    >
      {product && <input type="hidden" name="id" value={product.id} />}

      <Panel>
        <PanelHeader title="Essentials" description="The minimum needed to save a draft." />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <Field
            label="Name"
            htmlFor="nameEn"
            required
            hint={product ? undefined : "The page address is created from this name."}
          >
            <input
              id="nameEn"
              name="nameEn"
              required
              maxLength={160}
              defaultValue={product?.name_en}
              className={adminInputClass}
            />
          </Field>

          {product && (
            <Field
              label="Page address"
              hint="Fixed once the product is created, so links already shared with customers keep working."
            >
              <p className="flex h-11 items-center rounded-control border border-border bg-taraIvory px-3 font-mono text-sm text-muted">
                /product/{product.slug}
              </p>
            </Field>
          )}
          <Field label="Product code" htmlFor="productCode" required hint="Must be unique.">
            <input
              id="productCode"
              name="productCode"
              required
              maxLength={40}
              defaultValue={product?.product_code}
              className={adminInputClass}
            />
          </Field>

          <Field label="Category" htmlFor="categoryId" required>
            <select
              id="categoryId"
              name="categoryId"
              required
              defaultValue={product?.category_id ?? ""}
              className={adminInputClass}
            >
              <option value="" disabled>
                Choose a category
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name_en}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Collection" htmlFor="collectionId" hint="Optional.">
            <select
              id="collectionId"
              name="collectionId"
              defaultValue={product?.collection_id ?? ""}
              className={adminInputClass}
            >
              <option value="">None</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name_en}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Selling price (৳)" htmlFor="basePrice" required>
            <input
              id="basePrice"
              name="basePrice"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={product?.base_price ?? ""}
              className={adminInputClass}
            />
          </Field>
          <Field
            label="Compare-at price (৳)"
            htmlFor="compareAtPrice"
            hint="Shown struck through. Must be at least the selling price."
          >
            <input
              id="compareAtPrice"
              name="compareAtPrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={product?.compare_at_price ?? ""}
              className={adminInputClass}
            />
          </Field>

          <Field label="Status" htmlFor="status" required>
            <select
              id="status"
              name="status"
              defaultValue={product?.status ?? "draft"}
              className={adminInputClass}
            >
              <option value="draft">Draft — hidden from the storefront</option>
              <option value="active">Active — visible and buyable</option>
              <option value="archived">Archived — removed from sale</option>
            </select>
          </Field>

          <fieldset className="flex flex-wrap items-center gap-4 pt-6">
            <legend className="sr-only">Merchandising flags</legend>
            <label className="flex items-center gap-2 font-sans text-sm text-ink">
              <input
                type="checkbox"
                name="isNew"
                defaultChecked={product?.is_new ?? false}
                className={checkboxClass}
              />
              New arrival
            </label>
            <label className="flex items-center gap-2 font-sans text-sm text-ink">
              <input
                type="checkbox"
                name="isFeatured"
                defaultChecked={product?.is_featured ?? false}
                className={checkboxClass}
              />
              Featured
            </label>
            <label className="flex items-center gap-2 font-sans text-sm text-ink">
              <input
                type="checkbox"
                name="isBestSeller"
                defaultChecked={product?.is_best_seller ?? false}
                className={checkboxClass}
              />
              Best seller
            </label>
          </fieldset>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Description" />
        <div className="grid gap-5 px-5 py-5">
          <Field label="Description" htmlFor="descriptionEn" required>
            <textarea
              id="descriptionEn"
              name="descriptionEn"
              required
              rows={5}
              maxLength={5000}
              defaultValue={product?.description_en}
              className={adminTextareaClass}
            />
          </Field>
        </div>
      </Panel>

      {!product && (
        <Panel>
          <PanelHeader
            title="Images"
            description="Optional now, but a product without an image will not sell. You can add, reorder and caption more after saving."
          />
          <div className="px-5 py-5">
            <ProductImagePicker />
          </div>
        </Panel>
      )}

      <Disclosure
        title="Fabric, material and care"
        description="Shown in the product accordion on the storefront."
        defaultOpen={!product}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Fabric" htmlFor="fabricEn" required>
            <input
              id="fabricEn"
              name="fabricEn"
              required
              maxLength={160}
              defaultValue={product?.fabric_en}
              className={adminInputClass}
            />
          </Field>
          <Field label="Material" htmlFor="materialEn">
            <input
              id="materialEn"
              name="materialEn"
              maxLength={200}
              defaultValue={product?.material_en ?? ""}
              className={adminInputClass}
            />
          </Field>
          <Field label="Care instructions" htmlFor="careInstructionsEn">
            <textarea
              id="careInstructionsEn"
              name="careInstructionsEn"
              rows={3}
              maxLength={1000}
              defaultValue={product?.care_instructions_en ?? ""}
              className={adminTextareaClass}
            />
          </Field>
          <Field label="Size note" htmlFor="sizeGuideNoteEn">
            <textarea
              id="sizeGuideNoteEn"
              name="sizeGuideNoteEn"
              rows={3}
              maxLength={1000}
              defaultValue={product?.size_guide_note_en ?? ""}
              className={adminTextareaClass}
            />
          </Field>
        </div>
      </Disclosure>

      <Disclosure title="Tags and search" description="Comma separated, up to 20.">
        <Field label="Tags" htmlFor="tags" hint="e.g. eid, cotton, embroidered">
          <input
            id="tags"
            name="tags"
            maxLength={400}
            defaultValue={(product?.tags ?? []).join(", ")}
            className={adminInputClass}
          />
        </Field>
      </Disclosure>

      <Disclosure
        title="Search engine listing"
        description="Leave blank to fall back to the product name and description."
      >
        <div className="grid gap-5">
          <Field label="SEO title" htmlFor="seoTitle" hint="Around 60 characters reads best.">
            <input
              id="seoTitle"
              name="seoTitle"
              maxLength={70}
              defaultValue={product?.seo_title ?? ""}
              className={adminInputClass}
            />
          </Field>
          <Field
            label="SEO description"
            htmlFor="seoDescription"
            hint="Around 155 characters reads best."
          >
            <textarea
              id="seoDescription"
              name="seoDescription"
              rows={3}
              maxLength={180}
              defaultValue={product?.seo_description ?? ""}
              className={adminTextareaClass}
            />
          </Field>
        </div>
      </Disclosure>

      <div className="flex flex-wrap gap-3">
        <SubmitButton>{product ? "Save changes" : "Create product"}</SubmitButton>
        {!product && (
          <p className="self-center font-sans text-xs text-muted">
            You will be taken to the editor to add sizes and colours.
          </p>
        )}
      </div>
    </ActionForm>
  );
}
