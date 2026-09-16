"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CartItem } from "@/types";
import { useCartStore } from "@/store/cartStore";
import { CART_TOAST_DURATION_MS, useToastStore } from "@/store/toastStore";
import { track } from "@/lib/analytics/client";

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
 * Every entry point — the product page, the product card, quick view —
 * goes through this, so the confirmation, the toast duration and
 * the drawer behaviour cannot drift apart between them.
 *
 * WHAT IT DOES
 *   * adds the line (the cart badge updates immediately)
 *   * records the Add to Cart event, with the variant, colour, size, quantity
 *     and line value
 *   * shows a brief "Added to cart" confirmation
 *   * opens the bag drawer ONLY on a desktop-width viewport
 *
 * WHY THE EVENT IS RECORDED HERE
 * Because this is the only place an item is ever added. The product page, the
 * product card and Quick View all come through this hook, so there is one call
 * site rather than three that could drift — and an Add to Cart that did not
 * happen cannot be reported, because the only way to reach the event is to have
 * just added the line. The card's "not enough information to add this" path
 * opens Quick View instead and never arrives here.
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

      track({
        name: "add_to_cart",
        productId: item.productId,
        variantId: item.variantId,
        colour: item.colour || undefined,
        size: item.size || undefined,
        quantity: item.quantity,
        value: Number((item.price * item.quantity).toFixed(2)),
        meta: { productName: item.name },
      });

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

/**
 * Removes a line from the cart, the same way everywhere.
 *
 * The counterpart to `useAddToCart`, and for the same reason: the bag page and
 * the bag drawer both remove items, and a funnel that counts add-to-carts but
 * not removals cannot tell "nobody wants this" from "everybody changed their
 * mind at the last step".
 *
 * The event carries what was taken out, so the line's value can be subtracted
 * from the cart it was in.
 */
export function useRemoveFromCart() {
  const removeItem = useCartStore((state) => state.removeItem);

  return useCallback(
    (item: CartItem) => {
      removeItem(item.productId, item.size, item.colour);
      track({
        name: "remove_from_cart",
        productId: item.productId,
        variantId: item.variantId,
        colour: item.colour || undefined,
        size: item.size || undefined,
        quantity: item.quantity,
        value: Number((item.price * item.quantity).toFixed(2)),
        meta: { productName: item.name },
      });
    },
    [removeItem],
  );
}

/**
 * Records that the customer looked at their bag.
 *
 * Called by the bag page when it renders and by the drawer when it opens, once
 * each — `sent` is what stops a re-render, or the drawer being closed and
 * reopened within the same view, from counting a second look.
 */
export function useCartViewTracking(active: boolean, value: number, itemCount: number) {
  const sent = useRef(false);

  useEffect(() => {
    if (!active) {
      sent.current = false;
      return;
    }
    if (sent.current) return;
    sent.current = true;
    track({
      name: "cart_view",
      value: Number(value.toFixed(2)),
      meta: { items: itemCount },
    });
    // Only the transition into "looking at the bag" matters; the value changing
    // while it is open is not a second view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
