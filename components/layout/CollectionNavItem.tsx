"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { NavigationChevron } from "./NavigationChevron";
import { CollectionDropdown } from "./CollectionDropdown";

export function CollectionNavItem() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const active = pathname.startsWith("/collection") || pathname === "/new-arrivals";

  const close = () => setOpen(false);

  // Close on outside click while open.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      buttonRef.current?.focus();
    }
  };

  // Close if focus moves outside the whole nav item (e.g. Tab past the last link).
  const handleBlur = (e: React.FocusEvent) => {
    if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
      close();
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        className={cn(
          "group relative flex items-center gap-1 font-sans font-medium text-[13px] leading-4 tracking-[0.06em] uppercase text-ink py-2",
          (active || open) && "text-wine"
        )}
      >
        {t("nav.collection")}
        <NavigationChevron open={open} />
        <span
          className={cn(
            "absolute left-0 -bottom-0.5 h-px w-full bg-wine origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100",
            (active || open) && "scale-x-100"
          )}
        />
      </button>

      {open && <CollectionDropdown id={panelId} onSelect={close} />}
    </div>
  );
}
