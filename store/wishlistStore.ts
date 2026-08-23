"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WishlistItem } from "@/types";
import { flattenName } from "./persisted-name";

interface WishlistState {
  items: WishlistItem[];
  addItem: (item: WishlistItem) => void;
  removeItem: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  toggleItem: (item: WishlistItem) => void;
  replaceItems: (items: WishlistItem[]) => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) =>
          state.items.some((i) => i.productId === item.productId)
            ? state
            : { items: [...state.items, item] }
        ),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      isInWishlist: (productId) => get().items.some((i) => i.productId === productId),
      toggleItem: (item) => {
        const exists = get().items.some((i) => i.productId === item.productId);
        if (exists) {
          get().removeItem(item.productId);
        } else {
          get().addItem(item);
        }
      },
      replaceItems: (items) => set({ items }),
    }),
    {
      name: "tara-wishlist",
      // See the matching note in cartStore: v0 persisted `name` as { en, bn }.
      version: 1,
      migrate: (persisted, version) => {
        if (version >= 1) return persisted as { items: WishlistItem[] };
        const state = (persisted ?? {}) as { items?: unknown };
        const items = Array.isArray(state.items) ? state.items : [];
        return {
          items: items.map((item) => {
            const entry = item as WishlistItem & { name: unknown };
            return { ...entry, name: flattenName(entry.name) };
          }),
        };
      },
    }
  )
);
