"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Storefront error boundary.
 *
 * Customers get a calm sentence and two ways forward. The underlying error —
 * which can carry a Supabase message naming tables, columns or constraints —
 * goes to the server log only. `digest` is Next.js's own correlation id, safe
 * to show and useful when someone reports a problem.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[storefront] unhandled error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center sm:py-32">
      <p className="mb-4 font-serif text-6xl text-wine">Oh dear</p>
      <h1 className="mb-3 font-serif text-3xl text-ink">Something went wrong</h1>
      <p className="mb-8 text-sm leading-6 text-muted">
        We could not load this page just now. Nothing you were doing has been lost — your bag and
        any order you have already placed are safe.
      </p>
      {error.digest && (
        <p className="mb-8 font-mono text-xs text-muted">Reference: {error.digest}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-12 items-center rounded-control border border-wine bg-wine px-7 font-sans text-[13px] font-semibold uppercase tracking-wider text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-12 items-center rounded-control border border-border px-7 font-sans text-[13px] font-semibold uppercase tracking-wider text-ink transition-colors hover:border-wine hover:text-wine"
        >
          Back to home
        </Link>
      </div>
      <p className="mt-10 text-xs text-muted">
        Still stuck?{" "}
        <Link href="/contact" className="text-wine underline-offset-4 hover:underline">
          Contact us
        </Link>
      </p>
    </div>
  );
}
