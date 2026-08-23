"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";
import { flattenName } from "./persisted-name";

// Matches the per-line-item cap enforced server-side in place_order() and
// resolveCartRows() (supabase/TARA_COMPLETE_SETUP.sql, lib/supabase/actions/cart.ts)
// so the UI never lets a customer build a cart line the server will reject.
const MAX_LINE_QUANTITY = 20;

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, size: string, colour: string) => void;
  updateQuantity: (productId: string, size: string, colour: string, quantity: number) => void;
  clearBag: () => void;
  replaceItems: (items: CartItem[]) => void;
  openBag: () => void;
  closeBag: () => void;
  itemCount: () => number;
  subtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === item.productId && i.size === item.size && i.colour === item.colour
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i === existing
                  ? { ...i, quantity: Math.min(MAX_LINE_QUANTITY, i.quantity + item.quantity) }
                  : i
              ),
              isOpen: true,
            };
          }
          return {
            items: [...state.items, { ...item, quantity: Math.min(MAX_LINE_QUANTITY, item.quantity) }],
            isOpen: true,
          };
        }),
      removeItem: (productId, size, colour) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.size === size && i.colour === colour)
          ),
        })),
      updateQuantity: (productId, size, colour, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId && i.size === size && i.colour === colour
              ? { ...i, quantity: Math.min(MAX_LINE_QUANTITY, Math.max(1, quantity)) }
              : i
          ),
        })),
      clearBag: () => set({ items: [] }),
      replaceItems: (items) => set({ items }),
      openBag: () => set({ isOpen: true }),
      closeBag: () => set({ isOpen: false }),
      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: () => get().items.reduce((sum, i) => sum + i.quantity * i.price, 0),
    }),
    {
      name: "tara-cart",
      partialize: (state) => ({ items: state.items }),
      // v0 stored `name` as { en, bn } from the old bilingual build. A shopper
      // who added to their bag before this release still has that shape in
      // localStorage, and rendering it would print "[object Object]" in the bag
      // drawer and on the checkout summary. Flatten it to the English string.
      version: 1,
      migrate: (persisted, version) => {
        if (version >= 1) return persisted as { items: CartItem[] };
        const state = (persisted ?? {}) as { items?: unknown };
        const items = Array.isArray(state.items) ? state.items : [];
        return {
          items: items.map((item) => {
            const line = item as CartItem & { name: unknown };
            return { ...line, name: flattenName(line.name) };
          }),
        };
      },
    }
  )
);
