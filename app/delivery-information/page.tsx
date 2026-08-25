import type { Metadata } from "next";
import { DeliveryInformationClient } from "@/components/policies/DeliveryInformationClient";
import { getDeliverySettings } from "@/lib/supabase/queries/settings";
import { siteConfig } from "@/data/site";

export const metadata: Metadata = {
  title: "Delivery Information",
  description: "TARA's delivery areas, timelines, and charges across Bangladesh.",
  alternates: { canonical: `${siteConfig.url}/delivery-information` },
};

export default async function DeliveryInformationPage() {
  const delivery = await getDeliverySettings();
  return <DeliveryInformationClient delivery={delivery} />;
}
