"use client";

import type { ReactNode } from "react";
import type { Tables } from "@/types/database";
import { Disclosure } from "./AdminForm";
import { Field, Panel, PanelHeader, adminInputClass, adminTextareaClass } from "./ui";

type Product = Tables<"products">;
type Option = { id: string; name_en: string };

/**
 * The product fields themselves, shared by the create screen and the editor.
 *
 * One copy so the two screens cannot drift — a field added for one and
 * forgotten on the other is how a product ends up with an SEO title that can
 * only be set at creation, or a care instruction that can only be edited later.
 *
 * The order is the order a staff member thinks in, not the order the table
 * declares its columns in: what the product IS, what it looks like, what it is
 * made of, whether it is on sale, and only then the merchandising long tail.
 * Tags and search-engine copy are collapsed because they are irrelevant to
 * nearly every product being added on a normal day.
 *
 * Two fields are deliberately absent:
 *
 *   - The URL slug. It is generated from the English name when the product is
 *     created, then held stable, so a later rename cannot break a link already
 *     shared with a customer or an entry already in the sitemap.
 *   - Stock. It lives on variants and moves only through an audited inventory
 *     adjustment.
 */
export function ProductFields({
  product,
  categories,
  collections,
  errors,
  imagesSlot,
}: {
  product?: Product;
  categories: Option[];
  collections: Option[];
  /** Field-level errors, keyed exactly as `adminProductSchema` names them. */
  errors?: Record<string, string[]>;
  /** Rendered between the information and the detail panels, on create. */
  imagesSlot?: ReactNode;
}) {
  const checkboxClass = "h-4 w-4 accent-[#702D42]";
  const errorFor = (field: string) => errors?.[field]?.join(" ");

  return (
    <>
      <Panel id="details">
        <PanelHeader title="Product information" />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <Field
            label="Name"
            htmlFor="nameEn"
            required
            error={errorFor("nameEn")}
            className="sm:col-span-2"
            hint={product ? undefined : "The page address is created from this name."}
          >
            <input
              id="nameEn"
              name="nameEn"
              maxLength={160}
              defaultValue={product?.name_en}
              className={adminInputClass}
            />
          </Field>

          <Field label="Product code" htmlFor="productCode" required error={errorFor("productCode")}>
            <input
              id="productCode"
              name="productCode"
              maxLength={40}
              placeholder="TARA2401"
              defaultValue={product?.product_code}
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

          <Field label="Category" htmlFor="categoryId" required error={errorFor("categoryId")}>
            <select
              id="categoryId"
              name="categoryId"
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

          <Field label="Selling price (৳)" htmlFor="basePrice" required error={errorFor("basePrice")}>
            <input
              id="basePrice"
              name="basePrice"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              defaultValue={product?.base_price ?? ""}
              className={adminInputClass}
            />
          </Field>
          <Field
            label="Compare-at price (৳)"
            htmlFor="compareAtPrice"
            error={errorFor("compareAtPrice")}
            hint="Shown struck through. At least the selling price."
          >
            <input
              id="compareAtPrice"
              name="compareAtPrice"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              defaultValue={product?.compare_at_price ?? ""}
              className={adminInputClass}
            />
          </Field>

          <Field
            label="Description"
            htmlFor="descriptionEn"
            required
            error={errorFor("descriptionEn")}
            className="sm:col-span-2"
          >
            <textarea
              id="descriptionEn"
              name="descriptionEn"
              rows={5}
              maxLength={5000}
              defaultValue={product?.description_en}
              className={adminTextareaClass}
            />
          </Field>
        </div>
      </Panel>

      {imagesSlot}

      <Panel>
        <PanelHeader title="Product details" description="Shown in the storefront accordion." />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <Field
            label="Fabric"
            htmlFor="fabricEn"
            required
            error={errorFor("fabricEn")}
            hint="Needed before the product can go live."
          >
            <input
              id="fabricEn"
              name="fabricEn"
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
      </Panel>

      <Panel>
        <PanelHeader title="Publishing" />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <Field label="Status" htmlFor="status" required error={errorFor("status")}>
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

          <fieldset className="flex flex-wrap items-center gap-4 sm:pt-6">
            <legend className="sr-only">Merchandising</legend>
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

      <Disclosure
        title="Advanced settings"
        description="Tags and the search engine listing."
      >
        <div className="grid gap-5">
          <Field label="Tags" htmlFor="tags" hint="Comma separated, up to 20. e.g. eid, cotton">
            <input
              id="tags"
              name="tags"
              maxLength={400}
              defaultValue={(product?.tags ?? []).join(", ")}
              className={adminInputClass}
            />
          </Field>
          <Field
            label="SEO title"
            htmlFor="seoTitle"
            error={errorFor("seoTitle")}
            hint="Leave blank to use the product name."
          >
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
            error={errorFor("seoDescription")}
            hint="Leave blank to use the product description."
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
    </>
  );
}
