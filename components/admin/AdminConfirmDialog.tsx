"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { lockBodyScroll } from "@/lib/scroll-lock";
import { adminButtonClass } from "./ui";

/**
 * The confirmation in front of anything the back office cannot take back.
 *
 * Replaces `window.confirm`, which could not say what the consequence was in
 * more than one grey line, could not be styled as dangerous, and on some
 * phones renders as a system sheet with the buttons the wrong way round.
 *
 * `requireWord` is for the irreversible end of the scale — permanently deleting
 * an order or a product. The confirm button stays disabled until the word is
 * typed exactly. Where the server also checks a word (Archive & Trash), it is
 * the same word, and the server's check is the one that counts: this protects
 * the person at the keyboard from a slip, it is not the authorisation.
 *
 * Accessible as an alert dialog: focus moves in on open, Tab stays inside it,
 * Escape cancels (unless the action is already running), and focus returns to
 * whatever opened it on close.
 */
export function AdminConfirmDialog({
  title,
  body,
  confirmLabel,
  tone = "danger",
  requireWord,
  pending = false,
  option,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: ReactNode | string[];
  confirmLabel: string;
  /** "danger" for destructive actions, "primary" for consequential ones. */
  tone?: "danger" | "primary";
  /** A word that must be typed before the action can run. */
  requireWord?: string;
  pending?: boolean;
  /** An optional checkbox above the buttons, e.g. "also return stock". */
  option?: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void };
  onCancel: () => void;
  /** Receives what was typed when `requireWord` is set. */
  onConfirm: (confirmation: string) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const optionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");
  const ready = !requireWord || typed.trim() === requireWord;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    // The word field when there is one, otherwise Cancel — never the
    // destructive button, so a stray Enter cannot confirm.
    const first = dialog?.querySelector<HTMLElement>("[data-autofocus]");
    first?.focus();

    const release = lockBodyScroll();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      release();
      opener?.focus?.();
    };
  }, [onCancel, pending]);

  const paragraphs = Array.isArray(body) ? body : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-taraBlack/50"
        aria-hidden="true"
        onClick={() => !pending && onCancel()}
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md rounded-panel border border-border bg-taraWhite p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          {tone === "danger" && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8C2F2F]/10 text-[#8C2F2F]">
              <AlertTriangle size={18} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h2 id={titleId} className="font-sans text-lg font-bold text-ink">
              {title}
            </h2>
            <div id={descriptionId} className="mt-2 flex flex-col gap-2 text-sm leading-6 text-muted">
              {paragraphs ? paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>) : body}
            </div>
          </div>
        </div>

        {option && (
          <label htmlFor={optionId} className="mt-5 flex items-start gap-2.5 font-sans text-sm text-ink">
            <input
              id={optionId}
              type="checkbox"
              checked={option.checked}
              onChange={(event) => option.onChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#702D42]"
            />
            <span>
              {option.label}
              {option.hint && <span className="mt-0.5 block text-xs text-muted">{option.hint}</span>}
            </span>
          </label>
        )}

        {requireWord && (
          <div className="mt-5">
            <label htmlFor={inputId} className="font-sans text-sm font-medium text-ink">
              Type <span className="font-mono font-semibold">{requireWord}</span> to confirm
            </label>
            <input
              id={inputId}
              data-autofocus
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 h-11 w-full rounded-control border border-border bg-taraWhite px-3 font-mono text-sm outline-none focus:border-[#8C2F2F]"
            />
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            {...(requireWord ? {} : { "data-autofocus": true })}
            className={adminButtonClass("secondary", "md")}
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={adminButtonClass(
              "primary",
              "md",
              tone === "danger"
                ? "border-[#8C2F2F] bg-[#8C2F2F] hover:border-taraBlack hover:bg-taraBlack"
                : undefined,
            )}
            disabled={pending || !ready}
            aria-busy={pending}
            onClick={() => onConfirm(requireWord ? typed.trim() : "confirmed")}
          >
            {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
