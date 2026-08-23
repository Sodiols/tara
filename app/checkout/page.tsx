import type { Metadata } from "next";
import { CheckoutClient } from "@/components/cart/CheckoutClient";
import { getDeliverySettings } from "@/lib/supabase/queries/settings";
import { getCheckoutPrefill } from "@/lib/supabase/queries/account";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your order with TARA — cash on delivery across Bangladesh.",
};

export default async function CheckoutPage() {
  const [deliverySettings, prefill] = await Promise.all([getDeliverySettings(), getCheckoutPrefill()]);
  return <CheckoutClient deliverySettings={deliverySettings} prefill={prefill} />;
}
