"use client";

import type { Tables } from "@/types/database";
import { Field, adminInputClass, adminSelectClass, adminTextareaClass } from "./ui";

type Product = Tables<"products">;
type Option = { id: string; name_en: string };

/**
 * The product's own fields, in the groups staff think in.
 *
 * ONE COPY, TWO SCREENS. The Product Builder and the product editor render
 * these same components, so a field cannot be editable on one and missing from
 * the other — which is how a product once ended up with an SEO title that could
 * only be set at creation.
 *
 * WHY `formId`. On the editor the general fields are spread across the page —
 * the basics at the top, details and SEO further down — with the photographs
 * and the variants in between, and those have forms of their own. HTML does not
 * allow a form inside a form, so every input here carries `form={formId}`,
 * which associates it with the one "Save changes" form wherever it sits on the
 * page. On the builder, where everything is inside one form, it is omitted.
 *
 * The names are exactly what `productFormValues()` reads, and the error keys
 * exactly what `adminProductSchema` produces, so both screens share one
 * validator as well.
 *
 * Two things are deliberately never fields:
 *   - the URL slug, generated from the name on creation and then held stable so
 *     a shared link keeps working after a rename;
 *   - stock, which moves only through variants and the audited adjustment.
 */

interface SectionProps {
  product?: Product;
  /** Field errors keyed by `adminProductSchema` path. */
  errors?: Record<string, string[] | undefined>;
  /** The form these inputs submit with, when they are not inside it. */
  formId?: string;
  disabled?: boolean;
}

const errorFor = (errors: SectionProps["errors"], field: string) => errors?.[field]?.join(" ");

const checkboxClass = "h-4 w-4 accent-[#702D42]";

export function BasicInfoFields({
  product,
  errors,
  formId,
  disabled,
  categories,
  collections,
}: SectionProps & { categories: Option[]; collections: Option[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        label="Product name"
        htmlFor="nameEn"
        required
        error={errorFor(errors, "nameEn")}
        className="sm:col-span-2"
        hint={product ? undefined : "The page address is made from this name and then kept fixed."}
      >
        <input
          id="nameEn"
          name="nameEn"
          form={formId}
          maxLength={160}
          defaultValue={product?.name_en}
          disabled={disabled}
          aria-invalid={Boolean(errorFor(errors, "nameEn"))}
          className={adminInputClass}
        />
      </Field>

      <Field label="Product code" htmlFor="productCode" required error={errorFor(errors, "productCode")}>
        <input
          id="productCode"
          name="productCode"
          form={formId}
          maxLength={40}
          placeholder="TARA2401"
          defaultValue={product?.product_code}
          disabled={disabled}
          aria-invalid={Boolean(errorFor(errors, "productCode"))}
          className={adminInputClass}
        />
      </Field>

      {product ? (
        <Field label="Page address" hint="Fixed once created, so shared links keep working.">
          <p className="flex h-11 items-center overflow-x-auto rounded-control border border-border bg-taraIvory px-3 font-mono text-sm text-muted">
            /product/{product.slug}
          </p>
        </Field>
      ) : (
        <div className="hidden sm:block" aria-hidden="true" />
      )}

      <Field label="Category" htmlFor="categoryId" required error={errorFor(errors, "categoryId")}>
        <select
          id="categoryId"
          name="categoryId"
          form={formId}
          defaultValue={product?.category_id ?? ""}
          disabled={disabled}
          aria-invalid={Boolean(errorFor(errors, "categoryId"))}
          className={adminSelectClass}
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
      <Field label="Collection" htmlFor="collectionId" hint="Optional. A seasonal or editorial group.">
        <select
          id="collectionId"
          name="collectionId"
          form={formId}
          defaultValue={product?.collection_id ?? ""}
          disabled={disabled}
          className={adminSelectClass}
        >
          <option value="">None</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name_en}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Selling price (৳)" htmlFor="basePrice" required error={errorFor(errors, "basePrice")}>
        <input
          id="basePrice"
          name="basePrice"
          form={formId}
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          defaultValue={product?.base_price ?? ""}
          disabled={disabled}
          aria-invalid={Boolean(errorFor(errors, "basePrice"))}
          className={adminInputClass}
        />
      </Field>
      <Field
        label="Compare-at price (৳)"
        htmlFor="compareAtPrice"
        error={errorFor(errors, "compareAtPrice")}
        hint="Optional. Shown struck through; at least the selling price."
      >
        <input
          id="compareAtPrice"
          name="compareAtPrice"
          form={formId}
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          defaultValue={product?.compare_at_price ?? ""}
          disabled={disabled}
          aria-invalid={Boolean(errorFor(errors, "compareAtPrice"))}
          className={adminInputClass}
        />
      </Field>

      <Field
        label="Description"
        htmlFor="descriptionEn"
        required
        error={errorFor(errors, "descriptionEn")}
        className="sm:col-span-2"
      >
        <textarea
          id="descriptionEn"
          name="descriptionEn"
          form={formId}
          rows={5}
          maxLength={5000}
          defaultValue={product?.description_en}
          disabled={disabled}
          aria-invalid={Boolean(errorFor(errors, "descriptionEn"))}
          className={adminTextareaClass}
        />
      </Field>
    </div>
  );
}

export function ProductDetailFields({ product, errors, formId, disabled }: SectionProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        label="Fabric"
        htmlFor="fabricEn"
        required
        error={errorFor(errors, "fabricEn")}
        hint="Needed before the product can go live."
      >
        <input
          id="fabricEn"
          name="fabricEn"
          form={formId}
          maxLength={160}
          defaultValue={product?.fabric_en}
          disabled={disabled}
          aria-invalid={Boolean(errorFor(errors, "fabricEn"))}
          className={adminInputClass}
        />
      </Field>
      <Field label="Material" htmlFor="materialEn" hint="Optional.">
        <input
          id="materialEn"
          name="materialEn"
          form={formId}
          maxLength={200}
          defaultValue={product?.material_en ?? ""}
          disabled={disabled}
          className={adminInputClass}
        />
      </Field>
      <Field label="Care instructions" htmlFor="careInstructionsEn">
        <textarea
          id="careInstructionsEn"
          name="careInstructionsEn"
          form={formId}
          rows={3}
          maxLength={1000}
          defaultValue={product?.care_instructions_en ?? ""}
          disabled={disabled}
          className={adminTextareaClass}
        />
      </Field>
      <Field label="Size note" htmlFor="sizeGuideNoteEn" hint="Anything about fit the size guide does not say.">
        <textarea
          id="sizeGuideNoteEn"
          name="sizeGuideNoteEn"
          form={formId}
          rows={3}
          maxLength={1000}
          defaultValue={product?.size_guide_note_en ?? ""}
          disabled={disabled}
          className={adminTextareaClass}
        />
      </Field>
      <Field
        label="Product video"
        htmlFor="videoUrl"
        error={errorFor(errors, "videoUrl")}
        className="sm:col-span-2"
        hint="Optional. A full https:// link to a short clip."
      >
        <input
          id="videoUrl"
          name="videoUrl"
          form={formId}
          type="url"
          inputMode="url"
          maxLength={500}
          placeholder="https://…/video.mp4"
          defaultValue={product?.video_url ?? ""}
          disabled={disabled}
          aria-invalid={Boolean(errorFor(errors, "videoUrl"))}
          className={adminInputClass}
        />
      </Field>
    </div>
  );
}

export function MerchandisingFields({ product, formId, disabled }: SectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-sans text-[12px] font-semibold uppercase tracking-wide text-ink">
          Show this product in
        </legend>
        <div className="flex flex-wrap gap-2">
          {[
            { name: "isNew", label: "New arrivals", checked: product?.is_new ?? false },
            { name: "isFeatured", label: "Featured", checked: product?.is_featured ?? false },
            { name: "isBestSeller", label: "Best sellers", checked: product?.is_best_seller ?? false },
          ].map((option) => (
            <label
              key={option.name}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-border bg-taraWhite px-4 font-sans text-sm text-ink transition-colors hover:border-taraWine has-[:checked]:border-taraWine has-[:checked]:bg-taraWine/5"
            >
              <input
                type="checkbox"
                name={option.name}
                form={formId}
                defaultChecked={option.checked}
                disabled={disabled}
                className={checkboxClass}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Tags" htmlFor="tags" hint="Comma separated, up to 20 — e.g. eid, cotton. Used by search.">
        <input
          id="tags"
          name="tags"
          form={formId}
          maxLength={400}
          defaultValue={(product?.tags ?? []).join(", ")}
          disabled={disabled}
          className={adminInputClass}
        />
      </Field>
    </div>
  );
}

export function SeoFields({ product, errors, formId, disabled }: SectionProps) {
  return (
    <div className="grid gap-5">
      <Field
        label="SEO title"
        htmlFor="seoTitle"
        error={errorFor(errors, "seoTitle")}
        hint="Up to 70 characters. Leave blank to use the product name."
      >
        <input
          id="seoTitle"
          name="seoTitle"
          form={formId}
          maxLength={70}
          defaultValue={product?.seo_title ?? ""}
          disabled={disabled}
          className={adminInputClass}
        />
      </Field>
      <Field
        label="SEO description"
        htmlFor="seoDescription"
        error={errorFor(errors, "seoDescription")}
        hint="Up to 180 characters. Leave blank to use the product description."
      >
        <textarea
          id="seoDescription"
          name="seoDescription"
          form={formId}
          rows={3}
          maxLength={180}
          defaultValue={product?.seo_description ?? ""}
          disabled={disabled}
          className={adminTextareaClass}
        />
      </Field>
    </div>
  );
}

/** The status select. The builder has no such field: its buttons decide. */
export function PublishingFields({ product, errors, formId, disabled }: SectionProps) {
  return (
    <Field
      label="Status"
      htmlFor="status"
      required
      error={errorFor(errors, "status")}
      hint="Only an active product is visible and buyable on the storefront."
    >
      <select
        id="status"
        name="status"
        form={formId}
        defaultValue={product?.status ?? "draft"}
        disabled={disabled}
        className={adminSelectClass}
      >
        <option value="draft">Draft — hidden from the storefront</option>
        <option value="active">Active — visible and buyable</option>
        <option value="archived">Archived — removed from sale</option>
      </select>
    </Field>
  );
}
