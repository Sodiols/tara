"use client";

import Link from "next/link";
import type { Database } from "@/types/database";
import { useLanguage } from "@/lib/i18n";
import { formatPrice } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Package } from "lucide-react";

type Order = Database["public"]["Tables"]["orders"]["Row"];

export function OrderHistoryClient({ orders }: { orders: Order[] }) {
  const { t } = useLanguage();
  if (orders.length === 0) return <EmptyState icon={Package} heading={t("account.noOrders")} text={t("bag.emptyText")} />;
  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Link key={order.id} href={`/account/orders/${order.order_number}`} className="grid gap-3 rounded-panel border border-border p-5 transition-colors hover:border-wine sm:grid-cols-4">
          <span><span className="block text-xs text-muted">{t("checkout.orderNumber")}</span><strong className="text-sm text-ink">{order.order_number}</strong></span>
          <span className="text-sm text-muted">{new Date(order.created_at).toLocaleDateString()}</span>
          <span className="text-sm capitalize text-muted">{t(`account.orderStatus.${order.status}`)}</span>
          <strong className="text-sm text-ink sm:text-right">{formatPrice(Number(order.total))}</strong>
        </Link>
      ))}
    </div>
  );
}
