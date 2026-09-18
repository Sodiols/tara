"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSizeLabel } from "@/lib/product-size";
import {
  PLACEHOLDER_SIZE_PRESETS,
  SIZE_PRESETS,
  addSizes,
  parseSizeList,
  type BuilderColour,
  type VariantRow,
} from "@/lib/product-builder";
import { Badge, adminButtonClass, adminInputClass } from "../ui";

/**
 * Sizes, variants and opening stock — step 3 of the builder.
 *
 * The administrator picks sizes; the colours come from step 2 and are never
 * typed again here. Every colour × size combination becomes a row, with a SKU
 * suggested in the house style and an opening stock of zero. Rows can be left
 * out without losing what was typed in them.
 *
 * A row that has been created is locked. Its stock can then only move through
 * the audited inventory adjustment, which lives on the product editor and the
 * Inventory page — that is the rule this screen is not allowed to bend.
 *
 * On a phone each row is a small card of labelled fields rather than a table
 * nobody can read at 375px.
 */
export function VariantBuilder({
  colours,
  sizes,
  onSizesChange,
  rows,
  onRowChange,
  onBulkStock,
  disabled,
}: {
  colours: BuilderColour[];
  sizes: string[];
  onSizesChange: (sizes: string[]) => void;
  rows: VariantRow[];
  onRowChange: (key: string, change: Partial<VariantRow>) => void;
  onBulkStock: (stock: string) => void;
  disabled: boolean;
}) {
  const [customSize, setCustomSize] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const colourByKey = new Map(colours.map((colour) => [colour.key, colour]));
  const namedColours = colours.filter((colour) => colour.name.trim());

  const toggleSize = (size: string) => {
    if (sizes.some((entry) => entry.toLowerCase() === size.toLowerCase())) {
      // A size with a created variant stays: that variant exists now.
      const inUse = rows.some(
        (row) => row.variantId && row.size.toLowerCase() === size.toLowerCase(),
      );
      if (inUse) return;
      onSizesChange(sizes.filter((entry) => entry.toLowerCase() !== size.toLowerCase()));
    } else {
      onSizesChange(addSizes(sizes, [size]));
    }
  };

  const addCustom = () => {
    const additions = parseSizeList(customSize);
    if (additions.length === 0) return;
    onSizesChange(addSizes(sizes, additions));
    setCustomSize("");
  };

  const presets = [...SIZE_PRESETS, ...PLACEHOLDER_SIZE_PRESETS];
  const custom = sizes.filter(
    (size) => !presets.some((preset) => preset.toLowerCase() === size.toLowerCase()),
  );
  const included = rows.filter((row) => !row.excluded || row.variantId);

  return (
    <div className="flex flex-col gap-6">
      {/* Sizes */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-sans text-[12px] font-semibold uppercase tracking-wide text-ink">
          Sizes
        </legend>
        <div className="flex flex-wrap gap-2">
          {presets.map((size) => {
            const selected = sizes.some((entry) => entry.toLowerCase() === size.toLowerCase());
            return (
              <button
                key={size}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => toggleSize(size)}
                className={cn(
                  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border px-3 font-sans text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  selected
                    ? "border-taraWine bg-taraWine text-taraIvory"
                    : "border-border bg-taraWhite text-ink hover:border-taraWine",
                )}
              >
                {formatSizeLabel(size)}
              </button>
            );
          })}
          {custom.map((size) => (
            <button
              key={size}
              type="button"
              disabled={disabled}
              aria-pressed="true"
              onClick={() => toggleSize(size)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-taraWine bg-taraWine px-3 font-sans text-sm font-semibold text-taraIvory disabled:opacity-60"
            >
              {size}
              <X size={13} aria-hidden="true" />
              <span className="sr-only">Remove size {size}</span>
            </button>
          ))}
        </div>
        <div className="flex max-w-md gap-2">
          <label htmlFor="builder-custom-size" className="sr-only">
            Other sizes
          </label>
          <input
            id="builder-custom-size"
            value={customSize}
            disabled={disabled}
            onChange={(event) => setCustomSize(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustom();
              }
            }}
            placeholder="Other sizes, e.g. 38, 40, 42"
            className={adminInputClass}
          />
          <button
            type="button"
            disabled={disabled || !customSize.trim()}
            onClick={addCustom}
            className={adminButtonClass("secondary", "md")}
          >
            <Plus size={14} aria-hidden="true" />
            Add
          </button>
        </div>
        <p className="text-xs leading-5 text-muted">
          One Size and Unready are for products that are not sold by size.
        </p>
      </fieldset>

      {/* The grid */}
      {namedColours.length === 0 ? (
        <p className="rounded-control border border-dashed border-border bg-taraIvory/50 px-4 py-5 text-center font-sans text-sm text-muted">
          Name at least one colour in step 2 — variants are built from the colours.
        </p>
      ) : sizes.length === 0 ? (
        <p className="rounded-control border border-dashed border-border bg-taraIvory/50 px-4 py-5 text-center font-sans text-sm text-muted">
          Choose the sizes above and every colour and size combination appears here.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="font-sans text-sm text-ink">
              <strong>{included.length}</strong> variant{included.length === 1 ? "" : "s"} ·{" "}
              {namedColours.length} colour{namedColours.length === 1 ? "" : "s"} × {sizes.length} size
              {sizes.length === 1 ? "" : "s"}
            </p>
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="builder-bulk-stock"
                  className="font-sans text-[11px] font-semibold uppercase tracking-wide text-muted"
                >
                  Opening stock for all
                </label>
                <input
                  id="builder-bulk-stock"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={bulkStock}
                  disabled={disabled}
                  onChange={(event) => setBulkStock(event.target.value)}
                  className={cn(adminInputClass, "h-9 w-24")}
                />
              </div>
              <button
                type="button"
                disabled={disabled || bulkStock === ""}
                onClick={() => onBulkStock(bulkStock)}
                className={adminButtonClass("secondary", "sm")}
              >
                Apply
              </button>
            </div>
          </div>

          {/* Column headings, wide screens only */}
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,1.3fr)_70px_minmax(0,1.6fr)_90px_110px_80px_88px] gap-2 border-b border-border px-3 pb-2 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted lg:grid"
          >
            <span>Colour</span>
            <span>Size</span>
            <span>SKU</span>
            <span>Stock</span>
            <span>Price (৳)</span>
            <span>Low at</span>
            <span className="text-right">Include</span>
          </div>

          <ul className="flex flex-col gap-2">
            {rows.map((row) => {
              const colour = colourByKey.get(row.colourKey);
              const created = Boolean(row.variantId);
              const locked = disabled || created;
              const label = `${colour?.name.trim() || "Colour"} / ${formatSizeLabel(row.size)}`;
              return (
                <li
                  key={row.key}
                  className={cn(
                    "grid grid-cols-2 gap-2 rounded-control border px-3 py-3 lg:grid-cols-[minmax(0,1.3fr)_70px_minmax(0,1.6fr)_90px_110px_80px_88px] lg:items-center lg:py-2",
                    row.error ? "border-[#8C2F2F]/50 bg-[#8C2F2F]/5" : "border-border bg-taraWhite",
                    row.excluded && !created && "opacity-55",
                  )}
                >
                  <div className="col-span-2 flex min-w-0 items-center gap-2 lg:col-span-1">
                    <span
                      aria-hidden="true"
                      className="inline-block h-4 w-4 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: colour?.hex ?? "#FFFFFF" }}
                    />
                    <span className="truncate font-sans text-sm font-semibold text-ink">
                      {colour?.name.trim() || "Unnamed colour"}
                    </span>
                    <span className="font-sans text-sm text-muted lg:hidden">
                      · {formatSizeLabel(row.size)}
                    </span>
                    {created && (
                      <Badge tone="success" className="ml-auto lg:ml-1">
                        Created
                      </Badge>
                    )}
                  </div>
                  <span className="hidden font-sans text-sm text-ink lg:block">
                    {formatSizeLabel(row.size)}
                  </span>

                  <RowField label="SKU" id={`sku-${row.key}`} className="col-span-2 lg:col-span-1">
                    <input
                      id={`sku-${row.key}`}
                      value={row.sku}
                      disabled={locked || row.excluded}
                      maxLength={40}
                      aria-label={`SKU for ${label}`}
                      aria-invalid={Boolean(row.error)}
                      onChange={(event) =>
                        onRowChange(row.key, {
                          sku: event.target.value.toUpperCase(),
                          skuEdited: true,
                          error: null,
                        })
                      }
                      className={cn(adminInputClass, "h-9 font-mono text-xs")}
                    />
                  </RowField>
                  <RowField label="Opening stock" id={`stock-${row.key}`}>
                    <input
                      id={`stock-${row.key}`}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={row.openingStock}
                      disabled={locked || row.excluded}
                      aria-label={`Opening stock for ${label}`}
                      onChange={(event) =>
                        onRowChange(row.key, { openingStock: event.target.value, error: null })
                      }
                      className={cn(adminInputClass, "h-9")}
                    />
                  </RowField>
                  <RowField label="Price override (৳)" id={`price-${row.key}`}>
                    <input
                      id={`price-${row.key}`}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Product price"
                      value={row.priceOverride}
                      disabled={locked || row.excluded}
                      aria-label={`Price override for ${label}`}
                      onChange={(event) =>
                        onRowChange(row.key, { priceOverride: event.target.value, error: null })
                      }
                      className={cn(adminInputClass, "h-9")}
                    />
                  </RowField>
                  <RowField label="Low stock at" id={`low-${row.key}`}>
                    <input
                      id={`low-${row.key}`}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={row.lowStockThreshold}
                      disabled={locked || row.excluded}
                      aria-label={`Low stock threshold for ${label}`}
                      onChange={(event) =>
                        onRowChange(row.key, { lowStockThreshold: event.target.value, error: null })
                      }
                      className={cn(adminInputClass, "h-9")}
                    />
                  </RowField>
                  <div className="flex items-end justify-end lg:items-center">
                    {created ? (
                      <span className="font-sans text-xs text-muted">Saved</span>
                    ) : (
                      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 font-sans text-xs font-semibold text-ink">
                        <input
                          type="checkbox"
                          checked={!row.excluded}
                          disabled={disabled}
                          onChange={(event) =>
                            onRowChange(row.key, { excluded: !event.target.checked, error: null })
                          }
                          className="h-4 w-4 accent-[#702D42]"
                        />
                        <span className="lg:sr-only">Include</span>
                        <span className="sr-only"> {label}</span>
                      </label>
                    )}
                  </div>

                  {row.error && (
                    <p role="alert" className="col-span-2 font-sans text-xs text-[#8C2F2F] lg:col-span-7">
                      {label}: {row.error}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs leading-5 text-muted">
            Opening stock is set once, when the variant is created. After that, stock changes go
            through Inventory with a reason, so every movement is recorded.
          </p>
        </div>
      )}
    </div>
  );
}

/** A labelled cell: the label is visible on a phone and hidden on the table. */
function RowField({
  label,
  id,
  className,
  children,
}: {
  label: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label
        htmlFor={id}
        className="font-sans text-[11px] font-semibold uppercase tracking-wide text-muted lg:hidden"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
