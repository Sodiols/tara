"use client";

import { useState } from "react";
import { exportNewsletterCsvAction } from "@/lib/supabase/actions/admin-export";
import { useToastStore } from "@/store/toastStore";

/**
 * CSV export.
 *
 * The file is built on the server (where the permission check lives) and turned
 * into a download in the browser, so the address list is never exposed on a
 * public URL that could be shared or guessed.
 */
export function NewsletterExport({ activeOnly }: { activeOnly: boolean }) {
  const [pending, setPending] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={async () => {
        setPending(true);
        try {
          const result = await exportNewsletterCsvAction(activeOnly);
          if (!result.ok) {
            addToast(result.message, "error");
            return;
          }
          const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = result.filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          addToast(`Exported ${result.count} subscriber${result.count === 1 ? "" : "s"}.`, "success");
        } catch {
          addToast("The export could not be generated.", "error");
        } finally {
          setPending(false);
        }
      }}
      className="inline-flex h-10 items-center rounded-control border border-border bg-taraWhite px-4 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine disabled:cursor-not-allowed disabled:text-muted"
    >
      {pending ? "Preparing…" : "Export CSV"}
    </button>
  );
}
