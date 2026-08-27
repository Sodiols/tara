"use client";

import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

/**
 * The landing message after a product is created.
 *
 * Its job is to answer the question the administrator is about to ask — did my
 * images actually save? — and then point at the one thing still missing. The
 * variants panel is scrolled into view rather than merely being further down
 * the page, because "add the variants" is advice and moving the page there is
 * the instruction.
 *
 * The scroll respects a reduced-motion preference, and is skipped entirely for
 * a product that already has variants (a refresh of this URL), where jumping
 * the page would be disorienting rather than helpful.
 */
export function ProductCreatedBanner({
  imageCount,
  variantCount,
}: {
  imageCount: number;
  variantCount: number;
}) {
  useEffect(() => {
    if (variantCount > 0) return;
    const target = document.getElementById("variants");
    if (!target) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [variantCount]);

  return (
    <div
      role="status"
      className="mb-5 flex flex-wrap items-start gap-3 rounded-panel border border-[#2F5D50]/30 bg-[#2F5D50]/8 px-5 py-4"
    >
      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#2F5D50]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-sans text-sm font-semibold text-[#2F5D50]">
          Product created successfully.
        </p>
        <p className="mt-1 text-sm leading-6 text-muted">
          {imageCount > 0
            ? `Your ${imageCount} image${imageCount === 1 ? " is" : "s are"} already uploaded. Now add the product variants — the sizes and colours customers choose from.`
            : "Now add the product variants — the sizes and colours customers choose from."}
        </p>
      </div>
    </div>
  );
}
