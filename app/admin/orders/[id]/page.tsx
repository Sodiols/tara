import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { OrderStatusForm } from "@/components/admin/OrderStatusForm";

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: order }, { data: items }, { data: events }] = await Promise.all([
    supabase!.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase!.from("order_items").select("*").eq("order_id", id),
    supabase!.from("order_tracking_events").select("*").eq("order_id", id).order("created_at", { ascending: false }),
  ]);
  if (!order) notFound();

  const address = order.shipping_address as Record<string, string> | null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl text-ink">{order.order_number}</h2>
          <span className="rounded-control border border-border px-3 py-1 font-sans text-xs uppercase tracking-wide text-muted">
            {order.status}
          </span>
        </div>
        <p className="mt-2 font-sans text-sm text-muted">
          {order.customer_name} · {order.customer_phone} {order.customer_email ? `· ${order.customer_email}` : ""}
        </p>

        {address && (
          <p className="mt-3 font-sans text-sm leading-6 text-muted">
            {address.fullAddress}, {address.area}, {address.district}, {address.division}
          </p>
        )}

        <div className="mt-6 divide-y divide-border border-y border-border">
          {(items ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 py-3 font-sans text-sm">
              <div>
                <p className="text-ink">
                  {item.product_name_en} × {item.quantity}
                </p>
                <p className="text-xs text-muted">
                  {item.size} · {item.colour_en} · SKU {item.sku}
                </p>
              </div>
              <strong className="text-ink">{formatPrice(Number(item.line_total))}</strong>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-1 font-sans text-sm text-muted">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatPrice(Number(order.subtotal))}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>{formatPrice(Number(order.delivery_fee))}</span>
          </div>
          {Number(order.discount_amount) > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{formatPrice(Number(order.discount_amount))}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-ink">
            <span>Total</span>
            <span>{formatPrice(Number(order.total))}</span>
          </div>
        </div>

        {events && events.length > 0 && (
          <div className="mt-8">
            <h3 className="font-sans font-semibold text-sm uppercase tracking-wide text-ink">Tracking history</h3>
            <ul className="mt-3 flex flex-col gap-2 font-sans text-sm text-muted">
              {events.map((event) => (
                <li key={event.id} className="flex justify-between gap-4">
                  <span className="capitalize text-ink">{event.status}</span>
                  <span>{new Date(event.created_at).toLocaleString("en-GB")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <OrderStatusForm orderId={order.id} currentStatus={order.status} currentPaymentStatus={order.payment_status} />
    </div>
  );
}
