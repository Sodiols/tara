"use client";

import { useState } from "react";
import {
  transitionOrderAction,
  updatePaymentStatusAction,
  addOrderNoteAction,
} from "@/lib/supabase/actions/admin";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  allowedTransitions,
  nextPipelineStatus,
} from "@/lib/order-status";
import type { OrderStatus, PaymentStatus } from "@/types/database";
import type { Permission } from "@/lib/permissions";
import {
  Field,
  Panel,
  PanelHeader,
  adminInputClass,
  adminTextareaClass,
} from "./ui";
import { ActionForm, SubmitButton } from "./AdminForm";

/**
 * The order action panel.
 *
 * Only transitions that are legal *and* permitted for this staff member are
 * offered — the database rejects anything else, so showing an option that
 * cannot succeed would only produce a confusing error.
 *
 * The two note fields are deliberately separate and labelled: the customer note
 * appears in public order tracking, the internal note never leaves the back
 * office.
 */
export function OrderActions({
  orderId,
  status,
  paymentStatus,
  permissions,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  permissions: readonly Permission[];
}) {
  const options = allowedTransitions(status, permissions);
  const suggested = nextPipelineStatus(status);
  const [selected, setSelected] = useState<OrderStatus | "">(
    suggested && options.includes(suggested) ? suggested : options[0] ?? "",
  );

  const isReversal = selected === "cancelled" || selected === "returned";

  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <PanelHeader
          title="Fulfilment"
          description={`Currently ${ORDER_STATUS_LABELS[status].toLowerCase()}.`}
        />
        <div className="px-5 py-5">
          {options.length === 0 ? (
            <p className="font-sans text-sm leading-6 text-muted">
              This order has reached a final state. No further fulfilment changes are
              possible, and stock has already been settled.
            </p>
          ) : (
            <ActionForm action={transitionOrderAction} className="flex flex-col gap-4">
              <input type="hidden" name="orderId" value={orderId} />

              <Field label="Move to" htmlFor="transition-status" required>
                <select
                  id="transition-status"
                  name="status"
                  value={selected}
                  onChange={(event) => setSelected(event.target.value as OrderStatus)}
                  className={adminInputClass}
                >
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {ORDER_STATUS_LABELS[option]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Customer note"
                htmlFor="transition-customer-note"
                hint="Shown to the customer on their order tracking page. Leave blank to post the status change on its own."
              >
                <input
                  id="transition-customer-note"
                  name="customerNote"
                  maxLength={300}
                  placeholder="e.g. Your parcel is with the courier"
                  className={adminInputClass}
                />
              </Field>

              <Field
                label="Internal note"
                htmlFor="transition-internal-note"
                hint="Private to staff. Never shown to the customer and never returned by order tracking."
              >
                <textarea
                  id="transition-internal-note"
                  name="internalNote"
                  maxLength={1000}
                  rows={3}
                  placeholder="e.g. Customer called to confirm the address"
                  className={adminTextareaClass}
                />
              </Field>

              {isReversal && (
                <label className="flex items-start gap-3 rounded-control border border-border bg-taraIvory/60 p-3">
                  <input
                    type="checkbox"
                    name="restock"
                    defaultChecked={selected === "cancelled"}
                    className="mt-1 h-4 w-4 accent-[#702D42]"
                  />
                  <span className="font-sans text-sm leading-6 text-ink">
                    Return these items to sellable stock
                    <span className="mt-0.5 block text-xs text-muted">
                      {selected === "cancelled"
                        ? "The goods never shipped, so this is normally correct."
                        : "Leave unticked if the returned garments still need inspection. You can put them back later from Inventory with a reason."}
                    </span>
                  </span>
                </label>
              )}

              <SubmitButton
                variant={isReversal ? "danger" : "primary"}
                confirm={
                  isReversal
                    ? `Move this order to "${selected}"? This cannot be undone.`
                    : undefined
                }
              >
                {selected ? `Mark as ${ORDER_STATUS_LABELS[selected as OrderStatus]}` : "Update"}
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      </Panel>

      {permissions.includes("orders.payment") && (
        <Panel>
          <PanelHeader
            title="Payment"
            description="Tracked separately from fulfilment — a delivered COD order is only paid once the cash is collected."
          />
          <div className="px-5 py-5">
            <ActionForm action={updatePaymentStatusAction} className="flex flex-col gap-4">
              <input type="hidden" name="orderId" value={orderId} />
              <Field label="Payment status" htmlFor="payment-status" required>
                <select
                  id="payment-status"
                  name="paymentStatus"
                  defaultValue={paymentStatus}
                  className={adminInputClass}
                >
                  {PAYMENT_STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {PAYMENT_STATUS_LABELS[option]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reason" htmlFor="payment-note" hint="Recorded in the audit log.">
                <input
                  id="payment-note"
                  name="note"
                  maxLength={300}
                  placeholder="e.g. Cash collected on delivery"
                  className={adminInputClass}
                />
              </Field>
              <SubmitButton variant="secondary">Update payment</SubmitButton>
            </ActionForm>
          </div>
        </Panel>
      )}

      {permissions.includes("orders.note") && (
        <Panel>
          <PanelHeader title="Add internal note" description="Staff only. Never shown to the customer." />
          <div className="px-5 py-5">
            <ActionForm
              action={addOrderNoteAction}
              className="flex flex-col gap-4"
              resetOnSuccess
            >
              <input type="hidden" name="orderId" value={orderId} />
              <Field label="Note" htmlFor="order-note">
                <textarea
                  id="order-note"
                  name="note"
                  rows={3}
                  maxLength={1000}
                  required
                  placeholder="e.g. Address confirmed by phone; deliver after 4pm"
                  className={adminTextareaClass}
                />
              </Field>
              <SubmitButton variant="secondary">Save note</SubmitButton>
            </ActionForm>
          </div>
        </Panel>
      )}
    </div>
  );
}
