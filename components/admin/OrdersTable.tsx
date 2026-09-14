"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { MAX_BULK_ARCHIVE_ITEMS, orderDeletionWarning } from "@/lib/archive";
import { archiveOrdersAction, deleteOrdersAction } from "@/lib/supabase/actions/archive";
import { formatDateTime, formatTaka } from "@/lib/format";
import { formatBdPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toastStore";
import type { AdminOrderRow } from "@/lib/supabase/queries/admin";
import { TableWrap, Td, Th } from "./ui";
import { OrderStatusBadge, PaymentStatusBadge } from "./status";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

const buttonBase =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-control px-4 font-sans text-xs font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:border-border disabled:bg-taraIvory disabled:text-muted";

/**
 * The orders list.
 *
 * `canDelete` is true only for holders of archive.manage (administrators). It
 * decides whether the selection column and the bulk bar are rendered at all —
 * a manager's page contains no delete control to find. It is not the
 * protection: archiveOrdersAction and deleteOrdersAction check the permission
 * on the server, and the database functions they call check it again.
 */
export function OrdersTable({ rows, canDelete }: { rows: AdminOrderRow[]; canDelete: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<AdminOrderRow[] | null>(null);
  const [restockShipped, setRestockShipped] = useState(false);
  const [pending, startTransition] = useTransition();
  const addToast = useToastStore((state) => state.addToast);

  const selectedRows = rows.filter((row) => selected.has(row.id));
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;
  const tooMany = selectedRows.length > MAX_BULK_ARCHIVE_ITEMS;
  const selectedTotal = selectedRows.reduce((sum, row) => sum + Number(row.total), 0);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const archiveSelected = () => {
    startTransition(async () => {
      const result = await archiveOrdersAction(selectedRows.map((row) => row.id));
      addToast(result.message ?? "Done.", result.ok ? "success" : "error");
      if (result.ok) setSelected(new Set());
    });
  };

  const deleteSelected = (targets: AdminOrderRow[], confirmation: string) => {
    startTransition(async () => {
      const result = await deleteOrdersAction(
        targets.map((row) => row.id),
        confirmation,
        restockShipped,
      );
      addToast(result.message ?? "Done.", result.ok ? "success" : "error");
      setConfirming(null);
      setRestockShipped(false);
      if (result.ok) setSelected(new Set());
    });
  };

  const hasShipped = (confirming ?? []).some((row) => row.status === "shipped" || row.status === "delivered");
  const warning = confirming ? orderDeletionWarning(confirming.length) : null;

  return (
    <>
      {canDelete && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 font-sans text-sm text-ink">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)))}
                className="h-4 w-4 accent-[#702D42]"
              />
              Select All
            </label>
            <p className="font-sans text-sm text-muted" aria-live="polite">
              {selectedRows.length > 0
                ? `${selectedRows.length} selected · ${formatTaka(selectedTotal)}`
                : "Administrators can archive or permanently delete orders."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || selectedRows.length === 0 || tooMany}
              onClick={archiveSelected}
              className={cn(buttonBase, "border border-border bg-taraWhite text-ink hover:border-taraWine hover:text-taraWine")}
            >
              {pending && !confirming && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Archive Selected
            </button>
            <button
              type="button"
              disabled={pending || selectedRows.length === 0 || tooMany}
              onClick={() => setConfirming(selectedRows)}
              className={cn(buttonBase, "border border-[#8C2F2F]/40 bg-taraWhite text-[#8C2F2F] hover:bg-[#8C2F2F] hover:text-taraWhite")}
            >
              Permanently Delete Selected
            </button>
          </div>
        </div>
      )}

      <TableWrap>
        <thead>
          <tr>
            {canDelete && (
              <Th className="w-10">
                <span className="sr-only">Select</span>
              </Th>
            )}
            <Th>Order</Th>
            <Th>Customer</Th>
            <Th>Fulfilment</Th>
            <Th>Payment</Th>
            <Th align="right">Total</Th>
            <Th align="right">Placed</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr
              key={order.id}
              className={cn("transition-colors hover:bg-taraIvory/50", selected.has(order.id) && "bg-taraIvory/60")}
            >
              {canDelete && (
                <Td>
                  <input
                    type="checkbox"
                    aria-label={`Select order ${order.order_number}`}
                    checked={selected.has(order.id)}
                    onChange={() => toggle(order.id)}
                    className="h-4 w-4 accent-[#702D42]"
                  />
                </Td>
              )}
              <Td>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="font-semibold text-taraWine underline-offset-4 hover:underline"
                >
                  {order.order_number}
                </Link>
                {order.risk_flags.includes("repeat_cancellations") && (
                  <span className="mt-1 block font-sans text-[11px] font-semibold uppercase tracking-wide text-[#8A6A1F]">
                    Repeat cancellations
                  </span>
                )}
              </Td>
              <Td>
                <span className="block">{order.customer_name}</span>
                <span className="block font-sans text-xs text-muted">{formatBdPhone(order.customer_phone)}</span>
              </Td>
              <Td>
                <OrderStatusBadge status={order.status} />
              </Td>
              <Td>
                <PaymentStatusBadge status={order.payment_status} />
              </Td>
              <Td align="right" className="font-semibold">
                {formatTaka(order.total)}
              </Td>
              <Td align="right" className="whitespace-nowrap text-xs text-muted">
                {formatDateTime(order.created_at)}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      {confirming && warning && (
        <ConfirmDeleteDialog
          title={warning.title}
          body={[
            ...warning.body,
            `Orders selected: ${confirming.map((row) => row.order_number).slice(0, 6).join(", ")}${confirming.length > 6 ? ` and ${confirming.length - 6} more` : ""} (${formatTaka(confirming.reduce((sum, row) => sum + Number(row.total), 0))}).`,
            "Stock still held by an order that never shipped is returned, and coupon usage is released.",
          ]}
          requireWord
          pending={pending}
          option={
            hasShipped
              ? {
                  label: "Also return stock for shipped or delivered orders",
                  hint: "Only for test orders. Real shipped goods have already left the shop.",
                  checked: restockShipped,
                  onChange: setRestockShipped,
                }
              : undefined
          }
          onCancel={() => {
            setConfirming(null);
            setRestockShipped(false);
          }}
          onConfirm={(confirmation) => deleteSelected(confirming, confirmation)}
        />
      )}
    </>
  );
}
