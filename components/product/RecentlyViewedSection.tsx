"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/types";
import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";
import { ProductCarousel } from "./ProductCarousel";

export function RecentlyViewedSection({ excludeSlug }: { excludeSlug: string }) {
  const slugs = useRecentlyViewedStore((state) => state.slugs);
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    const requested = slugs.filter((slug) => slug !== excludeSlug).slice(0, 8);
    if (!requested.length) return;
    const controller = new AbortController();
    fetch(`/api/products?slugs=${encodeURIComponent(requested.join(","))}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<Product[]> : [])
      .then(setItems)
      .catch(() => undefined);
    return () => controller.abort();
  }, [excludeSlug, slugs]);

  if (items.length === 0) return null;
  return <section className="py-14"><h2 className="mb-8 font-serif text-2xl text-ink sm:text-3xl">{"Recently Viewed"}</h2><ProductCarousel products={items} /></section>;
}
