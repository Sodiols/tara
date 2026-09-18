"use client";

import { AlertCircle, Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuilderSection, ReadinessItem } from "@/lib/product-builder";

/**
 * Review and publish — step 6 of the builder.
 *
 * Every line is a link to the place that fixes it: a required item that is
 * missing takes the administrator to its field (focused), not to a paragraph
 * describing where the field might be.
 *
 * Three states, each with its own icon and its own words, so none of them is
 * communicated by colour alone:
 *   done         ✓   nothing to do
 *   required     !   publishing is refused until it is done
 *   recommended  ○   worth doing, never blocks
 */
export function ReadinessChecklist({
  items,
  attempted,
  onJump,
}: {
  items: ReadinessItem[];
  /** True after a publish was refused, so the missing items are emphasised. */
  attempted: boolean;
  onJump: (section: BuilderSection, fieldId?: string) => void;
}) {
  const blocking = items.filter((item) => item.required && !item.ok);
  const done = items.filter((item) => item.ok).length;

  return (
    <div className="flex flex-col gap-4">
      <p
        className={cn(
          "rounded-control border px-4 py-3 font-sans text-sm",
          blocking.length === 0
            ? "border-[#2F5D50]/30 bg-[#2F5D50]/5 text-[#2F5D50]"
            : attempted
              ? "border-[#8C2F2F]/30 bg-[#8C2F2F]/5 text-[#8C2F2F]"
              : "border-border bg-taraIvory/60 text-ink",
        )}
        role={attempted && blocking.length > 0 ? "alert" : undefined}
      >
        {blocking.length === 0
          ? "Ready to publish. Everything a customer needs is here."
          : `${blocking.length} required item${blocking.length === 1 ? "" : "s"} before this can be published. It can be saved as a draft at any time.`}
        <span className="ml-1 text-muted">
          ({done} of {items.length} done)
        </span>
      </p>

      <ul className="grid gap-1 sm:grid-cols-2">
        {items.map((item) => {
          const state = item.ok ? "done" : item.required ? "required" : "recommended";
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onJump(item.section, item.fieldId)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-control px-2 py-2 text-left transition-colors hover:bg-taraIvory",
                  state === "required" && attempted && "bg-[#8C2F2F]/5",
                )}
              >
                <span aria-hidden="true" className="mt-0.5 shrink-0">
                  {state === "done" ? (
                    <Check size={16} className="text-[#2F5D50]" />
                  ) : state === "required" ? (
                    <AlertCircle size={16} className="text-[#8C2F2F]" />
                  ) : (
                    <Circle size={16} className="text-muted" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block font-sans text-sm font-semibold text-ink">
                    {item.label}
                    <span className="sr-only">
                      {state === "done"
                        ? " — done"
                        : state === "required"
                          ? " — required, not done"
                          : " — optional, not done"}
                    </span>
                    {state === "recommended" && (
                      <span className="ml-1.5 font-normal text-muted">(optional)</span>
                    )}
                  </span>
                  {!item.ok && (
                    <span className="block font-sans text-xs leading-5 text-muted">{item.hint}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
