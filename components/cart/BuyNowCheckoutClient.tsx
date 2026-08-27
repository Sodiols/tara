"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useBuyNowStore } from "@/store/buyNowStore";
import { Button } from "@/components/ui/Button";
import { CheckoutForm } from "./CheckoutForm";
import type { DeliverySettings } from "@/lib/delivery";
import type { getCheckoutPrefill } from "@/lib/supabase/queries/account";

/**
 * Checkout for a single "Buy Now" item.
 *
 * Reads only the Buy Now store. The cart is never read, so whatever the
 * customer has saved stays out of this order — and never written, so the cart
 * badge does not move and nothing is left behind if they abandon the purchase.
 *
 * The selection lives in sessionStorage, so a refresh mid-checkout keeps it.
 * Because that is client-only state, the first render has to wait for hydration
 * before deciding the selection is missing — otherwise every arrival would flash
 * the "nothing selected" screen.
 */
export function BuyNowCheckoutClient({
  deliverySettings,
  codEnabled,
  supportPhone,
  prefill,
}: {
  deliverySettings: DeliverySettings;
  codEnabled: boolean;
  supportPhone: string;
  prefill: Awaited<ReturnType<typeof getCheckoutPrefill>>;
}) {
  const item = useBuyNowStore((state) => state.item);
  const clearBuyNow = useBuyNowStore((state) => state.clear);
  const hasHydrated = useBuyNowStore((state) => state.hasHydrated);

  useEffect(() => {
    void useBuyNowStore.persist.rehydrate();
  }, []);

  if (!hasHydrated) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <p className="text-sm text-muted">{"Preparing your order…"}</p>
      </div>
    );
  }

  return (
    <CheckoutForm
      mode="buy-now"
      title="Buy Now"
      items={item ? [item] : []}
      deliverySettings={deliverySettings}
      codEnabled={codEnabled}
      supportPhone={supportPhone}
      prefill={prefill}
      // Clears ONLY the Buy Now selection. clearBag() is deliberately not called
      // here: the customer's saved cart has nothing to do with this purchase.
      onOrderPlaced={clearBuyNow}
      emptyState={
        <div className="mx-auto max-w-lg px-5 py-24 text-center">
          <h1 className="mb-3 font-serif text-3xl text-ink">{"Nothing selected to buy"}</h1>
          <p className="mb-8 text-sm text-muted">
            {
              "This Buy Now checkout has expired or was opened directly. Choose a product and its options, then press Buy Now again."
            }
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/new-arrivals">
              <Button>{"Shop Now"}</Button>
            </Link>
            <Link href="/bag">
              <Button variant="secondary">{"Go to your bag"}</Button>
            </Link>
          </div>
        </div>
      }
    />
  );
}
