"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Admin error boundary.
 *
 * Staff see a plain sentence and a way forward. The underlying error goes to
 * the server log via console.error — a database message can name tables,
 * columns and constraints, which does not belong on screen.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] unhandled error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-taraWine">
        TARA Operations
      </p>
      <h1 className="mt-2 font-serif text-2xl text-ink">This screen could not load</h1>
      <p className="mt-3 font-sans text-sm leading-6 text-muted">
        Something went wrong while fetching the data for this page. Nothing was changed. Try again,
        and if it keeps happening, check the server logs.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-muted">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center rounded-control border border-taraWine bg-taraWine px-5 font-sans text-[13px] font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="inline-flex h-11 items-center rounded-control border border-border bg-taraWhite px-5 font-sans text-[13px] font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
