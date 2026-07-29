import type { Metadata } from "next";
import { OrderTrackingClient } from "@/components/forms/OrderTrackingClient";

export const metadata: Metadata = {
  title: "Order Tracking",
  description: "Track the status of your TARA order using your order number.",
};

export default function TrackOrderPage() {
  return <OrderTrackingClient />;
}
