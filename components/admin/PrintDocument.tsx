"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Print chrome for the invoice and packing slip.
 *
 * The controls are `print:hidden` so the printed sheet contains only the
 * document itself. Printing is triggered by the staff member, not
 * automatically, so a mis-click never sends a job to a shared shop printer.
 */
export function PrintToolbar({ backHref, label }: { backHref: string; label: string }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        // Let the browser handle it; this listener exists only so the shortcut
        // is discoverable via the hint below.
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Link
        href={backHref}
        className="inline-flex h-11 items-center rounded-control border border-border bg-white px-4 font-sans text-[13px] font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
      >
        ← Back to order
      </Link>
      <div className="flex items-center gap-3">
        <span className="font-sans text-xs text-muted">Ctrl/⌘ + P also works</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-11 items-center rounded-control border border-taraWine bg-taraWine px-5 font-sans text-[13px] font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack"
        >
          Print {label}
        </button>
      </div>
    </div>
  );
}
