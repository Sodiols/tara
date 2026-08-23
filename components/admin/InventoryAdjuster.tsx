"use client";

import { useState } from "react";
import { adjustInventoryAction } from "@/lib/supabase/actions/admin";
import { INVENTORY_REASONS } from "@/lib/order-status";
import { ActionForm, SubmitButton } from "./AdminForm";
import { Field, adminInputClass } from "./ui";

/**
 * Inline stock adjustment.
 *
 * Setting a stock level always requires a reason, because the database records
 * an `inventory_adjustments` row for every movement — an unexplained change
 * would leave a hole in the audit trail that no one can reconcile later.
 */
export function InventoryAdjuster({
  variantId,
  sku,
  currentStock,
  label,
}: {
  variantId: string;
  sku: string;
  currentStock: number;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-sans text-xs font-semibold uppercase tracking-wide text-taraWine underline-offset-4 hover:underline"
      >
        Adjust
      </button>
    );
  }

  return (
    <ActionForm
      action={adjustInventoryAction}
      className="flex flex-col gap-2 rounded-control border border-border bg-taraIvory/60 p-3 text-left"
      onSuccess={() => setOpen(false)}
    >
      <input type="hidden" name="variantId" value={variantId} />
      <p className="font-sans text-xs text-muted">
        {label} · SKU {sku} · currently {currentStock}
      </p>

      <div className="flex flex-wrap gap-2">
        <Field label="New stock" htmlFor={`stock-${variantId}`} className="w-24">
          <input
            id={`stock-${variantId}`}
            name="newQuantity"
            type="number"
            min={0}
            max={1000000}
            step={1}
            required
            defaultValue={currentStock}
            className={adminInputClass}
          />
        </Field>
        <Field label="Reason" htmlFor={`reason-${variantId}`} className="min-w-[170px] flex-1">
          <select
            id={`reason-${variantId}`}
            name="reason"
            required
            defaultValue="restock"
            className={adminInputClass}
          >
            {INVENTORY_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Note" htmlFor={`note-${variantId}`} className="flex-1">
        <input
          id={`note-${variantId}`}
          name="note"
          maxLength={500}
          placeholder="Optional — e.g. delivery from supplier"
          className={adminInputClass}
        />
      </Field>

      <div className="flex gap-2">
        <SubmitButton className="h-10 px-4 text-xs">Save</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex h-10 items-center rounded-control border border-border bg-taraWhite px-4 font-sans text-xs font-semibold uppercase tracking-wide text-muted transition-colors hover:text-taraWine"
        >
          Cancel
        </button>
      </div>
    </ActionForm>
  );
}
