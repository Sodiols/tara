import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const { data } = await supabase!.from("orders").select("*").order("created_at", { ascending: false });
  return <><h2 className="mb-6 font-serif text-2xl">Orders</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border text-muted"><th className="py-3">Order</th><th>Customer</th><th>Status</th><th>Total</th><th /></tr></thead><tbody>{(data ?? []).map((order) => <tr key={order.id} className="border-b border-border"><td className="py-4">{order.order_number}</td><td>{order.customer_name}<small className="block text-muted">{order.customer_phone}</small></td><td className="capitalize">{order.status}</td><td>{formatPrice(Number(order.total))}</td><td className="text-right"><Link href={`/admin/orders/${order.id}`} className="text-wine">Manage</Link></td></tr>)}</tbody></table></div></>;
}
