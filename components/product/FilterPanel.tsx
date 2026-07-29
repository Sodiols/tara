"use client";

import { useLanguage } from "@/lib/i18n";
import { formatPrice } from "@/lib/utils";
import type { FilterState } from "@/hooks/useProductFilters";

interface FilterPanelProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  availableSizes: string[];
  availableColours: string[];
  availableFabrics: string[];
  availableCollections: string[];
  onClearAll: () => void;
}

const priceRanges: [number, number][] = [
  [0, 1500],
  [1500, 2500],
  [2500, 3500],
  [3500, 10000],
];

export function FilterPanel({
  filters,
  setFilters,
  availableSizes,
  availableColours,
  availableFabrics,
  availableCollections,
  onClearAll,
}: FilterPanelProps) {
  const { t } = useLanguage();

  const toggleArrayValue = (key: "sizes" | "colours" | "fabrics" | "collections", value: string) => {
    setFilters((prev) => {
      const current = prev[key];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-wide text-ink font-medium">{t("listing.filters")}</h2>
        <button onClick={onClearAll} className="text-xs text-muted hover:text-wine underline underline-offset-2">
          {t("common.clearAll")}
        </button>
      </div>

      <div>
        <h3 className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">{t("listing.newAndSale")}</h3>
        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2.5 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={filters.newIn}
              onChange={(e) => setFilters((p) => ({ ...p, newIn: e.target.checked }))}
              className="w-4 h-4 accent-wine"
            />
            {t("listing.newIn")}
          </label>
          <label className="flex items-center gap-2.5 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={filters.onSale}
              onChange={(e) => setFilters((p) => ({ ...p, onSale: e.target.checked }))}
              className="w-4 h-4 accent-wine"
            />
            {t("listing.onSale")}
          </label>
        </div>
      </div>

      <div>
        <h3 className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">{t("listing.availability")}</h3>
        <label className="flex items-center gap-2.5 text-sm text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(e) => setFilters((p) => ({ ...p, inStockOnly: e.target.checked }))}
            className="w-4 h-4 accent-wine"
          />
          {t("listing.inStockOnly")}
        </label>
      </div>

      <div>
        <h3 className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">{t("listing.price")}</h3>
        <div className="flex flex-col gap-2.5">
          {priceRanges.map((range) => (
            <label key={range.join("-")} className="flex items-center gap-2.5 text-sm text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={filters.priceRanges.some((r) => r[0] === range[0] && r[1] === range[1])}
                onChange={() =>
                  setFilters((prev) => {
                    const exists = prev.priceRanges.some((r) => r[0] === range[0] && r[1] === range[1]);
                    return {
                      ...prev,
                      priceRanges: exists
                        ? prev.priceRanges.filter((r) => !(r[0] === range[0] && r[1] === range[1]))
                        : [...prev.priceRanges, range],
                    };
                  })
                }
                className="w-4 h-4 accent-wine"
              />
              {formatPrice(range[0])} - {formatPrice(range[1])}
            </label>
          ))}
        </div>
      </div>

      {availableSizes.length > 0 && (
        <div>
          <h3 className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">{t("listing.size")}</h3>
          <div className="flex flex-wrap gap-2">
            {availableSizes.map((size) => (
              <button
                key={size}
                onClick={() => toggleArrayValue("sizes", size)}
                className={`px-3 py-1.5 text-xs border transition-colors ${
                  filters.sizes.includes(size) ? "border-wine bg-wine text-white" : "border-border text-ink hover:border-wine"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {availableColours.length > 0 && (
        <div>
          <h3 className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">{t("listing.colour")}</h3>
          <div className="flex flex-col gap-2.5">
            {availableColours.map((colour) => (
              <label key={colour} className="flex items-center gap-2.5 text-sm text-muted cursor-pointer capitalize">
                <input
                  type="checkbox"
                  checked={filters.colours.includes(colour)}
                  onChange={() => toggleArrayValue("colours", colour)}
                  className="w-4 h-4 accent-wine"
                />
                {colour}
              </label>
            ))}
          </div>
        </div>
      )}

      {availableFabrics.length > 0 && (
        <div>
          <h3 className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">{t("listing.fabric")}</h3>
          <div className="flex flex-col gap-2.5">
            {availableFabrics.map((fabric) => (
              <label key={fabric} className="flex items-center gap-2.5 text-sm text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.fabrics.includes(fabric)}
                  onChange={() => toggleArrayValue("fabrics", fabric)}
                  className="w-4 h-4 accent-wine"
                />
                {fabric}
              </label>
            ))}
          </div>
        </div>
      )}

      {availableCollections.length > 0 && (
        <div>
          <h3 className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-ink mb-3">{t("listing.collectionFilter")}</h3>
          <div className="flex flex-col gap-2.5">
            {availableCollections.map((collection) => (
              <label key={collection} className="flex items-center gap-2.5 text-sm text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.collections.includes(collection)}
                  onChange={() => toggleArrayValue("collections", collection)}
                  className="w-4 h-4 accent-wine"
                />
                {collection}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
