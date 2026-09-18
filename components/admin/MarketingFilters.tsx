"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RANGE_LABELS, RANGE_PRESETS, type ResolvedRange } from "@/lib/analytics/range";
import { adminInputClass, adminSelectClass } from "./ui";

/**
 * The dashboard's filters.
 *
 * THE URL IS THE WHOLE STATE. Every control writes to the query string and the
 * page re-renders from a fresh database query — the same rule the catalogue
 * listing follows, and for the same reasons: a filtered view can be shared with
 * whoever asked the question, a refresh shows the same thing, and the back
 * button works.
 *
 * The dropdown options are the values that actually occur in the window, sent
 * back by the same query that produced the numbers, so it is impossible to
 * filter on a campaign that has never existed and get an empty page with no
 * explanation.
 */
export function MarketingFilters({
  range,
  available,
  active,
  products,
}: {
  range: ResolvedRange;
  available: { sources: string[]; campaigns: string[]; content: string[] };
  active: { source?: string; campaign?: string; content?: string; creator?: string; productId?: string };
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const withParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    return `${pathname}?${params.toString()}`;
  };

  const go = (key: string, value: string | null) => router.push(withParam(key, value));

  const hasFilter = Boolean(
    active.source || active.campaign || active.content || active.creator || active.productId,
  );

  return (
    <div className="mb-5 flex flex-col gap-3">
      <nav aria-label="Date range" className="flex flex-wrap gap-2">
        {RANGE_PRESETS.filter((preset) => preset !== "custom").map((preset) => {
          const isActive = range.preset === preset;
          return (
            <Link
              key={preset}
              href={withParam("range", preset)}
              aria-current={isActive ? "true" : undefined}
              className={
                isActive
                  ? "inline-flex h-9 items-center rounded-control border border-taraWine bg-taraWine px-3 font-sans text-xs font-semibold uppercase tracking-wide text-taraIvory"
                  : "inline-flex h-9 items-center rounded-control border border-border bg-taraWhite px-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
              }
            >
              {RANGE_LABELS[preset]}
            </Link>
          );
        })}

        {/* A custom range is two dates; submitting either one applies it. */}
        <form method="get" action={pathname} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="range" value="custom" />
          {active.source && <input type="hidden" name="source" value={active.source} />}
          {active.campaign && <input type="hidden" name="campaign" value={active.campaign} />}
          {active.content && <input type="hidden" name="content" value={active.content} />}
          {active.creator && <input type="hidden" name="creator" value={active.creator} />}
          {active.productId && <input type="hidden" name="product" value={active.productId} />}
          <label className="sr-only" htmlFor="marketing-from">
            From
          </label>
          <input
            id="marketing-from"
            type="date"
            name="from"
            defaultValue={range.fromInput}
            className={`${adminInputClass} h-9 w-auto text-xs`}
          />
          <span className="font-sans text-xs text-muted">to</span>
          <label className="sr-only" htmlFor="marketing-to">
            To
          </label>
          <input
            id="marketing-to"
            type="date"
            name="to"
            defaultValue={range.toInput}
            className={`${adminInputClass} h-9 w-auto text-xs`}
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-control border border-border bg-taraWhite px-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
          >
            Apply
          </button>
        </form>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Source"
          value={active.source ?? ""}
          options={available.sources}
          onChange={(value) => go("source", value || null)}
        />
        <FilterSelect
          label="Campaign"
          value={active.campaign ?? ""}
          options={available.campaigns}
          onChange={(value) => go("campaign", value || null)}
        />
        <FilterSelect
          label="Content"
          value={active.content ?? ""}
          options={available.content}
          onChange={(value) => go("content", value || null)}
        />
        <label className="flex items-center gap-1.5">
          <span className="font-sans text-xs uppercase tracking-wide text-muted">Product</span>
          <select
            value={active.productId ?? ""}
            onChange={(event) => go("product", event.target.value || null)}
            className={`${adminSelectClass} h-9 w-auto max-w-[14rem] text-xs`}
          >
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>

        {hasFilter && (
          <Link
            href={`${pathname}?range=${range.preset}`}
            className="font-sans text-xs text-muted underline underline-offset-4 hover:text-taraWine"
          >
            Clear filters
          </Link>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="font-sans text-xs uppercase tracking-wide text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${adminSelectClass} h-9 w-auto max-w-[12rem] text-xs`}
      >
        <option value="">All</option>
        {/* The value being filtered on is kept in the list even if the window
            no longer contains it, so the control cannot show "All" while a
            filter is applied. */}
        {[...new Set([...(value ? [value] : []), ...options])].sort().map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
