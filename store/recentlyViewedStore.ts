"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RecentlyViewedState {
  slugs: string[];
  addSlug: (slug: string) => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      slugs: [],
      addSlug: (slug) =>
        set({
          slugs: [slug, ...get().slugs.filter((s) => s !== slug)].slice(0, 8),
        }),
    }),
    { name: "tara-recently-viewed" }
  )
);
