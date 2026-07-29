"use client";

import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface SizeSelectorProps {
  sizes: string[];
  selected: string;
  onChange: (size: string) => void;
  onOpenGuide?: () => void;
}

export function SizeSelector({ sizes, selected, onChange, onOpenGuide }: SizeSelectorProps) {
  const { t } = useLanguage();
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-muted">
          {t("product.size")}: {selected}
        </span>
        {onOpenGuide && (
          <button
            onClick={onOpenGuide}
            className="font-sans font-medium text-xs text-ink underline underline-offset-2 hover:text-wine"
          >
            {t("product.sizeGuide")}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("product.selectSize")}>
        {sizes.map((size) => (
          <button
            key={size}
            role="radio"
            aria-checked={selected === size}
            onClick={() => onChange(size)}
            className={cn(
              "h-11 min-w-[3rem] rounded-control px-3 font-sans font-medium text-xs border transition-colors",
              selected === size
                ? "border-wine bg-wine text-white"
                : "border-border text-ink hover:border-wine"
            )}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}
