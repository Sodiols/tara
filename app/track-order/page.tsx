import type { Metadata } from "next";
import { OrderTrackingClient } from "@/components/forms/OrderTrackingClient";

export const metadata: Metadata = {
  title: "Order Tracking",
  description: "Track the status of your TARA order with the tracking code from your order confirmation.",
};

export default function TrackOrderPage() {
  return <OrderTrackingClient />;
}
