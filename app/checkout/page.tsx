import type { Metadata } from "next";
import { CheckoutClient } from "@/components/cart/CheckoutClient";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";
import { getCheckoutPrefill } from "@/lib/supabase/queries/account";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your order with TARA — cash on delivery across Bangladesh.",
  // Checkout is one customer's transient state. next.config.mjs also sends
  // X-Robots-Tag for this path, so it is excluded two ways.
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [settings, prefill] = await Promise.all([
    getPublicStoreSettings(),
    getCheckoutPrefill(),
  ]);

  return (
    <CheckoutClient
      deliverySettings={settings.delivery}
      // Cash on delivery is the only method, so switching it off closes
      // ordering. The form says so up front rather than letting a customer fill
      // it in and meet `cod_disabled` from the database at the last step.
      codEnabled={settings.codEnabled}
      prefill={prefill}
    />
  );
}
