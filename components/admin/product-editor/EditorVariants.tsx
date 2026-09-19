"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { INVENTORY_REASONS } from "@/lib/order-status";
import { formatTaka } from "@/lib/format";
import { formatSizeLabel } from "@/lib/product-size";
import { suggestVariantSku } from "@/lib/product-sku";
import {
  hasStockChange,
  type EditorDraft,
  type VariantDraft,
} from "@/lib/product-editor-draft";
import { cn } from "@/lib/utils";
import { StockBadge } from "../status";
import {
  AdminEmptyState,
  Field,
  Panel,
  PanelHeader,
  adminButtonClass,
  adminInputClass,
  adminSelectClass,
} from "../ui";
import { UnsavedBadge, newDraftKey, type DraftUpdater } from "./shared";

/**
 * Every size and colour customers can buy, edited in place.
 *
 * Nothing is written until Save changes. A new variant carries an opening
 * stock, written with the row. The stock of a variant that exists is never an
 * input: "Adjust stock" records a new quantity and a reason, and Save changes
 * sends it through the audited inventory adjustment, so every movement still
 * leaves an `inventory_adjustments` row.
 *
 * A variant that exists cannot be deleted — orders reference it. "Available to
 * buy" is how one is retired.
 */
export function EditorVariants({
  draft,
  saved,
  update,
  problems,
  productCode,
  disabled,
}: {
  draft: EditorDraft;
  saved: EditorDraft;
  update: DraftUpdater;
  problems: Map<string, string>;
  productCode: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [stockOpen, setStockOpen] = useState<Set<string>>(() => new Set());
  // New rows whose SKU somebody typed; the suggestion stops following them.
  const [skuTyped, setSkuTyped] = useState<Set<string>>(() => new Set());

  const colours = draft.colours.filter((colour) => !colour.deleted);
  const colourByKey = new Map(draft.colours.map((colour) => [colour.key, colour]));
  const savedByKey = new Map(saved.variants.map((variant) => [variant.key, variant]));
  const usesColourRows = colours.length > 0;

  const toggle = (set: Set<string>, key: string, on?: boolean) => {
    const next = new Set(set);
    if (on ?? !next.has(key)) next.add(key);
    else next.delete(key);
    return next;
  };

  const colourName = (variant: VariantDraft) =>
    variant.colourKey ? (colourByKey.get(variant.colourKey)?.name.trim() ?? "") : variant.colourName;
  const colourHex = (variant: VariantDraft) =>
    variant.colourKey ? (colourByKey.get(variant.colourKey)?.hex ?? "#FFFFFF") : variant.colourHex;

  const change = (key: string, patch: Partial<VariantDraft>) =>
    update((current) => ({
      ...current,
      variants: current.variants.map((variant) => {
        if (variant.key !== key) return variant;
        const next = { ...variant, ...patch };
        // A new row's SKU follows its size and colour until somebody types one.
        if (!variant.id && !skuTyped.has(key) && !("sku" in patch)) {
          const name = next.colourKey
            ? (current.colours.find((colour) => colour.key === next.colourKey)?.name ?? "")
            : next.colourName;
          next.sku = suggestVariantSku(productCode, next.size, name);
        }
        return next;
      }),
    }));

  const add = () => {
    const key = newDraftKey("variant");
    const first = colours[0];
    update((current) => ({
      ...current,
      variants: [
        ...current.variants,
        {
          key,
          id: null,
          size: "",
          colourKey: first?.key ?? null,
          colourName: "",
          colourHex: "#702D42",
          sku: suggestVariantSku(productCode, "", first?.name ?? ""),
          priceOverride: "",
          lowStockThreshold: "3",
          isActive: true,
          openingStock: "0",
          stock: 0,
          stockChange: null,
        },
      ],
    }));
    setOpen((set) => toggle(set, key, true));
  };

  return (
    <Panel id="variants">
      <PanelHeader
        title="Variants"
        description="Every size and colour combination customers can buy."
        actions={
          <button type="button" onClick={add} disabled={disabled} className={adminButtonClass("secondary", "sm")}>
            Add variant
          </button>
        }
      />

      {draft.variants.length === 0 ? (
        <AdminEmptyState
          title="No variants yet"
          description="A product needs at least one active variant before customers can buy it."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {draft.variants.map((variant) => {
            const before = savedByKey.get(variant.key);
            const stockPending = hasStockChange(variant);
            const edited =
              before &&
              (before.size.trim() !== variant.size.trim() ||
                before.colourKey !== variant.colourKey ||
                before.colourName.trim() !== variant.colourName.trim() ||
                before.colourHex.toUpperCase() !== variant.colourHex.toUpperCase() ||
                before.sku.trim().toUpperCase() !== variant.sku.trim().toUpperCase() ||
                before.priceOverride.trim() !== variant.priceOverride.trim() ||
                before.lowStockThreshold.trim() !== variant.lowStockThreshold.trim() ||
                before.isActive !== variant.isActive);
            const problem = problems.get(variant.key);
            const isOpen = open.has(variant.key) || Boolean(problem && !stockPending);
            const threshold = Number(variant.lowStockThreshold) || 0;
            const id = (field: string) => `variant-${field}-${variant.key}`;

            return (
              <li key={variant.key} className={cn("px-5 py-4", problem && "bg-[#8C2F2F]/5")}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="min-w-[3rem] font-sans text-sm font-semibold text-ink">
                    {variant.size.trim() ? formatSizeLabel(variant.size) : "New size"}
                  </span>
                  <span className="inline-flex items-center gap-2 font-sans text-sm text-ink">
                    <span
                      aria-hidden="true"
                      className="inline-block h-3 w-3 rounded-full border border-border"
                      style={{ backgroundColor: colourHex(variant) }}
                    />
                    {colourName(variant) || "—"}
                  </span>
                  <span className="font-mono text-xs text-muted">{variant.sku || "no SKU"}</span>
                  {variant.priceOverride.trim() && Number(variant.priceOverride) >= 0 && (
                    <span className="font-sans text-xs text-muted">{formatTaka(Number(variant.priceOverride))}</span>
                  )}
                  <span className="flex flex-wrap items-center gap-1.5">
                    {variant.id ? (
                      <StockBadge stock={variant.stock} threshold={threshold} />
                    ) : (
                      <UnsavedBadge label="New" />
                    )}
                    {!variant.isActive && (
                      <span className="font-sans text-[11px] uppercase tracking-wide text-muted">Hidden</span>
                    )}
                    {edited && <UnsavedBadge />}
                    {stockPending && (
                      <UnsavedBadge label={`Stock → ${variant.stockChange?.newQuantity}`} />
                    )}
                  </span>
                  <span className="ml-auto flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setOpen((set) => toggle(set, variant.key))}
                      aria-expanded={isOpen}
                      className={adminButtonClass("ghost", "sm")}
                    >
                      {isOpen ? "Done" : "Edit"}
                    </button>
                    {variant.id ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          const opening = !stockOpen.has(variant.key);
                          setStockOpen((set) => toggle(set, variant.key));
                          if (opening && !variant.stockChange) {
                            change(variant.key, {
                              stockChange: { newQuantity: String(variant.stock), reason: "restock", note: "" },
                            });
                          }
                        }}
                        aria-expanded={stockOpen.has(variant.key)}
                        className={adminButtonClass("secondary", "sm")}
                      >
                        Adjust stock
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          update((current) => ({
                            ...current,
                            variants: current.variants.filter((entry) => entry.key !== variant.key),
                          }))
                        }
                        className={adminButtonClass("secondary", "sm", "w-9 px-0")}
                        title="Remove this new variant"
                      >
                        <X size={15} aria-hidden="true" />
                        <span className="sr-only">Remove this new variant</span>
                      </button>
                    )}
                  </span>
                </div>

                {problem && (
                  <p role="alert" className="mt-2 text-xs text-[#8C2F2F]">
                    {problem}
                  </p>
                )}

                {isOpen && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Size" htmlFor={id("size")} required>
                      <input
                        id={id("size")}
                        value={variant.size}
                        maxLength={40}
                        placeholder="M, L, Unready"
                        disabled={disabled}
                        onChange={(event) => change(variant.key, { size: event.target.value })}
                        className={adminInputClass}
                      />
                    </Field>
                    {usesColourRows && (variant.colourKey !== null || !variant.id) ? (
                      <Field label="Colour" htmlFor={id("colour")} required hint="Defined in Colours, above.">
                        <select
                          id={id("colour")}
                          value={variant.colourKey ?? ""}
                          disabled={disabled}
                          onChange={(event) => change(variant.key, { colourKey: event.target.value || null })}
                          className={adminSelectClass}
                        >
                          {colours.map((colour) => (
                            <option key={colour.key} value={colour.key}>
                              {colour.name.trim() || "New colour"}
                              {colour.isActive ? "" : " (hidden)"}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <Field label="Colour" htmlFor={id("colour-name")} required>
                        <div className="flex gap-2">
                          <input
                            id={id("colour-name")}
                            value={variant.colourName}
                            maxLength={60}
                            disabled={disabled}
                            onChange={(event) => change(variant.key, { colourName: event.target.value })}
                            className={adminInputClass}
                          />
                          <input
                            type="color"
                            aria-label="Colour swatch"
                            value={variant.colourHex}
                            disabled={disabled}
                            onChange={(event) =>
                              change(variant.key, { colourHex: event.target.value.toUpperCase() })
                            }
                            className="h-11 w-14 shrink-0 cursor-pointer rounded-control border border-border bg-taraWhite px-1"
                          />
                        </div>
                      </Field>
                    )}
                    {variant.id ? (
                      <Field label="Stock" hint="Changed through Adjust stock, with a reason.">
                        <p className="flex h-11 items-center rounded-control border border-border bg-taraIvory px-3 font-sans text-sm text-muted">
                          {variant.stock} in stock
                        </p>
                      </Field>
                    ) : (
                      <Field label="Opening stock" htmlFor={id("opening")} hint="Later changes go through Adjust stock.">
                        <input
                          id={id("opening")}
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={variant.openingStock}
                          disabled={disabled}
                          onChange={(event) => change(variant.key, { openingStock: event.target.value })}
                          className={adminInputClass}
                        />
                      </Field>
                    )}
                    <Field label="SKU" htmlFor={id("sku")} required hint="Unique across the store.">
                      <input
                        id={id("sku")}
                        value={variant.sku}
                        maxLength={40}
                        disabled={disabled}
                        onChange={(event) => {
                          setSkuTyped((set) => toggle(set, variant.key, true));
                          change(variant.key, { sku: event.target.value.toUpperCase() });
                        }}
                        className={adminInputClass}
                      />
                    </Field>
                    <Field label="Price override (৳)" htmlFor={id("price")} hint="Blank uses the product price.">
                      <input
                        id={id("price")}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={variant.priceOverride}
                        disabled={disabled}
                        onChange={(event) => change(variant.key, { priceOverride: event.target.value })}
                        className={adminInputClass}
                      />
                    </Field>
                    <Field label="Low stock threshold" htmlFor={id("threshold")}>
                      <input
                        id={id("threshold")}
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={variant.lowStockThreshold}
                        disabled={disabled}
                        onChange={(event) => change(variant.key, { lowStockThreshold: event.target.value })}
                        className={adminInputClass}
                      />
                    </Field>
                    <label className="flex items-center gap-2 self-end pb-3 font-sans text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={variant.isActive}
                        disabled={disabled}
                        onChange={(event) => change(variant.key, { isActive: event.target.checked })}
                        className="h-4 w-4 accent-[#702D42]"
                      />
                      Available to buy
                    </label>
                  </div>
                )}

                {variant.id && stockOpen.has(variant.key) && variant.stockChange && (
                  <div className="mt-4 flex flex-col gap-3 rounded-control border border-border bg-taraIvory/60 p-3">
                    <p className="font-sans text-xs text-muted">
                      Currently {variant.stock}. The new quantity is recorded with its reason when you save.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,14rem)_minmax(0,1fr)]">
                      <Field label="New stock" htmlFor={id("stock")}>
                        <input
                          id={id("stock")}
                          type="number"
                          min={0}
                          max={1000000}
                          step={1}
                          inputMode="numeric"
                          value={variant.stockChange.newQuantity}
                          disabled={disabled}
                          onChange={(event) =>
                            change(variant.key, {
                              stockChange: { ...variant.stockChange!, newQuantity: event.target.value },
                            })
                          }
                          className={adminInputClass}
                        />
                      </Field>
                      <Field label="Reason" htmlFor={id("reason")}>
                        <select
                          id={id("reason")}
                          value={variant.stockChange.reason}
                          disabled={disabled}
                          onChange={(event) =>
                            change(variant.key, {
                              stockChange: { ...variant.stockChange!, reason: event.target.value },
                            })
                          }
                          className={adminSelectClass}
                        >
                          {INVENTORY_REASONS.map((reason) => (
                            <option key={reason.value} value={reason.value}>
                              {reason.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Note" htmlFor={id("note")}>
                        <input
                          id={id("note")}
                          maxLength={500}
                          placeholder="Optional — e.g. delivery from supplier"
                          value={variant.stockChange.note}
                          disabled={disabled}
                          onChange={(event) =>
                            change(variant.key, {
                              stockChange: { ...variant.stockChange!, note: event.target.value },
                            })
                          }
                          className={adminInputClass}
                        />
                      </Field>
                    </div>
                    <div>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          change(variant.key, { stockChange: null });
                          setStockOpen((set) => toggle(set, variant.key, false));
                        }}
                        className={adminButtonClass("ghost", "sm")}
                      >
                        Cancel stock change
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
