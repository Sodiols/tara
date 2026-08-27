"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartItem } from "@/types";
import { safeBrowserStorage } from "./safe-storage";

/**
 * The single item a customer is buying through "Buy Now".
 *
 * WHY THIS IS NOT THE CART
 * ------------------------
 * Buy Now used to add the product to the normal cart and then navigate to
 * checkout. That did three things nobody asked for: it changed the cart badge,
 * it left the item behind if the customer abandoned checkout, and — worst — it
 * put whatever was already in the cart into the order. Someone with three items
 * saved who clicked "Buy Now" on a fourth bought all four.
 *
 * So this is a separate store holding exactly one line, and the normal cart is
 * never read or written by the Buy Now flow.
 *
 * WHY sessionStorage
 * ------------------
 * It has to survive a refresh — checkout is where people reload, switch apps to
 * find a phone number, and come back. It must NOT survive the tab: a Buy Now
 * selection is an intent for right now, and finding a half-finished purchase
 * waiting a week later is a surprise, not a convenience. sessionStorage is
 * exactly that lifetime. The cart, which is a deliberate saved list, stays in
 * localStorage.
 *
 * WHAT IS SAFE TO KEEP HERE
 * -------------------------
 * Only what identifies the selection and lets the summary render: product id,
 * slug, size, colour, quantity, and the name/image/price for display. No
 * customer details, no address, no phone number.
 *
 * The price here is display only, exactly as it is for the cart. What reaches
 * the server is the product, the variant and the quantity; `place_order()`
 * re-reads the price, the stock and the delivery fee from the database. A
 * tampered value in sessionStorage changes what the browser draws and nothing
 * about what is charged.
 */

interface BuyNowState {
  item: CartItem | null;
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  /** Replaces whatever was there — Buy Now is always exactly one item. */
  setItem: (item: CartItem) => void;
  /** Called after a successful Buy Now order. Never touches the cart. */
  clear: () => void;
}

export const useBuyNowStore = create<BuyNowState>()(
  persist(
    (set) => ({
      item: null,
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setItem: (item) => set({ item }),
      clear: () => set({ item: null }),
    }),
    {
      name: "tara-buy-now",
      storage: createJSONStorage(() => safeBrowserStorage("session")),
      skipHydration: true,
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
      partialize: (state) => ({ item: state.item }),
    },
  ),
);
