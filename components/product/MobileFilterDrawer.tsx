"use client";

import { createPortal } from "react-dom";
import { useEffect } from "react";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { FilterPanel } from "./FilterPanel";
import type { FilterState } from "@/hooks/useProductFilters";

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  availableSizes: string[];
  availableColours: string[];
  availableFabrics: string[];
  availableCollections: string[];
  onClearAll: () => void;
}

export function MobileFilterDrawer(props: MobileFilterDrawerProps) {
  const { isOpen, onClose } = props;
  const { t } = useLanguage();

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink/40 animate-fadeIn" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-white animate-slideInRight flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-serif text-xl text-ink">{t("listing.filters")}</h2>
          <button onClick={onClose} aria-label={t("common.close")} className="p-1 text-ink">
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <FilterPanel {...props} />
        </div>
        <div className="border-t border-border p-4">
          <Button onClick={onClose} fullWidth>
            {t("common.apply")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
