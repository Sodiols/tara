"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { trackGuestOrderAction } from "@/lib/supabase/actions/checkout";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn, formatPrice } from "@/lib/utils";
import { formatOrderAddress } from "@/lib/order-address";
import { formatSizeLabel } from "@/lib/product-size";
import { CUSTOMER_STATUS_LABELS } from "@/lib/order-status";
import type { OrderStatus } from "@/types/database";

type TrackingData = {
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  createdAt: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  shippingAddress: unknown;
  items: {
    productName: string;
    productCode: string;
    sku: string;
    size: string;
    colour: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  events: { status: OrderStatus; noteEn?: string | null; createdAt: string }[];
};

const steps = ["pending", "confirmed", "processing", "packed", "shipped", "delivered"] as const;
const sessionKey = "tara-last-tracked-order";

export function OrderTrackingClient() {
  const [orderNumber, setOrderNumber] = useState("");
  const [trackingToken, setTrackingToken] = useState("");
  const [tracked, setTracked] = useState<TrackingData>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = sessionStorage.getItem(sessionKey);
        if (saved) setTracked(JSON.parse(saved) as TrackingData);
      } catch {
        sessionStorage.removeItem(sessionKey);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!orderNumber.trim() || !trackingToken.trim()) {
      return setError("Enter both your order number and the tracking token from your order confirmation.");
    }
    setLoading(true);
    setTracked(undefined);
    try {
      sessionStorage.removeItem(sessionKey);
    } catch {
      // Storage may be blocked; the server-side lookup remains available.
    }
    const result = await trackGuestOrderAction(orderNumber, trackingToken);
    setLoading(false);
    if (!result.ok) return setError(result.message);

    const next = result.data as unknown as TrackingData;
    setTracked(next);
    try {
      // Keep only the authorized response for this tab so reload works. The
      // tracking token is deliberately not persisted or placed in the URL.
      sessionStorage.setItem(sessionKey, JSON.stringify(next));
    } catch {
      // Tracking still works when storage is blocked; only reload persistence
      // is unavailable in that browser mode.
    }
    setError("");
  }

  const currentStepIndex = tracked ? steps.indexOf(tracked.status as (typeof steps)[number]) : -1;
  const address = tracked ? formatOrderAddress(tracked.shippingAddress) : null;
  const isExceptional = tracked?.status === "cancelled" || tracked?.status === "returned";
  // Migration 0016 adds the detailed fields. Defaults keep the page usable
  // during a rolling deploy where an older RPC response may arrive briefly.
  const trackedItems = tracked?.items ?? [];
  const trackedEvents = tracked?.events ?? [];
  const trackedSubtotal = tracked?.subtotal ?? tracked?.total ?? 0;
  const trackedDiscount = tracked?.discount ?? 0;
  const trackedDelivery = tracked?.deliveryFee ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Order Tracking" }]} />
      <h1 className="mt-3 mb-8 font-serif text-3xl text-ink sm:text-4xl">{"Order Tracking"}</h1>
      <form onSubmit={handleSubmit} className="mb-10 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Input label="Order number" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="Enter your order number" autoComplete="off" />
        <Input label="Tracking token" value={trackingToken} onChange={(event) => setTrackingToken(event.target.value)} placeholder="Enter your tracking token" autoComplete="off" />
        <Button type="submit" size="lg" loading={loading}>{"Track"}</Button>
        {error && <p role="alert" className="text-sm text-wine sm:col-span-3">{error}</p>}
      </form>

      {tracked && (
        <div className="rounded-panel border border-border p-6" aria-live="polite">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">{"Order Number"}: <strong className="text-ink">{tracked.orderNumber}</strong></p>
              <p className="mt-1 text-xs text-muted">{new Date(tracked.createdAt).toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
            <span className="rounded-full bg-beige px-3 py-1 text-xs font-medium text-wine">
              {CUSTOMER_STATUS_LABELS[tracked.status]}
            </span>
          </div>

          {isExceptional ? (
            <p className="mb-6 rounded-control bg-beige p-4 text-sm text-wine">
              {tracked.status === "cancelled" ? "This order was cancelled." : "This order was returned."}
            </p>
          ) : null}

          <div className="flex items-center justify-between overflow-x-auto">
            {steps.map((step, index) => (
              <div key={step} className="relative flex min-w-20 flex-1 flex-col items-center">
                {index > 0 && <div className={cn("absolute right-1/2 top-3.5 h-px w-full", index <= currentStepIndex ? "bg-wine" : "bg-border")} />}
                <div className={cn("z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs", index <= currentStepIndex ? "bg-wine text-white" : "bg-beige text-muted")}>
                  {index <= currentStepIndex ? <Check size={14} aria-hidden="true" /> : index + 1}
                </div>
                <span className="mt-2 text-center text-xs text-muted">{CUSTOMER_STATUS_LABELS[step]}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-8 border-t border-border pt-6 sm:grid-cols-2">
            <section>
              <h2 className="mb-3 font-serif text-xl text-ink">{"Order summary"}</h2>
              <div className="space-y-3">
                {trackedItems.map((item) => (
                  <div key={`${item.sku}-${item.size}-${item.colour}`} className="flex justify-between gap-4 text-sm">
                    <div>
                      <p className="text-ink">{item.productName} × {item.quantity}</p>
                      <p className="text-xs text-muted">{formatSizeLabel(item.size)} / {item.colour}</p>
                    </div>
                    <span className="shrink-0 text-ink">{formatPrice(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatPrice(trackedSubtotal)}</dd></div>
                {trackedDiscount > 0 ? <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd>-{formatPrice(trackedDiscount)}</dd></div> : null}
                <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{formatPrice(trackedDelivery)}</dd></div>
                <div className="flex justify-between font-medium"><dt>Total</dt><dd>{formatPrice(tracked.total)}</dd></div>
              </dl>
            </section>

            <section>
              <h2 className="mb-3 font-serif text-xl text-ink">{"Delivery details"}</h2>
              <p className="text-sm text-ink">{tracked.customerName}</p>
              {address?.lines.map((line) => <p key={line} className="mt-1 text-sm text-muted">{line}</p>)}
              {address?.zoneLabel ? <p className="mt-2 text-xs text-muted">{address.zoneLabel}</p> : null}

              <h2 className="mt-6 mb-3 font-serif text-xl text-ink">{"Timeline"}</h2>
              <ol className="space-y-3">
                {trackedEvents.map((event, index) => (
                  <li key={`${event.createdAt}-${index}`} className="text-sm">
                    <p className="font-medium text-ink">{CUSTOMER_STATUS_LABELS[event.status]}</p>
                    {event.noteEn ? <p className="text-muted">{event.noteEn}</p> : null}
                    <time className="text-xs text-muted" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" })}</time>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
