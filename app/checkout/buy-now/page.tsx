import type { Metadata } from "next";
import { BuyNowCheckoutClient } from "@/components/cart/BuyNowCheckoutClient";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";
import { getCheckoutPrefill } from "@/lib/supabase/queries/account";

export const metadata: Metadata = {
  title: "Buy Now",
  description: "Complete your order with TARA — cash on delivery across Bangladesh.",
  robots: { index: false, follow: false },
};

/**
 * Checkout for a single product bought straight from its page.
 *
 * Separate from /checkout so the customer's saved cart is neither included in
 * this order nor emptied by it.
 */
export default async function BuyNowCheckoutPage() {
  const [settings, prefill] = await Promise.all([
    getPublicStoreSettings(),
    getCheckoutPrefill(),
  ]);

  return (
    <BuyNowCheckoutClient
      deliverySettings={settings.delivery}
      codEnabled={settings.codEnabled}
      supportPhone={settings.supportPhone}
      prefill={prefill}
    />
  );
}
