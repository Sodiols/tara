"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { PURGE_CONFIRMATION_WORD } from "@/lib/archive";
import { lockBodyScroll } from "@/lib/scroll-lock";
import { cn } from "@/lib/utils";

const buttonBase =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-control px-4 font-sans text-xs font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:border-border disabled:bg-taraIvory disabled:text-muted";

/**
 * The confirmation in front of every permanent delete in the back office.
 *
 * With `requireWord`, the final button stays disabled until DELETE is typed.
 * The server action checks the same word again, so this is a safeguard for the
 * person at the keyboard, not the authorisation.
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
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const optionId = useId();
  const [typed, setTyped] = useState("");
  const firstControl = useRef<HTMLButtonElement | HTMLInputElement | null>(null);
  const ready = !requireWord || typed.trim() === PURGE_CONFIRMATION_WORD;

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
              {title}
            </h2>
            <div id={descriptionId} className="mt-2 flex flex-col gap-2 text-sm leading-6 text-muted">
              {body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
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
              if (!requireWord) firstControl.current = element;
            }}
            className={cn(buttonBase, "border border-border bg-taraWhite text-ink hover:border-taraWine hover:text-taraWine")}
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(buttonBase, "border border-[#8C2F2F] bg-[#8C2F2F] text-taraWhite hover:border-taraBlack hover:bg-taraBlack")}
            disabled={pending || !ready}
            onClick={() => onConfirm(requireWord ? typed.trim() : "confirmed")}
          >
            {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Permanently Delete
          </button>
        </div>
      </div>
    </div>
  );
}
