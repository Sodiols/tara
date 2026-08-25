import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * TARA admin design system.
 *
 * Deliberately quieter than the storefront: restrained borders, flat surfaces,
 * consistent 44px control heights, Manrope everywhere except the few Bodoni
 * page titles. No gradients, glows or oversized radii — a data table has to
 * stay readable at a glance during a busy fulfilment shift.
 */

// --- Surfaces --------------------------------------------------------------

export function Panel({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={cn("rounded-panel border border-border bg-taraWhite", className)}>
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="font-sans text-sm font-semibold uppercase tracking-wider text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-wine">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-serif text-2xl leading-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// --- Status badges ---------------------------------------------------------
// Every badge carries its label as text. Colour is a secondary cue only, so the
// table stays usable for colour-blind staff and in a black-and-white printout.

export type BadgeTone =
  | "neutral"
  | "info"
  | "progress"
  | "success"
  | "warning"
  | "danger";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-taraTaupe/45 bg-taraTaupe/12 text-[#5C5148]",
  info: "border-taraWine/30 bg-taraWine/8 text-taraWine",
  progress: "border-taraRose/50 bg-taraRose/15 text-[#8A4457]",
  success: "border-[#2F5D50]/30 bg-[#2F5D50]/10 text-[#2F5D50]",
  warning: "border-[#8A6A1F]/30 bg-[#8A6A1F]/10 text-[#8A6A1F]",
  danger: "border-[#8C2F2F]/30 bg-[#8C2F2F]/10 text-[#8C2F2F]",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-control border px-2 py-[3px] font-sans text-[11px] font-semibold uppercase tracking-wide",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// --- Tables ----------------------------------------------------------------
// Wrapped in an overflow container so a wide table scrolls inside its own box
// and never pushes the page into horizontal overflow on a phone.

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left font-sans text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "border-b border-border/70 px-4 py-3 align-middle text-ink",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

// --- States ----------------------------------------------------------------

export function AdminEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <p className="font-serif text-lg text-ink">{title}</p>
      {description && <p className="max-w-md text-sm leading-6 text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function AdminErrorState({
  title = "Something went wrong",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-panel border border-[#8C2F2F]/25 bg-[#8C2F2F]/5 px-5 py-4"
    >
      <p className="font-sans text-sm font-semibold text-[#8C2F2F]">{title}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <span
      className={cn("block animate-pulse rounded bg-taraTaupe/25", className)}
      aria-hidden="true"
    />
  );
}

// --- Metric tiles ----------------------------------------------------------

export function StatTile({
  label,
  value,
  hint,
  href,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  tone?: BadgeTone;
}) {
  const accent: Record<BadgeTone, string> = {
    neutral: "border-l-taraTaupe",
    info: "border-l-taraWine",
    progress: "border-l-taraRose",
    success: "border-l-[#2F5D50]",
    warning: "border-l-[#8A6A1F]",
    danger: "border-l-[#8C2F2F]",
  };

  const body = (
    <>
      <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-muted">
        {label}
      </p>
      <strong className="mt-2 block font-serif text-[28px] leading-none text-ink">
        {value}
      </strong>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </>
  );

  const className = cn(
    "block rounded-panel border border-border border-l-[3px] bg-taraWhite p-4 transition-colors",
    accent[tone],
    href && "hover:border-taraWine/40 hover:bg-taraIvory/60",
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

// --- Form primitives -------------------------------------------------------

export const adminInputClass =
  "h-11 w-full rounded-control border border-border bg-taraWhite px-3 font-sans text-sm text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-taraWine disabled:bg-taraIvory disabled:text-muted";

/**
 * A native select styled to match the text inputs. Native rather than a custom
 * listbox on purpose: keyboard navigation, type-ahead and the mobile picker all
 * come for free and are hard to reimplement correctly.
 */
export const adminSelectClass =
  "h-11 w-full rounded-control border border-border bg-taraWhite px-3 font-sans text-sm text-ink outline-none transition-colors focus:border-taraWine disabled:bg-taraIvory disabled:text-muted";

export const adminTextareaClass =
  "min-h-[104px] w-full rounded-control border border-border bg-taraWhite p-3 font-sans text-sm leading-6 text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-taraWine";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="font-sans text-[12px] font-semibold uppercase tracking-wide text-ink"
      >
        {label}
        {required && (
          <span className="ml-1 text-taraWine" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-xs leading-5 text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs leading-5 text-[#8C2F2F]">
          {error}
        </p>
      )}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-panel border border-border bg-taraIvory/50 p-3">
      {children}
    </div>
  );
}

// --- Pagination ------------------------------------------------------------

export function Pagination({
  page,
  pageSize,
  total,
  buildHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  const linkClass =
    "inline-flex h-9 items-center rounded-control border border-border px-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine";
  const disabledClass =
    "inline-flex h-9 cursor-not-allowed items-center rounded-control border border-border bg-taraIvory px-3 font-sans text-xs font-semibold uppercase tracking-wide text-muted";

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3"
    >
      <p className="font-sans text-xs text-muted">
        Showing <strong className="text-ink">{first}</strong>–
        <strong className="text-ink">{last}</strong> of{" "}
        <strong className="text-ink">{total.toLocaleString("en-US")}</strong>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} className={linkClass} rel="prev">
            Previous
          </Link>
        ) : (
          <span className={disabledClass}>Previous</span>
        )}
        <span className="font-sans text-xs text-muted">
          Page {page} of {lastPage}
        </span>
        {page < lastPage ? (
          <Link href={buildHref(page + 1)} className={linkClass} rel="next">
            Next
          </Link>
        ) : (
          <span className={disabledClass}>Next</span>
        )}
      </div>
    </nav>
  );
}

// --- Definition list -------------------------------------------------------

export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-b-0">
      <dt className="font-sans text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-right font-sans text-sm text-ink">{children}</dd>
    </div>
  );
}
