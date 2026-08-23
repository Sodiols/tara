"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { collectionLinks } from "@/data/navigation";
import { NavigationChevron } from "./NavigationChevron";

interface MobileCollectionAccordionProps {
  onNavigate: () => void;
}

export function MobileCollectionAccordion({ onNavigate }: MobileCollectionAccordionProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const handleSelect = () => {
    setOpen(false);
    onNavigate();
  };

  return (
    <div className="border-b border-border/60">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between h-14 px-5 text-sm uppercase tracking-wide text-ink"
      >
        {"Collection"}
        <NavigationChevron open={open} size={16} />
      </button>

      <div
        id={panelId}
        className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col bg-cream pb-1">
            {collectionLinks.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleSelect}
                  className={cn(
                    "flex items-center min-h-[48px] pl-12 pr-5 text-sm border-b border-border/40 last:border-b-0 transition-colors",
                    active ? "text-wine" : "text-ink"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
