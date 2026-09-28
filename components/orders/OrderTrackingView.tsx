import Link from "next/link";
import { Check } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatSizeLabel } from "@/lib/product-size";
import { CUSTOMER_STATUS_LABELS, FULFILMENT_PIPELINE } from "@/lib/order-status";
import { deliveryZoneLabel, isDeliveryZone, type DeliverySettings } from "@/lib/delivery";
import type { PublicOrderTracking } from "@/lib/order-tracking";

/**
 * The public tracking page's body. Server-rendered from the allowlisted
 * snapshot only -- there is nothing on this page that was fetched and then
 * hidden.
 *
 * The progress rail marks the stages the order has actually reached; it never
 * shows a time for them. Times appear only in the timeline below, and only
 * from rows the store actually wrote to order_tracking_events.
 */
export function OrderTrackingView({
  order,
  delivery,
}: {
  order: PublicOrderTracking;
  delivery: DeliverySettings;
}) {
  const currentStep = FULFILMENT_PIPELINE.indexOf(order.status);
  const isExceptional = order.status === "cancelled" || order.status === "returned";
  const area = order.deliveryZone && isDeliveryZone(order.deliveryZone)
    ? deliveryZoneLabel(order.deliveryZone, delivery)
    : null;
  const cashDue = order.paymentMethod === "cash_on_delivery" && !isExceptional && order.status !== "delivered";

  return (
    <div className="rounded-panel border border-border p-6" aria-live="polite">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Order</p>
          <p className="mt-1 font-serif text-2xl text-ink" data-testid="tracked-order-number">{order.orderNumber}</p>
          <p className="mt-1 text-xs text-muted">Ordered {formatDate(order.placedAt)}</p>
        </div>
        <span className="rounded-full bg-beige px-3 py-1 text-xs font-medium text-wine" data-testid="tracked-status">
          {CUSTOMER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {isExceptional ? (
        <p className="mb-6 rounded-control bg-beige p-4 text-sm text-wine">
          {order.status === "cancelled" ? "This order was cancelled." : "This order was returned."}
        </p>
      ) : (
        // items-start: a label that wraps to two lines must not lift its
        // circle off the connecting line.
        <ol className="flex items-start justify-between overflow-x-auto pb-3" aria-label="Order progress">
          {FULFILMENT_PIPELINE.map((step, index) => {
            const reached = index <= currentStep;
            const current = index === currentStep;
            return (
              <li key={step} className="relative flex min-w-20 flex-1 flex-col items-center" aria-current={current ? "step" : undefined}>
                {index > 0 && <div className={cn("absolute right-1/2 top-3.5 h-px w-full", reached ? "bg-wine" : "bg-border")} />}
                <div className={cn("z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs", reached ? "bg-wine text-white" : "bg-beige text-muted")}>
                  {reached ? <Check size={14} aria-hidden="true" /> : index + 1}
                </div>
                <span className={cn("mt-2 text-center text-xs", current ? "font-medium text-ink" : "text-muted")}>
                  {CUSTOMER_STATUS_LABELS[step]}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-8 grid gap-8 border-t border-border pt-6 sm:grid-cols-2">
        <section>
          <h2 className="mb-3 font-serif text-xl text-ink">Timeline</h2>
          {order.events.length > 0 ? (
            <ol className="space-y-3">
              {order.events.map((event, index) => (
                <li key={`${event.createdAt}-${index}`} className="text-sm">
                  <p className="font-medium text-ink">{CUSTOMER_STATUS_LABELS[event.status]}</p>
                  {event.note ? <p className="text-muted">{event.note}</p> : null}
                  <time className="text-xs text-muted" dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">Updates will appear here as your order moves.</p>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl text-ink">In this order</h2>
          <ul className="space-y-3">
            {order.items.map((item, index) => (
              <li key={`${item.productName}-${item.size}-${item.colour}-${index}`} className="text-sm">
                <p className="text-ink">{item.productName} × {item.quantity}</p>
                <p className="text-xs text-muted">{[formatSizeLabel(item.size), item.colour].filter(Boolean).join(" / ")}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between font-medium">
              <dt>{cashDue ? "Due on delivery" : "Order total"}</dt>
              <dd>{formatPrice(order.total)}</dd>
            </div>
            {area ? (
              <div className="flex justify-between">
                <dt className="text-muted">Delivery area</dt>
                <dd>{area}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted">
        Need to change something? <Link href="/contact" className="text-wine underline">Contact us</Link> and quote your order number. For your privacy, this page never shows your name, phone number or address.
      </p>
    </div>
  );
}
