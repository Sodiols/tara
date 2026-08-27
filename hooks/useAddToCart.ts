"use client";

import { useCallback, useEffect, useState } from "react";
import type { CartItem } from "@/types";
import { useCartStore } from "@/store/cartStore";
import { CART_TOAST_DURATION_MS, useToastStore } from "@/store/toastStore";

/**
 * The breakpoint the product page already lays out against.
 *
 * Reused rather than re-invented so "mobile" means the same thing in the
 * layout and in the behaviour. Below this the product page switches to a
 * single column and a fixed bottom action bar; above it the buttons sit beside
 * the gallery with room for the drawer.
 */
export const DESKTOP_BREAKPOINT_PX = 900;

/**
 * True on a viewport wide enough for the bag drawer to sit beside the page.
 *
 * A media query, not user-agent sniffing: what matters is how much room there
 * is, and a narrow desktop window should behave like a phone. Starts `false`
 * and corrects after mount, so the server and the first client render agree
 * and nothing hydrates mismatched — and the cautious default is the one that
 * does NOT throw a panel over the page.
 */
export function useIsDesktopViewport(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT_PX}px)`);
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}

/**
 * Adds an item to the cart, the same way everywhere.
 *
 * Every entry point — the product page, the product card, quick view, the
 * wishlist — goes through this, so the confirmation, the toast duration and
 * the drawer behaviour cannot drift apart between them.
 *
 * WHAT IT DOES
 *   * adds the line (the cart badge updates immediately)
 *   * shows a brief "Added to cart" confirmation
 *   * opens the bag drawer ONLY on a desktop-width viewport
 *
 * WHY THE DRAWER IS CONDITIONAL
 * On a phone the drawer covers the whole screen. Opening it automatically took
 * the customer away from the product they were still looking at and made adding
 * a second item a three-tap round trip. The cart badge and the toast are enough
 * confirmation; the cart icon is always there when they want it.
 *
 * On a wide screen the drawer sits alongside the page, does not hide what the
 * customer was reading, and is a genuine convenience — so it stays.
 */
export function useAddToCart() {
  const addItem = useCartStore((state) => state.addItem);
  const openBag = useCartStore((state) => state.openBag);
  const addToast = useToastStore((state) => state.addToast);
  const isDesktop = useIsDesktopViewport();

  return useCallback(
    (item: CartItem, options?: { openDrawer?: boolean }) => {
      addItem(item);

      // Short on purpose: the cart badge is the real confirmation, and a
      // success message that lingers is just something to dismiss. Errors keep
      // the store's longer default.
      addToast("Added to cart", "success", CART_TOAST_DURATION_MS);

      const shouldOpen = options?.openDrawer ?? isDesktop;
      if (shouldOpen) openBag();
    },
    [addItem, addToast, openBag, isDesktop],
  );
}
