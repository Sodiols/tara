"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { persistCartAction, syncCartAction } from "@/lib/supabase/actions/cart";
import { syncWishlistAction } from "@/lib/supabase/actions/wishlist";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";

export function AuthDataSync() {
  const syncedUser = useRef<string | undefined>(undefined);
  const replaceCart = useCartStore((state) => state.replaceItems);
  const replaceWishlist = useWishlistStore((state) => state.replaceItems);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    let persistTimer: ReturnType<typeof setTimeout> | undefined;
    let previousItems = useCartStore.getState().items;
    let unsubscribeCart: (() => void) | undefined;

    const synchronize = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        if (syncedUser.current) {
          syncedUser.current = undefined;
          unsubscribeCart?.();
          unsubscribeCart = undefined;
          replaceCart([]);
          replaceWishlist([]);
        }
        return;
      }
      if (syncedUser.current === data.user.id) return;
      syncedUser.current = data.user.id;
      const [cart, wishlist] = await Promise.all([
        syncCartAction(useCartStore.getState().items),
        syncWishlistAction(useWishlistStore.getState().items),
      ]);
      if (cart.ok) replaceCart(cart.items);
      if (wishlist.ok) replaceWishlist(wishlist.items);

      previousItems = useCartStore.getState().items;
      unsubscribeCart?.();
      unsubscribeCart = useCartStore.subscribe((state) => {
        if (state.items === previousItems) return;
        previousItems = state.items;
        if (persistTimer) clearTimeout(persistTimer);
        persistTimer = setTimeout(() => void persistCartAction(state.items), 350);
      });
    };
    void synchronize();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => void synchronize());
    return () => {
      subscription.subscription.unsubscribe();
      unsubscribeCart?.();
      if (persistTimer) clearTimeout(persistTimer);
    };
  }, [replaceCart, replaceWishlist]);
  return null;
}
