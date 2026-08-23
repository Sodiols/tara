"use client";

import type { ColourOption } from "@/types";
import { cn } from "@/lib/utils";

interface ColourSelectorProps {
  colours: ColourOption[];
  selected: string;
  onChange: (colourName: string) => void;
}

export function ColourSelector({ colours, selected, onChange }: ColourSelectorProps) {
  const selectedColour = colours.find((c) => c.name === selected);

  return (
    <div>
      <span className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-muted block mb-2">
        {"Colour"}: {selectedColour ? selectedColour.name : ""}
      </span>
      <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={"Select Colour"}>
        {colours.map((colour) => (
          <button
            key={colour.name}
            role="radio"
            aria-checked={selected === colour.name}
            aria-label={colour.name}
            onClick={() => onChange(colour.name)}
            className={cn(
              "w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center",
              selected === colour.name ? "border-wine" : "border-transparent hover:border-taraTaupe"
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
