"use client";

import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      className={cn(
        "inline-flex items-center border border-border rounded-full p-0.5 text-xs",
        compact && "text-[11px]"
      )}
      role="group"
      aria-label="Language switcher"
    >
      <button
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={cn(
          "rounded-full px-3 py-1.5 font-sans tracking-wide transition-colors duration-200",
          locale === "en" ? "font-semibold bg-wine text-white" : "font-medium text-ink hover:text-wine"
        )}
      >
        EN
      </button>
      <button
        onClick={() => setLocale("bn")}
        aria-pressed={locale === "bn"}
        className={cn(
          "rounded-full px-3 py-1.5 font-bengali tracking-wide transition-colors duration-200",
          locale === "bn" ? "font-semibold bg-wine text-white" : "font-medium text-ink hover:text-wine"
        )}
      >
        বাংলা
      </button>
    </div>
  );
}
