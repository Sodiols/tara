"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { X, Search as SearchIcon } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { Product } from "@/types";
import { formatPrice } from "@/lib/utils";
import { useRouter } from "next/navigation";

const RECENT_KEY = "tara-recent-searches";
const suggestedKeywords = ["Undready", "Kurta", "Wine", "Festive", "Bag", "Earrings"];
const popularCategories = [
  { label: "categories.unstitchedName", href: "/unstitched-three-piece" },
  { label: "categories.readyName", href: "/ready-three-piece" },
  { label: "categories.accessoriesName", href: "/accessories" },
];

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const { t, pick } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 50);
      const stored = window.localStorage.getItem(RECENT_KEY);
      // Reading persisted recent searches when the overlay opens.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent(stored ? JSON.parse(stored) : []);
    } else {
      document.body.style.overflow = "";
      setQuery("");
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/products?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() as Promise<Product[]> : [])
        .then(setResults)
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const saveRecent = (term: string) => {
    if (!term.trim()) return;
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 6);
    setRecent(next);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    saveRecent(query.trim());
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    onClose();
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-white animate-fadeIn overflow-y-auto">
      <div className="max-w-3xl mx-auto px-5 pt-8 pb-16">
        <div className="flex items-center justify-end mb-6">
          <button onClick={onClose} aria-label={t("common.close")} className="p-1 text-ink">
            <X size={26} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="relative border-b-2 border-wine pb-3 mb-8">
          <SearchIcon size={20} className="absolute left-0 top-1.5 text-muted" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            className="w-full bg-transparent pl-8 pr-4 py-1 text-lg text-ink placeholder:text-muted focus:outline-none"
          />
        </form>

        {query.trim().length >= 2 ? (
          loading ? (
            <p className="py-10 text-center text-sm text-muted">{t("common.loading")}</p>
          ) : results.length > 0 ? (
            <div className="flex flex-col gap-4">
              {results.map((p) => (
                <Link
                  key={p.id}
                  href={`/product/${p.slug}`}
                  onClick={() => {
                    saveRecent(query.trim());
                    onClose();
                  }}
                  className="flex items-center gap-4 group"
                >
                  <div className="relative w-16 h-20 shrink-0 bg-beige overflow-hidden">
                    <Image src={p.images[0]} alt={pick(p.name)} fill sizes="64px" className="object-cover" />
                  </div>
                  <div>
                    <p className="text-sm text-ink group-hover:text-wine transition-colors">{pick(p.name)}</p>
                    <p className="text-sm text-muted mt-1">{formatPrice(p.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-ink font-serif text-xl mb-1">{t("search.noResults")}</p>
              <p className="text-muted text-sm">{t("search.noResultsText")}</p>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-8">
            {recent.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-muted mb-3">{t("search.recent")}</h3>
                <div className="flex flex-wrap gap-2">
                  {recent.map((term) => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className="border border-border px-3 py-1.5 text-sm text-ink hover:border-wine transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h3 className="text-xs uppercase tracking-wide text-muted mb-3">{t("search.suggested")}</h3>
              <div className="flex flex-wrap gap-2">
                {suggestedKeywords.map((term) => (
                  <button
                    key={term}
                    onClick={() => setQuery(term)}
                    className="border border-border px-3 py-1.5 text-sm text-ink hover:border-wine transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs uppercase tracking-wide text-muted mb-3">{t("search.popular")}</h3>
              <div className="flex flex-col gap-1">
                {popularCategories.map((cat) => (
                  <Link
                    key={cat.href}
                    href={cat.href}
                    onClick={onClose}
                    className="text-sm text-ink hover:text-wine py-1.5 transition-colors"
                  >
                    {t(cat.label)}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
