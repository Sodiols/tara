"use client";

import { cn } from "@/lib/utils";
import type { SizeChoice } from "@/lib/product-variants";

interface SizeSelectorProps {
  /**
   * Every size the product comes in, each carrying whether it can be bought in
   * the colour currently chosen. Sizes are disabled rather than removed: a row
   * of buttons that changes length as a colour is picked makes a shopper lose
   * their place, and it hides the fact that the size exists at all.
   */
  sizes: SizeChoice[];
  selected: string;
  onChange: (size: string) => void;
  onOpenGuide?: () => void;
}

export function SizeSelector({ sizes, selected, onChange, onOpenGuide }: SizeSelectorProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-muted">
          {"Size"}: {selected}
        </span>
        {onOpenGuide && (
          <button
            type="button"
            onClick={onOpenGuide}
            className="font-sans font-medium text-xs text-ink underline underline-offset-2 hover:text-wine"
          >
            {"Size Guide"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={"Select Size"}>
        {sizes.map(({ size, selectable }) => (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={selected === size}
            // Disabled rather than aria-disabled: there is nothing useful to do
            // with a size that cannot be bought, and a real `disabled` takes it
            // out of the tab order so a keyboard user is not walked through
            // options that reject them.
            disabled={!selectable}
            // The state is carried by the accessible name too, not by the
            // strike-through alone — a screen reader user gets the same
            // information a sighted one does from the styling.
            aria-label={selectable ? size : `${size} — unavailable`}
            onClick={() => onChange(size)}
            className={cn(
              "h-11 min-w-[3rem] rounded-control px-3 font-sans font-medium text-xs border transition-colors",
              selected === size
                ? "border-wine bg-wine text-white"
                : "border-border text-ink hover:border-wine",
              !selectable &&
                "cursor-not-allowed border-border/60 bg-cream text-muted line-through hover:border-border/60",
            )}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}
