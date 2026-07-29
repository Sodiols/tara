import "server-only";

import { requireUser } from "../auth";
import { createClient } from "../server";

export async function getOrders() {
  const user = await requireUser("/account/orders");
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getOrder(orderNumber: string) {
  const user = await requireUser(`/account/orders/${orderNumber}`);
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("order_number", orderNumber)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) return null;
  const [{ data: items }, { data: events }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", order.id),
    supabase.from("order_tracking_events").select("*").eq("order_id", order.id).order("created_at"),
  ]);
  return { order, items: items ?? [], events: events ?? [] };
}
