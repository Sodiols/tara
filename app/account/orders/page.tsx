import type { Metadata } from "next";
import { OrderHistoryClient } from "@/components/forms/OrderHistoryClient";
import { getOrders } from "@/lib/supabase/queries/orders";
import { Container } from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "Order History",
  description: "View your past orders placed with TARA.",
};

export default async function OrderHistoryPage() {
  const orders = await getOrders();
  return <Container className="py-10 lg:py-14"><OrderHistoryClient orders={orders} /></Container>;
}
