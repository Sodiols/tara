"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  ARCHIVE_TYPE_LABELS,
  MAX_BULK_ARCHIVE_ITEMS,
  orderDeletionWarning,
  purgeNeedsTypedConfirmation,
  type ArchiveType,
} from "@/lib/archive";
import { purgeArchivedItemsAction, restoreArchivedItemsAction } from "@/lib/supabase/actions/archive";
import { formatDateTime } from "@/lib/format";
import { roleLabel } from "@/lib/permissions";
import { useToastStore } from "@/store/toastStore";
import { cn } from "@/lib/utils";
import { AdminEmptyState, Badge, TableWrap, Td, Th } from "./ui";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

export interface ArchiveRow {
  type: ArchiveType;
  id: string;
  label: string;
  detail: string | null;
  archivedAt: string;
  archivedByEmail: string;
  archivedByRole: string;
}

const keyOf = (row: Pick<ArchiveRow, "type" | "id">) => `${row.type}:${row.id}`;

const buttonBase =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-control px-4 font-sans text-xs font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:border-border disabled:bg-taraIvory disabled:text-muted";
const secondaryButton = `${buttonBase} border border-border bg-taraWhite text-ink hover:border-taraWine hover:text-taraWine`;
const dangerButton = `${buttonBase} border border-[#8C2F2F]/40 bg-taraWhite text-[#8C2F2F] hover:bg-[#8C2F2F] hover:text-taraWhite`;

export function ArchiveTable({ items, filtered }: { items: ArchiveRow[]; filtered: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [purgeTarget, setPurgeTarget] = useState<ArchiveRow[] | null>(null);
  const addToast = useToastStore((state) => state.addToast);

  // Derived from the rows on screen, so a key left over from a row that was
  // restored or deleted elsewhere can never be acted on.
  const selectedRows = items.filter((row) => selected.has(keyOf(row)));
  const allSelected = items.length > 0 && selectedRows.length === items.length;

  const toggle = (row: ArchiveRow) =>
    setSelected((current) => {
      const next = new Set(current);
      const key = keyOf(row);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const restore = (rows: ArchiveRow[]) => {
    startTransition(async () => {
      const result = await restoreArchivedItemsAction(rows.map(({ type, id }) => ({ type, id })));
      addToast(result.message ?? "Done.", result.ok ? "success" : "error");
      if (result.ok) setSelected(new Set());
    });
  };

  const purge = (rows: ArchiveRow[], confirmation: string) => {
    startTransition(async () => {
      const result = await purgeArchivedItemsAction(rows.map(({ type, id }) => ({ type, id })), confirmation);
      addToast(result.message ?? "Done.", result.ok ? "success" : "error");
      setPurgeTarget(null);
      if (result.ok) setSelected(new Set());
    });
  };

  if (items.length === 0) {
    return (
      <AdminEmptyState
        title={filtered ? "Nothing archived matches that search" : "The archive is empty"}
        description={
          filtered
            ? "Try another name, ID or type, or reset the filters."
            : "Orders, products, categories, collections, coupons and reviews that are archived appear here."
        }
      />
    );
  }

  const tooMany = selectedRows.length > MAX_BULK_ARCHIVE_ITEMS;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="font-sans text-sm text-muted" aria-live="polite">
          {selectedRows.length > 0
            ? `${selectedRows.length} selected`
            : "Select items to restore or delete several at once."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={secondaryButton}
            disabled={pending || selectedRows.length === 0 || tooMany}
            onClick={() => restore(selectedRows)}
          >
            {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Restore Selected
          </button>
          <button
            type="button"
            className={dangerButton}
            disabled={pending || selectedRows.length === 0 || tooMany}
            onClick={() => setPurgeTarget(selectedRows)}
          >
            Permanently Delete Selected
          </button>
        </div>
      </div>

      <TableWrap>
        <thead>
          <tr>
            <Th className="w-10">
              <input
                type="checkbox"
                aria-label="Select all archived items on this page"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(items.map(keyOf)))}
                className="h-4 w-4 accent-[#702D42]"
              />
            </Th>
            <Th>Item</Th>
            <Th>Type</Th>
            <Th>Archived by</Th>
            <Th>Archived</Th>
            <Th align="right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const key = keyOf(row);
            return (
              <tr key={key} className={cn("transition-colors hover:bg-taraIvory/40", selected.has(key) && "bg-taraIvory/60")}>
                <Td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.label || "item"}`}
                    checked={selected.has(key)}
                    onChange={() => toggle(row)}
                    className="h-4 w-4 accent-[#702D42]"
                  />
                </Td>
                <Td>
                  <span className="block font-medium">{row.label || "Untitled"}</span>
                  {row.detail && <span className="mt-0.5 block text-xs text-muted">{row.detail}</span>}
                  <span className="mt-0.5 block font-mono text-[11px] text-muted">{row.id}</span>
                </Td>
                <Td>
                  <Badge tone="neutral">{ARCHIVE_TYPE_LABELS[row.type]}</Badge>
                </Td>
                <Td>
                  <span className="block text-sm">{row.archivedByEmail || "Unknown"}</span>
                  <span className="block text-xs text-muted">
                    {row.archivedByRole === "unknown" || row.archivedByRole === "system"
                      ? "Before Archive & Trash existed"
                      : roleLabel(row.archivedByRole)}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-xs text-muted">{formatDateTime(row.archivedAt)}</Td>
                <Td align="right">
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => restore([row])}
                      className="font-sans text-xs font-semibold uppercase tracking-wide text-taraWine underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setPurgeTarget([row])}
                      className="font-sans text-xs font-semibold uppercase tracking-wide text-[#8C2F2F] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted"
                    >
                      Permanently Delete
                    </button>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>

      {purgeTarget && (
        <ConfirmDeleteDialog
          {...purgeWarning(purgeTarget)}
          requireWord={purgeNeedsTypedConfirmation(purgeTarget.map((row) => row.type))}
          pending={pending}
          onCancel={() => setPurgeTarget(null)}
          onConfirm={(confirmation) => purge(purgeTarget, confirmation)}
        />
      )}
    </>
  );
}

/** The dialog copy: the order warning for orders, a general one otherwise. */
function purgeWarning(rows: ArchiveRow[]): { title: string; body: string[] } {
  const orders = rows.filter((row) => row.type === "order").length;
  if (orders === rows.length) {
    const warning = orderDeletionWarning(rows.length);
    return {
      ...warning,
      body: [...warning.body, "Stock still held by an order that never shipped is returned, and coupon usage is released."],
    };
  }
  const single = rows.length === 1 ? rows[0] : null;
  return {
    title: single ? "Permanently delete this item?" : `Permanently delete ${rows.length} items?`,
    body: [
      single
        ? `"${single.label || "Untitled"}" (${ARCHIVE_TYPE_LABELS[single.type].toLowerCase()}) will be removed from the database. This action cannot be undone.`
        : "Every selected item will be removed from the database. This action cannot be undone.",
      ...(orders > 0 ? ["Deleted orders stop counting in revenue and statistics."] : []),
      "Anything linked to past orders or still in use is kept for the records instead, and stays in the archive.",
    ],
  };
}
