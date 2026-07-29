"use client";

import { useState, useTransition } from "react";
import { updateOrderAction } from "@/lib/supabase/actions/admin";
import { useToastStore } from "@/store/toastStore";

const STATUS_SEQUENCE = ["pending", "confirmed", "processing", "packed", "shipped", "delivered"] as const;
const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "failed", "refunded"] as const;

function nextStatusOptions(current: string): string[] {
  if (current === "cancelled" || current === "returned") return [current];
  if (current === "delivered") return ["delivered", "returned"];
  const currentRank = STATUS_SEQUENCE.indexOf(current as (typeof STATUS_SEQUENCE)[number]);
  const forward = currentRank >= 0 ? STATUS_SEQUENCE.slice(currentRank) : [current];
  return [...forward, "cancelled"];
}

interface OrderStatusFormProps {
  orderId: string;
  currentStatus: string;
  currentPaymentStatus: string;
}

export function OrderStatusForm({ orderId, currentStatus, currentPaymentStatus }: OrderStatusFormProps) {
  const { addToast } = useToastStore();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(currentStatus);
  const [paymentStatus, setPaymentStatus] = useState(currentPaymentStatus);
  const [note, setNote] = useState("");
  const isTerminal = currentStatus === "cancelled" || currentStatus === "returned";
  const statusOptions = nextStatusOptions(currentStatus);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("id", orderId);
    formData.set("status", status);
    formData.set("paymentStatus", paymentStatus);
    formData.set("note", note);
    startTransition(async () => {
      const result = await updateOrderAction(formData);
      addToast(
        result.message ?? (result.ok ? "Order updated." : "Could not update the order."),
        result.ok ? "success" : "error"
      );
      if (result.ok) setNote("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-panel border border-border p-5">
      <label className="block font-sans text-sm text-ink">
        Order status
        <select
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={isTerminal}
          className="mt-1 h-11 w-full rounded-control border border-border px-3 font-sans text-sm disabled:bg-beige/60 disabled:text-muted"
        >
          {statusOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="block font-sans text-sm text-ink">
        Payment status
        <select
          name="paymentStatus"
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          className="mt-1 h-11 w-full rounded-control border border-border px-3 font-sans text-sm"
        >
          {PAYMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="block font-sans text-sm text-ink">
        Internal note (optional)
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-control border border-border px-3 py-2 font-sans text-sm"
          placeholder="Visible to staff only"
        />
      </label>
      {isTerminal && (
        <p className="font-sans text-xs text-muted">
          This order is {currentStatus} and can no longer change status.
        </p>
      )}
      <button
        type="submit"
        disabled={pending || isTerminal}
        className="h-11 rounded-control bg-wine px-5 font-sans font-semibold text-sm text-white disabled:opacity-50"
      >
        {pending ? "Updating…" : "Update order"}
      </button>
    </form>
  );
}
