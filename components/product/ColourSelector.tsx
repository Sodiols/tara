"use client";

import { useLanguage } from "@/lib/i18n";
import type { ColourOption } from "@/types";
import { cn } from "@/lib/utils";

interface ColourSelectorProps {
  colours: ColourOption[];
  selected: string;
  onChange: (colourName: string) => void;
}

export function ColourSelector({ colours, selected, onChange }: ColourSelectorProps) {
  const { t, pick } = useLanguage();
  const selectedColour = colours.find((c) => c.name.en === selected);

  return (
    <div>
      <span className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-muted block mb-2">
        {t("product.colour")}: {selectedColour ? pick(selectedColour.name) : ""}
      </span>
      <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={t("product.selectColour")}>
        {colours.map((colour) => (
          <button
            key={colour.name.en}
            role="radio"
            aria-checked={selected === colour.name.en}
            aria-label={pick(colour.name)}
            onClick={() => onChange(colour.name.en)}
            className={cn(
              "w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center",
              selected === colour.name.en ? "border-wine" : "border-transparent hover:border-taraTaupe"
            )}
          >
            <span
              className="w-7 h-7 rounded-full border border-border/50"
              style={{ backgroundColor: colour.hex }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
