"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SectionNavItem {
  id: string;
  label: string;
  /** "1", "2"… on the builder. */
  number?: string;
  /** done: nothing required is missing. error: something required is. */
  state?: "done" | "error";
}

/**
 * The map of a long page, and the way around it.
 *
 * On a wide screen it is a sticky column beside the content; on a phone it is a
 * row of chips that scrolls sideways under the admin bar. Both are ordinary
 * links to the section ids, so they work with the keyboard, with the back
 * button and without JavaScript — the script only adds the highlight that says
 * where you are.
 *
 * States are drawn with an icon AND spelled out for screen readers, never with
 * colour alone.
 */
export function AdminSectionNav({
  items,
  label = "Sections",
}: {
  items: SectionNavItem[];
  label?: string;
}) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    // The section whose top has most recently passed a line a third of the way
    // down the screen is the one being read.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    );
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [items]);

  const stateText = (state: SectionNavItem["state"]) =>
    state === "done" ? " (complete)" : state === "error" ? " (needs attention)" : "";

  return (
    <nav aria-label={label}>
      {/* Phone and tablet: a sideways-scrolling row, sticky under the bar. */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto border-b border-border bg-taraIvory/95 px-4 py-2.5 sm:-mx-6 sm:px-6 lg:hidden">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 font-sans text-xs font-semibold transition-colors",
                active === item.id
                  ? "border-taraWine bg-taraWine text-taraIvory"
                  : "border-border bg-taraWhite text-ink",
              )}
            >
              {item.state === "done" && <Check size={13} aria-hidden="true" />}
              {item.state === "error" && <AlertCircle size={13} aria-hidden="true" />}
              {item.number && <span aria-hidden="true">{item.number}.</span>}
              {item.label}
              <span className="sr-only">{stateText(item.state)}</span>
            </a>
          </li>
        ))}
      </ul>

      {/* Desktop: a column. */}
      <ol className="hidden flex-col gap-0.5 lg:flex">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={cn(
                "flex min-h-10 items-center gap-2.5 rounded-control border-l-[3px] px-3 py-2 font-sans text-sm transition-colors",
                active === item.id
                  ? "border-taraWine bg-taraWhite font-semibold text-ink"
                  : "border-transparent text-muted hover:bg-taraWhite hover:text-ink",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                  item.state === "done" && "border-[#2F5D50] bg-[#2F5D50] text-taraWhite",
                  item.state === "error" && "border-[#8C2F2F] bg-[#8C2F2F]/10 text-[#8C2F2F]",
                  !item.state && "border-border bg-taraWhite text-muted",
                )}
              >
                {item.state === "done" ? (
                  <Check size={13} />
                ) : item.state === "error" ? (
                  <AlertCircle size={13} />
                ) : (
                  item.number ?? "•"
                )}
              </span>
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="sr-only">{stateText(item.state)}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
