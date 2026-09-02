"use client";

import { cn } from "@/lib/utils";
import type { ColourChoice } from "@/lib/product-variants";

interface ColourSelectorProps {
  /**
   * Every colour the product comes in, each carrying whether it can be bought
   * in the size currently chosen. Disabled rather than removed, for the same
   * reason as the size row.
   */
  colours: ColourChoice[];
  selected: string;
  onChange: (colourName: string) => void;
}

export function ColourSelector({ colours, selected, onChange }: ColourSelectorProps) {
  const selectedColour = colours.find((colour) => colour.name === selected);

  return (
    <div>
      <span className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-muted block mb-2">
        {"Colour"}: {selectedColour ? selectedColour.name : ""}
      </span>
      <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={"Select Colour"}>
        {colours.map((colour) => (
          <button
            key={colour.name}
            type="button"
            role="radio"
            aria-checked={selected === colour.name}
            disabled={!colour.selectable}
            // A swatch has no text, so the name is the only thing a screen
            // reader has to go on — and it is where the unavailability has to
            // be stated, since the visual cue is a diagonal line.
            aria-label={
              colour.selectable ? colour.name : `${colour.name} — unavailable`
            }
            title={colour.name}
            onClick={() => onChange(colour.name)}
            className={cn(
              "relative w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center",
              selected === colour.name ? "border-wine" : "border-transparent hover:border-taraTaupe",
              !colour.selectable && "cursor-not-allowed opacity-45 hover:border-transparent",
            )}
          >
            <span
              className="w-7 h-7 rounded-full border border-border/50"
              style={{ backgroundColor: colour.hex }}
            />
            {/*
              A struck-through swatch, drawn rather than coloured: opacity alone
              is a contrast change, and contrast alone is not allowed to be the
              only carrier of a state.
            */}
            {!colour.selectable && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute h-[1.5px] w-8 rotate-45 rounded bg-ink/70"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
