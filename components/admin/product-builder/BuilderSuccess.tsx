"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, EyeOff } from "lucide-react";
import { AdminLinkButton, Panel, adminButtonClass } from "../ui";

/**
 * Where the builder ends.
 *
 * Not in another half-finished setup screen: the product is done, and the four
 * things somebody might do next are offered as equals. A draft says plainly
 * that customers cannot see it yet, because "saved" alone reads as "live".
 */
export function BuilderSuccess({
  productId,
  slug,
  name,
  published,
  variantCount,
  imageCount,
  notes,
  onAddAnother,
}: {
  productId: string;
  slug: string;
  name: string;
  published: boolean;
  variantCount: number;
  imageCount: number;
  /** Anything that finished with a caveat — a skipped image, say. */
  notes: string[];
  onAddAnother: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The form this replaced had focus; moving it here tells a screen reader user
  // that the operation finished and what happened.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <Panel className="mx-auto max-w-2xl">
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        {published ? (
          <CheckCircle2 size={36} className="text-[#2F5D50]" aria-hidden="true" />
        ) : (
          <EyeOff size={36} className="text-muted" aria-hidden="true" />
        )}
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-sans text-xl font-bold text-ink outline-none"
        >
          {published ? `${name} is live` : `${name} is saved as a draft`}
        </h2>
        <p className="max-w-md font-sans text-sm leading-6 text-muted">
          {published
            ? `Customers can see and buy it now — ${variantCount} variant${variantCount === 1 ? "" : "s"}, ${imageCount} photograph${imageCount === 1 ? "" : "s"}.`
            : "It is not visible to customers. Open it in the editor to finish it and publish it when it is ready."}
        </p>
        {notes.length > 0 && (
          <ul className="flex max-w-md flex-col gap-1 rounded-control border border-[#8A6A1F]/30 bg-[#8A6A1F]/5 px-4 py-3 text-left font-sans text-xs leading-5 text-[#6B521A]">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
          {published && (
            <AdminLinkButton href={`/product/${slug}`} external>
              View product
            </AdminLinkButton>
          )}
          <AdminLinkButton href={`/admin/products/${productId}`}>Edit product</AdminLinkButton>
          <AdminLinkButton href="/admin/products">Back to products</AdminLinkButton>
          <button type="button" onClick={onAddAnother} className={adminButtonClass("primary", "md")}>
            Add another product
          </button>
        </div>
      </div>
    </Panel>
  );
}
