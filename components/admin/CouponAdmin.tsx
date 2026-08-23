"use client";

import { useState } from "react";
import { archiveCouponAction, saveCouponAction } from "@/lib/supabase/actions/admin";
import { formatDate, formatTaka, isoToStoreLocal } from "@/lib/format";
import type { Tables } from "@/types/database";
import { ActionForm, RowActionButton, SubmitButton } from "./AdminForm";
import {
  AdminEmptyState,
  Field,
  Panel,
  PanelHeader,
  TableWrap,
  Td,
  Th,
  adminInputClass,
} from "./ui";
import { ActiveBadge, Badge } from "./status";

type Coupon = Tables<"coupons">;

function couponState(coupon: Coupon): { label: string; tone: "success" | "warning" | "neutral" | "danger" } {
  if (coupon.archived_at) return { label: "Archived", tone: "neutral" };
  if (!coupon.is_active) return { label: "Disabled", tone: "neutral" };
  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
    return { label: "Expired", tone: "danger" };
  }
  if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
    return { label: "Scheduled", tone: "warning" };
  }
  if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
    return { label: "Fully used", tone: "danger" };
  }
  return { label: "Live", tone: "success" };
}

export function CouponAdmin({ coupons }: { coupons: Coupon[] }) {
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [showForm, setShowForm] = useState(false);

  const open = (coupon: Coupon | null) => {
    setEditing(coupon);
    setShowForm(true);
  };
  const close = () => {
    setEditing(null);
    setShowForm(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <PanelHeader
          title="Coupons"
          description="Discounts are validated and applied by the database at checkout — the browser never calculates the amount."
          actions={
            <button
              type="button"
              onClick={() => open(null)}
              className="inline-flex h-10 items-center rounded-control border border-taraWine bg-taraWine px-4 font-sans text-xs font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack"
            >
              New coupon
            </button>
          }
        />

        {coupons.length === 0 ? (
          <AdminEmptyState
            title="No coupons yet"
            description="Create a coupon to run a promotion. Usage caps and per-customer limits are enforced server-side."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Discount</Th>
                <Th align="right">Minimum</Th>
                <Th>Window</Th>
                <Th align="right">Used</Th>
                <Th>State</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const state = couponState(coupon);
                return (
                  <tr key={coupon.id} className="transition-colors hover:bg-taraIvory/40">
                    <Td>
                      <span className="block font-mono text-sm font-semibold">{coupon.code}</span>
                      {coupon.description_en && (
                        <span className="block font-sans text-xs text-muted">
                          {coupon.description_en}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {coupon.discount_type === "percentage"
                        ? `${coupon.discount_value}%`
                        : formatTaka(coupon.discount_value)}
                      {coupon.maximum_discount_amount && (
                        <span className="block text-xs text-muted">
                          max {formatTaka(coupon.maximum_discount_amount)}
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      {Number(coupon.minimum_order_amount) > 0
                        ? formatTaka(coupon.minimum_order_amount)
                        : "—"}
                    </Td>
                    <Td className="text-xs text-muted">
                      {coupon.starts_at ? formatDate(coupon.starts_at) : "Now"} →{" "}
                      {coupon.expires_at ? formatDate(coupon.expires_at) : "No expiry"}
                    </Td>
                    <Td align="right">
                      {coupon.usage_count}
                      {coupon.usage_limit !== null && (
                        <span className="text-muted"> / {coupon.usage_limit}</span>
                      )}
                      {coupon.per_customer_limit !== null && (
                        <span className="block text-[11px] text-muted">
                          {coupon.per_customer_limit} per customer
                        </span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={state.tone}>{state.label}</Badge>
                        <ActiveBadge active={coupon.is_active} />
                      </div>
                    </Td>
                    <Td align="right">
                      <div className="flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => open(coupon)}
                          className="font-sans text-xs font-semibold uppercase tracking-wide text-taraWine underline-offset-4 hover:underline"
                        >
                          Edit
                        </button>
                        {coupon.archived_at ? (
                          <RowActionButton action={async () => archiveCouponAction(coupon.id, false)}>
                            Restore
                          </RowActionButton>
                        ) : (
                          <RowActionButton
                            tone="danger"
                            confirm={`Archive "${coupon.code}"? It stops working immediately. Orders that already used it keep their discount.`}
                            action={async () => archiveCouponAction(coupon.id, true)}
                          >
                            Archive
                          </RowActionButton>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      {showForm && (
        <Panel>
          <PanelHeader title={editing ? `Edit ${editing.code}` : "New coupon"} />
          <div className="px-5 py-5">
            <ActionForm
              key={editing?.id ?? "new"}
              action={saveCouponAction}
              className="flex flex-col gap-5"
              onSuccess={close}
            >
              {editing && <input type="hidden" name="id" value={editing.id} />}

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Code"
                  htmlFor="coupon-code"
                  required
                  hint="Letters, numbers, hyphen and underscore. Stored uppercase."
                >
                  <input
                    id="coupon-code"
                    name="code"
                    required
                    minLength={3}
                    maxLength={30}
                    defaultValue={editing?.code ?? ""}
                    className={`${adminInputClass} font-mono uppercase`}
                  />
                </Field>
                <Field label="Discount type" htmlFor="coupon-type" required>
                  <select
                    id="coupon-type"
                    name="discountType"
                    defaultValue={editing?.discount_type ?? "percentage"}
                    className={adminInputClass}
                  >
                    <option value="percentage">Percentage of subtotal</option>
                    <option value="fixed">Fixed amount (৳)</option>
                  </select>
                </Field>
                <Field label="Discount value" htmlFor="coupon-value" required>
                  <input
                    id="coupon-value"
                    name="discountValue"
                    type="number"
                    min={0.01}
                    step="0.01"
                    required
                    defaultValue={editing?.discount_value ?? ""}
                    className={adminInputClass}
                  />
                </Field>

                <Field
                  label="Minimum order (৳)"
                  htmlFor="coupon-min"
                  hint="0 means no minimum."
                >
                  <input
                    id="coupon-min"
                    name="minimumOrderAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={editing?.minimum_order_amount ?? 0}
                    className={adminInputClass}
                  />
                </Field>
                <Field
                  label="Maximum discount (৳)"
                  htmlFor="coupon-max"
                  hint="Caps a percentage discount. Blank for no cap."
                >
                  <input
                    id="coupon-max"
                    name="maximumDiscountAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={editing?.maximum_discount_amount ?? ""}
                    className={adminInputClass}
                  />
                </Field>
                <Field
                  label="Total usage limit"
                  htmlFor="coupon-limit"
                  hint="Blank for unlimited."
                >
                  <input
                    id="coupon-limit"
                    name="usageLimit"
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={editing?.usage_limit ?? ""}
                    className={adminInputClass}
                  />
                </Field>

                <Field
                  label="Per customer limit"
                  htmlFor="coupon-per-customer"
                  hint="Counted by account and by phone number, so a guest cannot reuse it."
                >
                  <input
                    id="coupon-per-customer"
                    name="perCustomerLimit"
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={editing?.per_customer_limit ?? ""}
                    className={adminInputClass}
                  />
                </Field>
                <Field label="Starts at" htmlFor="coupon-starts" hint="Bangladesh time.">
                  <input
                    id="coupon-starts"
                    name="startsAt"
                    type="datetime-local"
                    defaultValue={isoToStoreLocal(editing?.starts_at)}
                    className={adminInputClass}
                  />
                </Field>
                <Field label="Expires at" htmlFor="coupon-expires" hint="Bangladesh time.">
                  <input
                    id="coupon-expires"
                    name="expiresAt"
                    type="datetime-local"
                    defaultValue={isoToStoreLocal(editing?.expires_at)}
                    className={adminInputClass}
                  />
                </Field>

                <Field label="Description" htmlFor="coupon-desc-en">
                  <input
                    id="coupon-desc-en"
                    name="descriptionEn"
                    maxLength={300}
                    defaultValue={editing?.description_en ?? ""}
                    className={adminInputClass}
                  />
                </Field>
                <label className="flex items-center gap-2 self-end pb-3 font-sans text-sm text-ink">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={editing?.is_active ?? true}
                    className="h-4 w-4 accent-[#702D42]"
                  />
                  Active
                </label>
              </div>

              <div className="flex gap-3">
                <SubmitButton>{editing ? "Save coupon" : "Create coupon"}</SubmitButton>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-11 items-center rounded-control border border-border bg-taraWhite px-4 font-sans text-[13px] font-semibold uppercase tracking-wide text-muted transition-colors hover:text-taraWine"
                >
                  Cancel
                </button>
              </div>
            </ActionForm>
          </div>
        </Panel>
      )}
    </div>
  );
}
