import Link from "next/link";
import { AlertTriangle, Check, Info } from "lucide-react";
import type { TrustReport } from "@/lib/product-trust";
import { Panel, PanelHeader } from "./ui";

/**
 * How finished this listing is.
 *
 * A checklist, not a gate. Nothing here prevents saving, nothing here prevents
 * publishing, and a draft that fails every check is a perfectly normal draft —
 * see the note at the top of lib/product-trust.ts. What it does is answer, in
 * one glance, the question a shop owner otherwise has to answer by opening the
 * live page: is there anything here a customer needs that we have not written?
 *
 * Failures come first, because the passes are not the part anybody has to act
 * on, and each failure says what to do rather than only what is wrong.
 */
export function ProductTrustPanel({ report }: { report: TrustReport }) {
  const failures = report.checks.filter((check) => !check.ok);
  const passes = report.checks.filter((check) => check.ok);

  const tone =
    report.missingRequired > 0
      ? "text-[#8C2F2F]"
      : failures.length > 0
        ? "text-ink"
        : "text-[#1F6F4A]";

  return (
    <Panel>
      <PanelHeader
        title="Listing completeness"
        description="What a customer needs before they will order clothing they cannot touch. Nothing here blocks saving or publishing."
        actions={
          <span className={`font-sans text-sm font-semibold ${tone}`}>
            {report.score}% · {passes.length}/{report.checks.length}
          </span>
        }
      />

      <div className="flex flex-col gap-4 px-5 py-5">
        {report.missingRequired > 0 && (
          <p className="flex items-start gap-2 rounded-control border border-[#8C2F2F]/30 bg-[#8C2F2F]/5 px-3 py-2 font-sans text-xs text-ink">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#8C2F2F]" aria-hidden="true" />
            <span>
              {report.missingRequired} important{" "}
              {report.missingRequired === 1 ? "thing is" : "things are"} missing. The product page
              will render without {report.missingRequired === 1 ? "it" : "them"}, and it will sell
              less.
            </span>
          </p>
        )}

        {failures.length === 0 ? (
          <p className="flex items-start gap-2 font-sans text-sm text-ink">
            <Check size={16} className="mt-0.5 shrink-0 text-[#1F6F4A]" aria-hidden="true" />
            Everything a customer needs is here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {failures.map((check) => (
              <li key={check.id} className="flex items-start gap-2.5">
                {check.severity === "required" ? (
                  <AlertTriangle
                    size={15}
                    className="mt-0.5 shrink-0 text-[#8C2F2F]"
                    aria-hidden="true"
                  />
                ) : (
                  <Info size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
                )}
                <p className="font-sans text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-ink">{check.label}</span>
                  {check.severity === "recommended" && (
                    <span className="text-muted"> (optional)</span>
                  )}
                  {" — "}
                  {check.hint}
                  {(check.id === "delivery-information" || check.id === "exchange-information") && (
                    <>
                      {" "}
                      <Link
                        href="/admin/settings"
                        className="underline underline-offset-2 hover:text-taraWine"
                      >
                        Open store settings
                      </Link>
                      .
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}

        {passes.length > 0 && (
          <details className="border-t border-border pt-3">
            <summary className="cursor-pointer font-sans text-xs font-semibold uppercase tracking-wide text-muted">
              {passes.length} already done
            </summary>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {passes.map((check) => (
                <li
                  key={check.id}
                  className="flex items-center gap-1.5 font-sans text-xs text-muted"
                >
                  <Check size={13} className="shrink-0 text-[#1F6F4A]" aria-hidden="true" />
                  {check.label}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Panel>
  );
}
