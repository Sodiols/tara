import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { DeliveryInformationClient } from "@/components/policies/DeliveryInformationClient";
import { getDeliverySettings } from "@/lib/supabase/queries/settings";

export const metadata: Metadata = buildMetadata({
  title: "Delivery Information",
  description:
    "TARA delivery areas, timelines and charges — inside Sylhet and across the rest of Bangladesh, with cash on delivery.",
  path: "/delivery-information",
});

export default async function DeliveryInformationPage() {
  const delivery = await getDeliverySettings();
  return <DeliveryInformationClient delivery={delivery} />;
}
