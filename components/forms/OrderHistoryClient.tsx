"use client";

import Link from "next/link";
import type { Database } from "@/types/database";
import { formatPrice } from "@/lib/utils";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { EmptyState } from "@/components/ui/EmptyState";
import { Package } from "lucide-react";

type Order = Database["public"]["Tables"]["orders"]["Row"];

export function OrderHistoryClient({ orders }: { orders: Order[] }) {
  if (orders.length === 0) return <EmptyState icon={Package} heading={"You have no past orders"} text={"Add items to your bag to see them here."} />;
  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Link key={order.id} href={`/account/orders/${order.order_number}`} className="grid gap-3 rounded-panel border border-border p-5 transition-colors hover:border-wine sm:grid-cols-4">
          <span><span className="block text-xs text-muted">{"Order Number"}</span><strong className="text-sm text-ink">{order.order_number}</strong></span>
          <span className="text-sm text-muted">{new Date(order.created_at).toLocaleDateString()}</span>
          <span className="text-sm capitalize text-muted">{ORDER_STATUS_LABELS[order.status]}</span>
          <strong className="text-sm text-ink sm:text-right">{formatPrice(Number(order.total))}</strong>
        </Link>
      ))}
    </div>
  );
}
