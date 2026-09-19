"use client";

import { Trash2, Undo2 } from "lucide-react";
import {
  colourDeleteBlocker,
  type ColourDraft,
  type EditorDraft,
} from "@/lib/product-editor-draft";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toastStore";
import { AdminEmptyState, Panel, PanelHeader, adminButtonClass, adminInputClass } from "../ui";
import { UnsavedBadge, newDraftKey, type DraftUpdater } from "./shared";

/**
 * The product's colourways, edited in place.
 *
 * Nothing here is written until Save changes. A colour is a small, stable
 * definition — a name, a swatch, whether it is offered — so each one is a row
 * of inputs rather than a form that opens and closes.
 *
 * Deleting is the careful part. A colour used by variants that already exist
 * cannot be deleted — orders reference those rows — so the delete button
 * explains that and "Offered on the storefront" is the way to retire it. An
 * unused colour can be deleted; its photographs stay as general images.
 */
export function EditorColours({
  draft,
  saved,
  update,
  problem,
  disabled,
}: {
  draft: EditorDraft;
  saved: EditorDraft;
  update: DraftUpdater;
  problem: string | null;
  disabled: boolean;
}) {
  const addToast = useToastStore((state) => state.addToast);
  const savedByKey = new Map(saved.colours.map((colour) => [colour.key, colour]));
  const photoCount = (key: string) =>
    draft.images.filter((image) => !image.deleted && image.colourKey === key).length;

  const change = (key: string, patch: Partial<ColourDraft>) =>
    update((current) => ({
      ...current,
      colours: current.colours.map((colour) => (colour.key === key ? { ...colour, ...patch } : colour)),
    }));

  const remove = (colour: ColourDraft) => {
    const blocker = colourDeleteBlocker(draft, colour.key);
    if (blocker) {
      addToast(blocker, "error");
      return;
    }
    update((current) => ({
      ...current,
      // A colour that was never saved simply goes. A saved one is marked, so
      // Save changes deletes it and Undo can bring it back.
      colours: colour.id
        ? current.colours.map((entry) => (entry.key === colour.key ? { ...entry, deleted: true } : entry))
        : current.colours.filter((entry) => entry.key !== colour.key),
      // Its photographs become general ones — what the database does too.
      images: current.images.map((image) =>
        image.colourKey === colour.key ? { ...image, colourKey: null } : image,
      ),
      // Unsaved variants in this colour go with it; saved ones block the delete above.
      variants: current.variants.filter((variant) => variant.id || variant.colourKey !== colour.key),
    }));
  };

  const add = () =>
    update((current) => ({
      ...current,
      colours: [
        ...current.colours,
        { key: newDraftKey("colour"), id: null, name: "", hex: "#702D42", isActive: true, deleted: false },
      ],
    }));

  const visible = draft.colours;

  return (
    <Panel id="colours">
      <PanelHeader
        title="Colours"
        description="Each colour owns its own photographs on the product page."
        actions={
          <button type="button" onClick={add} disabled={disabled} className={adminButtonClass("secondary", "sm")}>
            Add colour
          </button>
        }
      />

      {problem && (
        <p role="alert" className="border-b border-border bg-[#8C2F2F]/5 px-5 py-3 text-sm text-[#8C2F2F]">
          {problem}
        </p>
      )}

      {visible.length === 0 ? (
        <AdminEmptyState
          title="No colours yet"
          description="Add a colour to group this product's photographs by colourway. Without one, every photograph is shown for every variant."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {visible.map((colour) => {
            const before = savedByKey.get(colour.key);
            const unsaved =
              !colour.id ||
              colour.deleted ||
              (before &&
                (before.name.trim() !== colour.name.trim() ||
                  before.hex.toUpperCase() !== colour.hex.toUpperCase() ||
                  before.isActive !== colour.isActive));
            const photos = photoCount(colour.key);
            const nameId = `colour-name-${colour.key}`;

            if (colour.deleted) {
              return (
                <li key={colour.key} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm text-muted">
                  <span
                    aria-hidden="true"
                    className="inline-block h-7 w-7 shrink-0 rounded-full border border-border opacity-50"
                    style={{ backgroundColor: colour.hex }}
                  />
                  <span className="flex-1 line-through">{before?.name ?? colour.name}</span>
                  <UnsavedBadge label="Will be deleted" />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => change(colour.key, { deleted: false })}
                    className={adminButtonClass("ghost", "sm")}
                  >
                    <Undo2 size={14} aria-hidden="true" />
                    Undo
                  </button>
                </li>
              );
            }

            return (
              <li key={colour.key} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <input
                  type="color"
                  aria-label={`Swatch for ${colour.name || "new colour"}`}
                  value={colour.hex}
                  disabled={disabled}
                  onChange={(event) => change(colour.key, { hex: event.target.value.toUpperCase() })}
                  className="h-10 w-12 shrink-0 cursor-pointer rounded-control border border-border bg-taraWhite px-1"
                />
                <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                  <label htmlFor={nameId} className="sr-only">
                    Colour name
                  </label>
                  <input
                    id={nameId}
                    value={colour.name}
                    maxLength={60}
                    placeholder="Colour name, e.g. Black"
                    disabled={disabled}
                    onChange={(event) => change(colour.key, { name: event.target.value })}
                    className={cn(adminInputClass, "h-10")}
                  />
                  <p className="font-sans text-xs text-muted">
                    <span className="font-mono">{colour.hex}</span>
                    {" · "}
                    {photos === 0 ? (
                      <span className="text-[#8A6A1F]">no photographs yet</span>
                    ) : (
                      `${photos} photograph${photos === 1 ? "" : "s"}`
                    )}
                  </p>
                </div>
                <label className="flex items-center gap-2 font-sans text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={colour.isActive}
                    disabled={disabled}
                    onChange={(event) => change(colour.key, { isActive: event.target.checked })}
                    className="h-4 w-4 accent-[#702D42]"
                  />
                  Offered on the storefront
                </label>
                {unsaved && <UnsavedBadge label={colour.id ? "Unsaved" : "New"} />}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => remove(colour)}
                  title="Delete colour"
                  className={adminButtonClass("secondary", "sm", "w-9 px-0 text-[#8C2F2F] hover:border-[#8C2F2F]")}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  <span className="sr-only">Delete {colour.name || "this colour"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
