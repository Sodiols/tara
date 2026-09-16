import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { DeliveryInformationClient } from "@/components/policies/DeliveryInformationClient";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";

export const metadata: Metadata = buildMetadata({
  title: "Delivery Information",
  description:
    "TARA delivery areas, timelines and charges — inside Sylhet and across the rest of Bangladesh, with cash on delivery.",
  path: "/delivery-information",
});

export default async function DeliveryInformationPage() {
  const settings = await getPublicStoreSettings();
  return (
    <DeliveryInformationClient delivery={settings.delivery} policies={settings.policies} />
  );
}
