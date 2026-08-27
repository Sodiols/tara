"use client";

import Link from "next/link";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/Button";
import { CheckoutForm } from "./CheckoutForm";
import type { DeliverySettings } from "@/lib/delivery";
import type { getCheckoutPrefill } from "@/lib/supabase/queries/account";

/**
 * Checkout for everything in the bag.
 *
 * A thin wrapper: it supplies the cart's items and clears the cart afterwards.
 * Every field, rule and submission path lives in CheckoutForm, shared with the
 * Buy Now flow so the two cannot drift apart.
 */
export function CartCheckoutClient({
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
  const items = useCartStore((state) => state.items);
  const clearBag = useCartStore((state) => state.clearBag);
  const hasHydrated = useCartStore((state) => state.hasHydrated);

  if (!hasHydrated) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center" role="status">
        <p className="text-sm text-muted">{"Loading your bag…"}</p>
      </div>
    );
  }

  return (
    <CheckoutForm
      mode="cart"
      title="Checkout"
      items={items}
      deliverySettings={deliverySettings}
      codEnabled={codEnabled}
      supportPhone={supportPhone}
      prefill={prefill}
      // The bag is emptied only once the order exists in the database. Clearing
      // any earlier would lose the customer's selection if the order failed.
      onOrderPlaced={clearBag}
      emptyState={
        <div className="mx-auto max-w-lg px-5 py-24 text-center">
          <h1 className="mb-3 font-serif text-3xl text-ink">{"Your bag is empty"}</h1>
          <p className="mb-8 text-sm text-muted">{"Add items to your bag to see them here."}</p>
          <Link href="/new-arrivals">
            <Button variant="secondary">{"Continue Shopping"}</Button>
          </Link>
        </div>
      }
    />
  );
}
