"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FilterPanel, type FilterPanelProps } from "./FilterPanel";
import { lockBodyScroll } from "@/lib/scroll-lock";

type MobileFilterDrawerProps = FilterPanelProps & {
  isOpen: boolean;
  onClose: () => void;
};

export function MobileFilterDrawer({ isOpen, onClose, ...panel }: MobileFilterDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    return lockBodyScroll();
  }, [isOpen]);

  // Focus moves into the drawer when it opens and is trapped while it is open,
  // so a keyboard user is not left tabbing through the page behind the overlay
  // with no way back to the close button.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink/40 animate-fadeIn" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-white animate-slideInRight flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-serif text-xl text-ink">{"Filters"}</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label={"Close"}
            className="p-1 text-ink"
          >
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <FilterPanel {...panel} />
        </div>
        <div className="border-t border-border p-4">
          <Button onClick={onClose} fullWidth>
            {"Apply"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
