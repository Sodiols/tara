"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  ARCHIVE_TYPE_LABELS,
  MAX_BULK_ARCHIVE_ITEMS,
  PURGE_CONFIRMATION_WORD,
  purgeNeedsTypedConfirmation,
  type ArchiveType,
} from "@/lib/archive";
import { purgeArchivedItemsAction, restoreArchivedItemsAction } from "@/lib/supabase/actions/archive";
import { formatDateTime } from "@/lib/format";
import { roleLabel } from "@/lib/permissions";
import { lockBodyScroll } from "@/lib/scroll-lock";
import { useToastStore } from "@/store/toastStore";
import { cn } from "@/lib/utils";
import { AdminEmptyState, Badge, TableWrap, Td, Th } from "./ui";

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
            : "Products, categories, collections, coupons and reviews that anyone archives appear here."
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
        <PurgeDialog
          rows={purgeTarget}
          pending={pending}
          onCancel={() => setPurgeTarget(null)}
          onConfirm={(confirmation) => purge(purgeTarget, confirmation)}
        />
      )}
    </>
  );
}

function PurgeDialog({
  rows,
  pending,
  onCancel,
  onConfirm,
}: {
  rows: ArchiveRow[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: (confirmation: string) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const firstControl = useRef<HTMLButtonElement | HTMLInputElement | null>(null);
  const needsWord = purgeNeedsTypedConfirmation(rows.map((row) => row.type));
  const ready = !needsWord || typed.trim() === PURGE_CONFIRMATION_WORD;
  const single = rows.length === 1 ? rows[0] : null;

  useEffect(() => {
    firstControl.current?.focus();
    const release = lockBodyScroll();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      release();
    };
  }, [onCancel, pending]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-taraBlack/50" aria-hidden="true" onClick={() => !pending && onCancel()} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md rounded-panel border border-border bg-taraWhite p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8C2F2F]/10 text-[#8C2F2F]">
            <AlertTriangle size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="font-serif text-xl text-ink">
              {single ? "Permanently delete this item?" : `Permanently delete ${rows.length} items?`}
            </h2>
            <div id={descriptionId} className="mt-2 flex flex-col gap-2 text-sm leading-6 text-muted">
              <p>
                <strong className="text-ink">This action cannot be undone.</strong>{" "}
                {single
                  ? `"${single.label || "Untitled"}" (${ARCHIVE_TYPE_LABELS[single.type].toLowerCase()}) will be removed from the database.`
                  : "Every selected item will be removed from the database."}
              </p>
              <p>
                Anything linked to past orders or still in use is kept for the records instead, and stays in the
                archive.
              </p>
            </div>
          </div>
        </div>

        {needsWord && (
          <div className="mt-5">
            <label htmlFor={inputId} className="font-sans text-sm font-medium text-ink">
              Type <span className="font-mono font-semibold">{PURGE_CONFIRMATION_WORD}</span> to confirm
            </label>
            <input
              id={inputId}
              ref={(element) => {
                firstControl.current = element;
              }}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 h-11 w-full rounded-control border border-border bg-taraWhite px-3 font-mono text-sm outline-none focus:border-[#8C2F2F]"
            />
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            ref={(element) => {
              if (!needsWord) firstControl.current = element;
            }}
            className={secondaryButton}
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(buttonBase, "border border-[#8C2F2F] bg-[#8C2F2F] text-taraWhite hover:bg-taraBlack hover:border-taraBlack")}
            disabled={pending || !ready}
            onClick={() => onConfirm(needsWord ? typed.trim() : "confirmed")}
          >
            {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Permanently Delete
          </button>
        </div>
      </div>
    </div>
  );
}
