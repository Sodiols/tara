"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Palette, Trash2 } from "lucide-react";
import {
  deleteProductColourAction,
  saveProductColourAction,
} from "@/lib/supabase/actions/admin";
import type { Tables } from "@/types/database";
import { cn } from "@/lib/utils";
import { ActionButton, ActionForm, SubmitButton } from "./AdminForm";
import { AdminEmptyState, Field, Panel, PanelHeader, adminInputClass } from "./ui";

type ProductColour = Tables<"product_colours">;

/**
 * Colour management for a product that already exists.
 *
 * Deliberately separate from the image panel below it: a colour is a small,
 * stable definition (a name and a swatch) while its photographs change often.
 * Keeping them apart means renaming Maroon is one short form rather than a
 * decision buried inside a gallery, and it is why an administrator never has to
 * delete a product to add a fourth colourway.
 *
 * DELETION IS THE CAREFUL PART
 * ----------------------------
 * A colour used by purchasable variants cannot be deleted — the database
 * refuses it, because those rows are what orders reference. The honest move for
 * a discontinued colourway is to turn it off, which takes the swatch off the
 * storefront and leaves every order, SKU and stock movement intact. Deleting an
 * unused colour leaves its photographs in place as general product images
 * rather than destroying staff photography as a side effect.
 */
export function ProductColourLibrary({
  productId,
  colours,
  imageCounts,
}: {
  productId: string;
  colours: ProductColour[];
  /** How many photographs each colour owns, so the panel can show what is missing. */
  imageCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ProductColour | null>(null);
  const [showForm, setShowForm] = useState(false);

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };

  return (
    <Panel id="colours">
      <PanelHeader
        title="Colours"
        description="Each colour owns its own photographs on the product page."
        actions={
          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-10 items-center rounded-control border border-taraWine bg-taraWine px-4 font-sans text-xs font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack"
          >
            Add colour
          </button>
        }
      />

      {colours.length === 0 ? (
        <AdminEmptyState
          title="No colours yet"
          description="Add a colour to group this product's photographs by colourway. Without one, every photograph is shown for every variant, which is how products worked before."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {colours.map((colour) => {
            const imageCount = imageCounts[colour.id] ?? 0;
            return (
              <li
                key={colour.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-7 w-7 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: colour.colour_hex }}
                />
                <div className="min-w-[140px] flex-1">
                  <p className="font-sans text-sm font-semibold text-ink">{colour.name_en}</p>
                  <p className="font-sans text-xs text-muted">
                    <span className="font-mono">{colour.colour_hex}</span>
                    {" · "}
                    {imageCount === 0 ? (
                      <span className="text-[#8A6A1F]">no photographs yet</span>
                    ) : (
                      `${imageCount} photograph${imageCount === 1 ? "" : "s"}`
                    )}
                    {!colour.is_active && " · hidden from the storefront"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditing(colour);
                    setShowForm(true);
                  }}
                  className="font-sans text-xs font-semibold uppercase tracking-wide text-taraWine underline-offset-4 hover:underline"
                >
                  Edit
                </button>

                <ActionButton
                  variant="secondary"
                  className="h-9 w-9 px-0 text-[#8C2F2F] hover:border-[#8C2F2F]"
                  title="Delete colour"
                  confirm={`Delete ${colour.name_en}? Its photographs stay on the product as general images. A colour used by variants cannot be deleted — turn it off instead.`}
                  action={async () => {
                    const result = await deleteProductColourAction(colour.id, productId);
                    if (result.ok) router.refresh();
                    return result;
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  <span className="sr-only">Delete {colour.name_en}</span>
                </ActionButton>
              </li>
            );
          })}
        </ul>
      )}

      {showForm && (
        <div className="border-t border-border px-5 py-5">
          <ColourForm
            key={editing?.id ?? "new"}
            productId={productId}
            editing={editing}
            nextSortOrder={colours.length}
            onDone={() => {
              setShowForm(false);
              setEditing(null);
              router.refresh();
            }}
          />
        </div>
      )}
    </Panel>
  );
}

function ColourForm({
  productId,
  editing,
  nextSortOrder,
  onDone,
}: {
  productId: string;
  editing: ProductColour | null;
  nextSortOrder: number;
  onDone: () => void;
}) {
  return (
    <ActionForm action={saveProductColourAction} className="flex flex-col gap-4" onSuccess={onDone}>
      <input type="hidden" name="productId" value={productId} />
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <input
        type="hidden"
        name="sortOrder"
        value={editing?.sort_order ?? nextSortOrder}
      />

      <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-ink">
        {editing ? `Edit ${editing.name_en}` : "New colour"}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Colour name"
          htmlFor="colour-name"
          required
          hint="Shown to customers beside the swatch."
        >
          <input
            id="colour-name"
            name="nameEn"
            required
            maxLength={60}
            placeholder="Black"
            defaultValue={editing?.name_en ?? ""}
            className={adminInputClass}
          />
        </Field>
        <Field label="Swatch" htmlFor="colour-hex" required>
          <div className="flex items-center gap-2">
            <input
              id="colour-hex"
              name="colourHex"
              type="color"
              required
              aria-label="Colour swatch"
              defaultValue={editing?.colour_hex ?? "#702D42"}
              className="h-11 w-16 shrink-0 cursor-pointer rounded-control border border-border bg-taraWhite px-1"
            />
            <span className="inline-flex items-center gap-1.5 font-sans text-xs text-muted">
              <Palette size={14} aria-hidden="true" />
              Renaming updates every variant in this colour.
            </span>
          </div>
        </Field>
      </div>

      {editing && (
        <label className="flex items-center gap-2 font-sans text-sm text-ink">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={editing.is_active}
            className="h-4 w-4 accent-[#702D42]"
          />
          Offered on the storefront
        </label>
      )}

      <div className="flex gap-3">
        <SubmitButton>{editing ? "Save colour" : "Add colour"}</SubmitButton>
        <button
          type="button"
          onClick={onDone}
          className={cn(
            "inline-flex h-11 items-center rounded-control border border-border bg-taraWhite px-4",
            "font-sans text-[13px] font-semibold uppercase tracking-wide text-muted transition-colors hover:text-taraWine",
          )}
        >
          Cancel
        </button>
      </div>
    </ActionForm>
  );
}
