import type { Metadata } from "next";
import { BagClient } from "@/components/cart/BagClient";
import { getDeliverySettings } from "@/lib/supabase/queries/settings";

export const metadata: Metadata = {
  title: "Shopping Bag",
  description: "Review the items in your TARA shopping bag before checkout.",
};

export default async function BagPage() {
  const deliverySettings = await getDeliverySettings();
  return <BagClient deliverySettings={deliverySettings} />;
}
