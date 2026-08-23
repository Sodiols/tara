"use client";

import { FormEvent, useState } from "react";
import { Check } from "lucide-react";
import { trackGuestOrderAction } from "@/lib/supabase/actions/checkout";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { CUSTOMER_STATUS_LABELS } from "@/lib/order-status";

type TrackingData = { orderNumber: string; status: string; events: { status: string }[] };
const steps = ["pending", "confirmed", "processing", "packed", "shipped", "delivered"] as const;

export function OrderTrackingClient() {
  const [orderNumber, setOrderNumber] = useState("");
  const [trackingToken, setTrackingToken] = useState("");
  const [tracked, setTracked] = useState<TrackingData>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!orderNumber.trim() || !trackingToken.trim()) {
      return setError("Enter both your order number and the tracking token from your order confirmation.");
    }
    setLoading(true);
    const result = await trackGuestOrderAction(orderNumber, trackingToken);
    setLoading(false);
    if (!result.ok) return setError(result.message);
    setTracked(result.data as unknown as TrackingData);
    setError("");
  }

  const currentStepIndex = tracked ? steps.indexOf(tracked.status as (typeof steps)[number]) : -1;
  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Order Tracking" }]} />
      <h1 className="mt-3 mb-8 font-serif text-3xl text-ink sm:text-4xl">{"Order Tracking"}</h1>
      <form onSubmit={handleSubmit} className="mb-10 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder={"Enter your order number"} />
        <Input value={trackingToken} onChange={(event) => setTrackingToken(event.target.value)} placeholder={"Enter your tracking token"} />
        <Button type="submit" size="lg" loading={loading}>{"Track"}</Button>
        {error && <p className="text-sm text-wine sm:col-span-3">{error}</p>}
      </form>
      {tracked && (
        <div className="rounded-panel border border-border p-6">
          <p className="mb-6 text-sm text-muted">{"Order Number"}: <strong className="text-ink">{tracked.orderNumber}</strong></p>
          <div className="flex items-center justify-between overflow-x-auto">
            {steps.map((step, index) => <div key={step} className="relative flex min-w-20 flex-1 flex-col items-center">{index > 0 && <div className={cn("absolute right-1/2 top-3.5 h-px w-full", index <= currentStepIndex ? "bg-wine" : "bg-border")} />}<div className={cn("z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs", index <= currentStepIndex ? "bg-wine text-white" : "bg-beige text-muted")}>{index <= currentStepIndex ? <Check size={14} /> : index + 1}</div><span className="mt-2 text-center text-xs text-muted">{CUSTOMER_STATUS_LABELS[step]}</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
