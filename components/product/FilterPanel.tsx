"use client";

import { formatPrice } from "@/lib/utils";
import {
  PRICE_BANDS,
  isPriceBandSelected,
  togglePriceBand,
  toggleListValue,
  type ProductFilters,
} from "@/lib/catalogue-filters";

export interface FilterPanelProps {
  filters: ProductFilters;
  /** Applies a change by navigating; the server re-queries and re-renders. */
  onChange: (next: ProductFilters) => void;
  availableSizes: string[];
  availableColours: string[];
  availableFabrics: string[];
  availableCollections: string[];
  onClearAll: () => void;
  /** True while a filtered result is being fetched. */
  pending?: boolean;
}

export function FilterPanel({
  filters,
  onChange,
  availableSizes,
  availableColours,
  availableFabrics,
  availableCollections,
  onClearAll,
  pending = false,
}: FilterPanelProps) {
  const toggleList = (
    key: "sizes" | "colours" | "fabrics" | "collectionNames",
    value: string,
  ) => {
    onChange({ ...filters, [key]: toggleListValue(filters[key], value) });
  };

  return (
    <div className="flex flex-col gap-8" aria-busy={pending}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-wide text-ink font-medium">{"Filters"}</h2>
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-muted hover:text-wine underline underline-offset-2"
        >
          {"Clear All"}
        </button>
      </div>

      <fieldset>
        <legend className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">
          {"New & Sale"}
        </legend>
        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2.5 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(filters.isNew)}
              onChange={(event) => onChange({ ...filters, isNew: event.target.checked })}
              className="w-4 h-4 accent-wine"
            />
            {"New In"}
          </label>
          <label className="flex items-center gap-2.5 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(filters.onSale)}
              onChange={(event) => onChange({ ...filters, onSale: event.target.checked })}
              className="w-4 h-4 accent-wine"
            />
            {"On Sale"}
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">
          {"Availability"}
        </legend>
        <label className="flex items-center gap-2.5 text-sm text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(filters.inStock)}
            onChange={(event) => onChange({ ...filters, inStock: event.target.checked })}
            className="w-4 h-4 accent-wine"
          />
          {"In Stock Only"}
        </label>
      </fieldset>

      <fieldset>
        <legend className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">
          {"Price"}
        </legend>
        <div className="flex flex-col gap-2.5">
          {PRICE_BANDS.map((band) => (
            <label
              key={`${band.min}-${band.max}`}
              className="flex items-center gap-2.5 text-sm text-muted cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isPriceBandSelected(filters.priceBands, band)}
                onChange={() =>
                  onChange({
                    ...filters,
                    // Each band is kept separate rather than merged into one
                    // wide range, so ticking two bands means "either of these"
                    // and not "everything between them".
                    priceBands: togglePriceBand(filters.priceBands, band),
                  })
                }
                className="w-4 h-4 accent-wine"
              />
              {formatPrice(band.min)} - {formatPrice(band.max)}
            </label>
          ))}
        </div>
      </fieldset>

      {availableSizes.length > 0 && (
        <fieldset>
          <legend className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">
            {"Size"}
          </legend>
          <div className="flex flex-wrap gap-2">
            {availableSizes.map((size) => {
              const selected = Boolean(filters.sizes?.includes(size));
              return (
                <button
                  key={size}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleList("sizes", size)}
                  className={`px-3 py-1.5 text-xs border transition-colors ${
                    selected
                      ? "border-wine bg-wine text-white"
                      : "border-border text-ink hover:border-wine"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {availableColours.length > 0 && (
        <fieldset>
          <legend className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">
            {"Colour"}
          </legend>
          <div className="flex flex-col gap-2.5">
            {availableColours.map((colour) => (
              <label
                key={colour}
                className="flex items-center gap-2.5 text-sm text-muted cursor-pointer capitalize"
              >
                <input
                  type="checkbox"
                  checked={Boolean(filters.colours?.includes(colour))}
                  onChange={() => toggleList("colours", colour)}
                  className="w-4 h-4 accent-wine"
                />
                {colour}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {availableFabrics.length > 0 && (
        <fieldset>
          <legend className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">
            {"Fabric"}
          </legend>
          <div className="flex flex-col gap-2.5">
            {availableFabrics.map((fabric) => (
              <label
                key={fabric}
                className="flex items-center gap-2.5 text-sm text-muted cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={Boolean(filters.fabrics?.includes(fabric))}
                  onChange={() => toggleList("fabrics", fabric)}
                  className="w-4 h-4 accent-wine"
                />
                {fabric}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {availableCollections.length > 0 && (
        <fieldset>
          <legend className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">
            {"Collection"}
          </legend>
          <div className="flex flex-col gap-2.5">
            {availableCollections.map((collection) => (
              <label
                key={collection}
                className="flex items-center gap-2.5 text-sm text-muted cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={Boolean(filters.collectionNames?.includes(collection))}
                  onChange={() => toggleList("collectionNames", collection)}
                  className="w-4 h-4 accent-wine"
                />
                {collection}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
