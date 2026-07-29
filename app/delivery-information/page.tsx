import type { Metadata } from "next";
import { DeliveryInformationClient } from "@/components/policies/DeliveryInformationClient";

export const metadata: Metadata = {
  title: "Delivery Information",
  description: "Learn about TARA's delivery areas, timelines, and charges across Bangladesh.",
};

export default function DeliveryInformationPage() {
  return <DeliveryInformationClient />;
}
