"use client";

import { useState } from "react";
import Image from "next/image";
import {
  addProductImageAction,
  deleteProductImageAction,
  moveProductImageAction,
  saveVariantAction,
  setPrimaryImageAction,
} from "@/lib/supabase/actions/admin";
import { formatTaka } from "@/lib/format";
import type { Tables } from "@/types/database";
import { ActionForm, RowActionButton, SubmitButton } from "./AdminForm";
import {
  AdminEmptyState,
  Field,
  Panel,
  PanelHeader,
  TableWrap,
  Td,
  Th,
  adminInputClass,
} from "./ui";
import { StockBadge } from "./status";
import { InventoryAdjuster } from "./InventoryAdjuster";

type Variant = Tables<"product_variants">;
type ProductImage = Tables<"product_images">;

/**
 * Variant and image management for a single product.
 *
 * Variants carry the SKU, size, colour and price override. Their stock is
 * read-only here: it can only be moved through the audited inventory
 * adjustment, so the "Adjust" control opens that flow rather than exposing a
 * raw quantity input that would bypass the trail.
 */
export function ProductInventory({
  productId,
  productName,
  variants,
  images,
}: {
  productId: string;
  productName: string;
  variants: Variant[];
  images: ProductImage[];
}) {
  const [editing, setEditing] = useState<Variant | null>(null);
  const [showVariantForm, setShowVariantForm] = useState(false);

  const openNew = () => {
    setEditing(null);
    setShowVariantForm(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <PanelHeader
          title="Variants"
          description="Each size and colour combination is a separate variant with its own SKU and stock."
          actions={
            <button
              type="button"
              onClick={openNew}
              className="inline-flex h-10 items-center rounded-control border border-taraWine bg-taraWine px-4 font-sans text-xs font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack"
            >
              Add variant
            </button>
          }
        />

        {variants.length === 0 ? (
          <AdminEmptyState
            title="No variants yet"
            description="A product needs at least one active variant before customers can buy it."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>Size</Th>
                <Th>Colour</Th>
                <Th align="right">Price</Th>
                <Th align="right">Stock</Th>
                <Th>State</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => (
                <tr key={variant.id} className="align-top">
                  <Td className="font-mono text-xs">{variant.sku}</Td>
                  <Td>{variant.size}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="inline-block h-3 w-3 rounded-full border border-border"
                        style={{ backgroundColor: variant.colour_hex }}
                      />
                      {variant.colour_en}
                    </span>
                  </Td>
                  <Td align="right">
                    {variant.price_override ? formatTaka(variant.price_override) : "—"}
                  </Td>
                  <Td align="right" className="font-semibold">
                    {variant.stock_quantity}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <StockBadge
                        stock={variant.stock_quantity}
                        threshold={variant.low_stock_threshold}
                      />
                      {!variant.is_active && (
                        <span className="font-sans text-[11px] uppercase tracking-wide text-muted">
                          Hidden
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td align="right">
                    <div className="flex flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(variant);
                          setShowVariantForm(true);
                        }}
                        className="font-sans text-xs font-semibold uppercase tracking-wide text-taraWine underline-offset-4 hover:underline"
                      >
                        Edit
                      </button>
                      <InventoryAdjuster
                        variantId={variant.id}
                        sku={variant.sku}
                        currentStock={variant.stock_quantity}
                        label={`${productName} — ${variant.size} / ${variant.colour_en}`}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}

        {showVariantForm && (
          <div className="border-t border-border px-5 py-5">
            <ActionForm
              key={editing?.id ?? "new"}
              action={saveVariantAction}
              className="flex flex-col gap-4"
              onSuccess={() => {
                setShowVariantForm(false);
                setEditing(null);
              }}
            >
              <input type="hidden" name="productId" value={productId} />
              {editing && <input type="hidden" name="id" value={editing.id} />}

              <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-ink">
                {editing ? `Edit ${editing.sku}` : "New variant"}
              </h3>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="SKU" htmlFor="variant-sku" required hint="Unique across the store.">
                  <input
                    id="variant-sku"
                    name="sku"
                    required
                    maxLength={40}
                    defaultValue={editing?.sku ?? ""}
                    className={adminInputClass}
                  />
                </Field>
                <Field label="Size" htmlFor="variant-size" required>
                  <input
                    id="variant-size"
                    name="size"
                    required
                    maxLength={40}
                    placeholder="M, L, Unstitched"
                    defaultValue={editing?.size ?? ""}
                    className={adminInputClass}
                  />
                </Field>
                <Field label="Colour" htmlFor="variant-colour-en" required>
                  <input
                    id="variant-colour-en"
                    name="colourEn"
                    required
                    maxLength={60}
                    defaultValue={editing?.colour_en ?? ""}
                    className={adminInputClass}
                  />
                </Field>
                <Field label="Colour swatch" htmlFor="variant-colour-hex" required>
                  <input
                    id="variant-colour-hex"
                    name="colourHex"
                    type="color"
                    required
                    defaultValue={editing?.colour_hex ?? "#702D42"}
                    className="h-11 w-full cursor-pointer rounded-control border border-border bg-taraWhite px-2"
                  />
                </Field>
                <Field
                  label="Price override (৳)"
                  htmlFor="variant-price"
                  hint="Leave blank to use the product price."
                >
                  <input
                    id="variant-price"
                    name="priceOverride"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={editing?.price_override ?? ""}
                    className={adminInputClass}
                  />
                </Field>
                <Field label="Low stock threshold" htmlFor="variant-threshold">
                  <input
                    id="variant-threshold"
                    name="lowStockThreshold"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={editing?.low_stock_threshold ?? 3}
                    className={adminInputClass}
                  />
                </Field>
                {!editing && (
                  <Field
                    label="Opening stock"
                    htmlFor="variant-stock"
                    hint="Set once at creation. Later changes go through Inventory."
                  >
                    <input
                      id="variant-stock"
                      name="initialStock"
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={0}
                      className={adminInputClass}
                    />
                  </Field>
                )}
                {editing && (
                  <label className="flex items-center gap-2 self-end pb-3 font-sans text-sm text-ink">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={editing.is_active}
                      className="h-4 w-4 accent-[#702D42]"
                    />
                    Available to buy
                  </label>
                )}
              </div>

              <div className="flex gap-3">
                <SubmitButton>{editing ? "Save variant" : "Add variant"}</SubmitButton>
                <button
                  type="button"
                  onClick={() => {
                    setShowVariantForm(false);
                    setEditing(null);
                  }}
                  className="inline-flex h-11 items-center rounded-control border border-border bg-taraWhite px-4 font-sans text-[13px] font-semibold uppercase tracking-wide text-muted transition-colors hover:text-taraWine"
                >
                  Cancel
                </button>
              </div>
            </ActionForm>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Images"
          description="The main image is used on listings, the bag and the invoice. JPEG, PNG, WebP or AVIF, up to 5 MB each."
        />

        {images.length === 0 ? (
          <AdminEmptyState
            title="No images yet"
            description="A product without an image still renders, but it will not sell."
          />
        ) : (
          <ul className="grid gap-4 px-5 py-5 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image, index) => (
              <li
                key={image.id}
                className="overflow-hidden rounded-panel border border-border bg-taraWhite"
              >
                <div className="relative aspect-[3/4] bg-taraIvory">
                  <Image
                    src={image.image_url}
                    alt={image.alt_en || "Product image"}
                    fill
                    sizes="(max-width: 640px) 100vw, 25vw"
                    className="object-cover"
                  />
                  {image.is_primary && (
                    <span className="absolute left-2 top-2 rounded-control bg-taraWine px-2 py-[3px] font-sans text-[10px] font-bold uppercase tracking-wide text-taraIvory">
                      Main
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
                  <div className="flex gap-2">
                    <RowActionButton
                      action={async () =>
                        moveProductImageAction(image.id, productId, "up")
                      }
                    >
                      ↑
                    </RowActionButton>
                    <RowActionButton
                      action={async () =>
                        moveProductImageAction(image.id, productId, "down")
                      }
                    >
                      ↓
                    </RowActionButton>
                    {!image.is_primary && (
                      <RowActionButton
                        action={async () => setPrimaryImageAction(image.id, productId)}
                      >
                        Set main
                      </RowActionButton>
                    )}
                  </div>
                  <RowActionButton
                    tone="danger"
                    confirm={`Delete image ${index + 1}? This removes the file permanently.`}
                    action={async () => deleteProductImageAction(image.id, productId)}
                  >
                    Delete
                  </RowActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-border px-5 py-5">
          <ActionForm
            action={addProductImageAction}
            className="flex flex-col gap-4"
            resetOnSuccess
          >
            <input type="hidden" name="productId" value={productId} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Image file" htmlFor="image-file" required>
                <input
                  id="image-file"
                  name="file"
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="block w-full rounded-control border border-border bg-taraWhite px-3 py-[10px] font-sans text-sm text-ink file:mr-3 file:rounded-control file:border-0 file:bg-taraIvory file:px-3 file:py-1.5 file:font-sans file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-taraWine"
                />
              </Field>
              <Field
                label="Alt text"
                htmlFor="image-alt-en"
                hint="Describes the image for screen readers and search."
              >
                <input
                  id="image-alt-en"
                  name="altEn"
                  maxLength={160}
                  className={adminInputClass}
                />
              </Field>
            </div>
            <SubmitButton variant="secondary">Upload image</SubmitButton>
          </ActionForm>
        </div>
      </Panel>
    </div>
  );
}
