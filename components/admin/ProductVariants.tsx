"use client";

import { useState } from "react";
import { saveVariantAction } from "@/lib/supabase/actions/admin";
import { formatTaka } from "@/lib/format";
import { formatSizeLabel } from "@/lib/product-size";
import { suggestVariantSku } from "@/lib/product-sku";
import type { Tables } from "@/types/database";
import { ActionForm, Disclosure, SubmitButton } from "./AdminForm";
import {
  AdminEmptyState,
  Field,
  Panel,
  PanelHeader,
  TableWrap,
  Td,
  Th,
  adminInputClass,
  adminSelectClass,
} from "./ui";
import { StockBadge } from "./status";
import { InventoryAdjuster } from "./InventoryAdjuster";

type Variant = Tables<"product_variants">;
type ProductColour = Tables<"product_colours">;

/**
 * Variants for one product.
 *
 * Each size and colour combination is its own row with its own SKU and stock.
 * The form leads with the four values that are filled in every single time —
 * size, colour, opening stock and SKU — and keeps the price override and the
 * low stock threshold behind "More options", because most variants use the
 * product price and the default threshold and typing past two empty fields
 * every time is friction for nothing.
 *
 * Stock is read-only in the table on purpose. It can only be moved through the
 * audited inventory adjustment, so "Adjust" opens that flow rather than
 * exposing a quantity input that would bypass the trail. Opening stock is the
 * one exception, and only because a variant that does not exist yet has no
 * history to keep.
 *
 * COLOUR COMES FROM THE PRODUCT COLOUR, NOT FROM TYPING
 * ----------------------------------------------------
 * Once a product has colours defined, the colour field is a selector over them.
 * Typing "Black" and picking a hex for the third time was how a product ended
 * up with Black, black and a slightly different Black — three colours to the
 * database, three galleries, one to the customer. The chosen colour is sent as
 * an id and the server reads the name and hex from the row it names, so the
 * text on the variant cannot disagree with the swatch on the storefront.
 *
 * A product with no colours yet keeps the original free-text fields, so nothing
 * about the existing catalogue has to change before it can be edited.
 */
export function ProductVariants({
  productId,
  productCode,
  productName,
  variants,
  colours = [],
  autoOpen = false,
}: {
  productId: string;
  productCode: string;
  productName: string;
  variants: Variant[];
  /** The product's colourways. Empty means the free-text colour fields. */
  colours?: ProductColour[];
  /** Opens the form straight away, used right after the product was created. */
  autoOpen?: boolean;
}) {
  const [editing, setEditing] = useState<Variant | null>(null);
  const [showForm, setShowForm] = useState(autoOpen && variants.length === 0);

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };

  return (
    <Panel id="variants">
      <PanelHeader
        title="Variants"
        description="Every size and colour combination customers can buy."
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
              <Th>Size</Th>
              <Th>Colour</Th>
              <Th align="right">Stock</Th>
              <Th>SKU</Th>
              <Th align="right">Price</Th>
              <Th>State</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <tr key={variant.id} className="align-top">
                <Td>{formatSizeLabel(variant.size)}</Td>
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
                <Td align="right" className="font-semibold">
                  {variant.stock_quantity}
                </Td>
                <Td className="font-mono text-xs">{variant.sku}</Td>
                <Td align="right">
                  {variant.price_override ? formatTaka(variant.price_override) : "—"}
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
                        setShowForm(true);
                      }}
                      className="font-sans text-xs font-semibold uppercase tracking-wide text-taraWine underline-offset-4 hover:underline"
                    >
                      Edit
                    </button>
                    <InventoryAdjuster
                      variantId={variant.id}
                      sku={variant.sku}
                      currentStock={variant.stock_quantity}
                      label={`${productName} — ${formatSizeLabel(variant.size)} / ${variant.colour_en}`}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {showForm && (
        <div className="border-t border-border px-5 py-5">
          <VariantForm
            key={editing?.id ?? "new"}
            productId={productId}
            productCode={productCode}
            colours={colours}
            editing={editing}
            onDone={() => {
              setShowForm(false);
              setEditing(null);
            }}
          />
        </div>
      )}
    </Panel>
  );
}

function VariantForm({
  productId,
  productCode,
  colours,
  editing,
  onDone,
}: {
  productId: string;
  productCode: string;
  colours: ProductColour[];
  editing: Variant | null;
  onDone: () => void;
}) {
  const [size, setSize] = useState(editing?.size ?? "");
  const usesColourRows = colours.length > 0;

  // The selected colour row, when the product has any. Seeded from the
  // variant's own colour id, falling back to matching its stored name so a
  // variant created before the colours existed still opens on the right one.
  const [colourId, setColourId] = useState(() => {
    if (!usesColourRows) return "";
    if (editing?.product_colour_id) return editing.product_colour_id;
    const byName = colours.find(
      (entry) =>
        entry.name_en.trim().toLowerCase() === (editing?.colour_en ?? "").trim().toLowerCase(),
    );
    return byName?.id ?? colours[0]?.id ?? "";
  });
  const [typedColour, setTypedColour] = useState(editing?.colour_en ?? "");

  // What the SKU suggestion spells, whichever input is in use.
  const colour = usesColourRows
    ? colours.find((entry) => entry.id === colourId)?.name_en ?? ""
    : typedColour;
  const [typedSku, setTypedSku] = useState(editing?.sku ?? "");
  // Once the staff member types a SKU themselves, the suggestion stops writing
  // over it. Manual entry always wins; this only fills in the blank, and it is
  // derived during render rather than pushed into state by an effect so the
  // field can never briefly show a stale code.
  const [skuEdited, setSkuEdited] = useState(Boolean(editing));
  const sku = skuEdited ? typedSku : suggestVariantSku(productCode, size, colour);

  return (
    <ActionForm action={saveVariantAction} className="flex flex-col gap-4" onSuccess={onDone}>
      <input type="hidden" name="productId" value={productId} />
      {editing && <input type="hidden" name="id" value={editing.id} />}

      <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-ink">
        {editing ? `Edit ${editing.sku}` : "New variant"}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Size" htmlFor="variant-size" required>
          <input
            id="variant-size"
            name="size"
            required
            maxLength={40}
            placeholder="M, L, Unready"
            value={size}
            onChange={(event) => setSize(event.target.value)}
            className={adminInputClass}
          />
        </Field>
        {usesColourRows ? (
          <Field
            label="Colour"
            htmlFor="variant-colour-id"
            required
            hint="Defined in Colours, above."
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-9 w-9 shrink-0 rounded-control border border-border"
                style={{
                  backgroundColor:
                    colours.find((entry) => entry.id === colourId)?.colour_hex ?? "#FFFFFF",
                }}
              />
              <select
                id="variant-colour-id"
                name="productColourId"
                required
                value={colourId}
                onChange={(event) => setColourId(event.target.value)}
                className={adminSelectClass}
              >
                {colours.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name_en}
                    {entry.is_active ? "" : " (hidden)"}
                  </option>
                ))}
              </select>
            </div>
            {/* The server re-reads the name and hex from the chosen row; these
                carry the current values so a database without migration 0025
                still receives the fields its schema requires. */}
            <input type="hidden" name="colourEn" value={colour} />
            <input
              type="hidden"
              name="colourHex"
              value={colours.find((entry) => entry.id === colourId)?.colour_hex ?? "#702D42"}
            />
          </Field>
        ) : (
          <Field label="Colour" htmlFor="variant-colour-en" required>
            <div className="flex gap-2">
              <input
                id="variant-colour-en"
                name="colourEn"
                required
                maxLength={60}
                value={typedColour}
                onChange={(event) => setTypedColour(event.target.value)}
                className={adminInputClass}
              />
              <input
                name="colourHex"
                type="color"
                required
                aria-label="Colour swatch"
                defaultValue={editing?.colour_hex ?? "#702D42"}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-control border border-border bg-taraWhite px-1"
              />
            </div>
          </Field>
        )}
        {editing ? (
          <Field label="Stock" hint="Changed through Inventory, with a reason.">
            <p className="flex h-11 items-center rounded-control border border-border bg-taraIvory px-3 font-sans text-sm text-muted">
              {editing.stock_quantity} in stock
            </p>
          </Field>
        ) : (
          <Field label="Opening stock" htmlFor="variant-stock" hint="Later changes go through Inventory.">
            <input
              id="variant-stock"
              name="initialStock"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              defaultValue={0}
              className={adminInputClass}
            />
          </Field>
        )}
        <Field label="SKU" htmlFor="variant-sku" required hint="Unique across the store.">
          <input
            id="variant-sku"
            name="sku"
            required
            maxLength={40}
            value={sku}
            onChange={(event) => {
              setSkuEdited(true);
              setTypedSku(event.target.value);
            }}
            className={adminInputClass}
          />
        </Field>
      </div>

      <Disclosure title="More options" description="Price override, stock alerts and visibility.">
        <div className="grid gap-4 sm:grid-cols-2">
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
              inputMode="decimal"
              defaultValue={editing?.price_override ?? ""}
              className={adminInputClass}
            />
          </Field>
          <Field
            label="Low stock threshold"
            htmlFor="variant-threshold"
            hint="When to flag this variant on the inventory page."
          >
            <input
              id="variant-threshold"
              name="lowStockThreshold"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              defaultValue={editing?.low_stock_threshold ?? 3}
              className={adminInputClass}
            />
          </Field>
          {editing && (
            <label className="flex items-center gap-2 font-sans text-sm text-ink">
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
      </Disclosure>

      <div className="flex gap-3">
        <SubmitButton>{editing ? "Save variant" : "Add variant"}</SubmitButton>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-11 items-center rounded-control border border-border bg-taraWhite px-4 font-sans text-[13px] font-semibold uppercase tracking-wide text-muted transition-colors hover:text-taraWine"
        >
          Cancel
        </button>
      </div>
    </ActionForm>
  );
}
