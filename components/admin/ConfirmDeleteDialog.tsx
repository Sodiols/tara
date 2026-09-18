"use client";

import { PURGE_CONFIRMATION_WORD } from "@/lib/archive";
import { AdminConfirmDialog } from "./AdminConfirmDialog";

/**
 * The confirmation in front of every permanent delete in the back office.
 *
 * With `requireWord`, the final button stays disabled until DELETE is typed.
 * The server action checks the same word again, so this is a safeguard for the
 * person at the keyboard, not the authorisation.
 *
 * A thin, fixed-wording wrapper over AdminConfirmDialog, so every permanent
 * delete reads the same way and the word cannot drift from the one the server
 * checks.
 */
export function ConfirmDeleteDialog({
  title,
  body,
  requireWord,
  pending,
  option,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string[];
  requireWord: boolean;
  pending: boolean;
  /** An optional checkbox shown above the buttons, e.g. "also return stock". */
  option?: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void };
  onCancel: () => void;
  onConfirm: (confirmation: string) => void;
}) {
  return (
    <AdminConfirmDialog
      title={title}
      body={body}
      confirmLabel="Permanently Delete"
      tone="danger"
      requireWord={requireWord ? PURGE_CONFIRMATION_WORD : undefined}
      pending={pending}
      option={option}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
