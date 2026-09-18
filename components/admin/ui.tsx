import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * TARA admin design system.
 *
 * Deliberately quieter than the storefront: restrained borders, flat surfaces,
 * consistent 44px control heights, and Manrope for everything — page titles and
 * figures included. Bodoni belongs to the storefront's editorial voice; in an
 * operations tool it made headings harder to scan than the data under them.
 * No gradients, glows or oversized radii — a data table has to stay readable at
 * a glance during a busy fulfilment shift.
 *
 * EVERY PAGE HAS THE SAME SHAPE
 * -----------------------------
 *   PageHeader        title, one-line description, and the page's actions — the
 *                     primary one always last, so it is always in the same place
 *   AdminFilterBar    search and filters, when the page lists things
 *   Panel             the content
 *   Pagination        under the list it pages
 *
 * Actions are drawn by `adminButtonClass()` / `AdminLinkButton`, never by a
 * hand-typed class string, so "the main button" looks the same on every screen.
 */

// --- Surfaces --------------------------------------------------------------

export function Panel({
  children,
  className,
  id,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  /** Set when the panel is a link or scroll target, e.g. #variants. */
  id?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "rounded-panel border border-border bg-taraWhite",
        // Anchored panels are scrolled to; without this the sticky admin header
        // covers the heading the staff member was sent to read.
        id && "scroll-mt-24",
        className,
      )}
    >
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

/** Where the page sits, and how to get back up a level. */
export interface PageBackLink {
  href: string;
  label: string;
}

export function PageHeader({
  eyebrow,
  back,
  title,
  description,
  actions,
  meta,
}: {
  /** The navigation group, e.g. "Catalogue". Ignored when `back` is given. */
  eyebrow?: ReactNode;
  /** A parent page. Replaces the eyebrow with a link back to it. */
  back?: PageBackLink;
  title: string;
  description?: string;
  /**
   * The page's actions. Put the primary action LAST: it then sits at the right
   * edge on a wide screen and at the end of the row on a phone, which is the
   * same place on every page.
   */
  actions?: ReactNode;
  /** Small badges shown beside the title — a status, a count. */
  meta?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="inline-flex items-center gap-1 font-sans text-[12px] font-semibold text-muted underline-offset-4 transition-colors hover:text-taraWine hover:underline"
          >
            <span aria-hidden="true">←</span> {back.label}
          </Link>
        ) : eyebrow ? (
          <p className="font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-wine">
            {eyebrow}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <h1 className="font-sans text-[22px] font-bold leading-tight tracking-[-0.01em] text-ink sm:text-[26px]">
            {title}
          </h1>
          {meta}
        </div>
        {description && (
          <p className="mt-1.5 max-w-2xl font-sans text-sm leading-6 text-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      )}
    </header>
  );
}

/** The same header under the name the rest of the admin kit uses. */
export const AdminPageHeader = PageHeader;

// --- Actions ---------------------------------------------------------------

export type AdminButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type AdminButtonSize = "md" | "sm";

const buttonVariants: Record<AdminButtonVariant, string> = {
  primary:
    "border border-taraWine bg-taraWine text-taraIvory hover:border-taraBlack hover:bg-taraBlack",
  secondary:
    "border border-border bg-taraWhite text-ink hover:border-taraWine hover:text-taraWine",
  ghost: "border border-transparent bg-transparent text-muted hover:text-taraWine",
  danger:
    "border border-[#8C2F2F]/40 bg-taraWhite text-[#8C2F2F] hover:border-[#8C2F2F] hover:bg-[#8C2F2F] hover:text-taraWhite",
};

const buttonSizes: Record<AdminButtonSize, string> = {
  // 44px: the minimum comfortable tap target, and the height of every input.
  md: "h-11 px-4 text-[13px]",
  sm: "h-9 px-3 text-xs",
};

/**
 * The one definition of what an admin button looks like.
 *
 * Used by <button>s, by <Link>s styled as buttons, and by the client wrappers in
 * AdminForm.tsx, so a primary action is the same wine rectangle whether it
 * submits a form, runs a server action or goes to another page.
 */
export function adminButtonClass(
  variant: AdminButtonVariant = "secondary",
  size: AdminButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-sans font-semibold uppercase tracking-wide transition-colors",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taraWine",
    "disabled:cursor-not-allowed disabled:border-border disabled:bg-taraIvory disabled:text-muted",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );
}

/** A link that looks like a button — for actions that go somewhere. */
export function AdminLinkButton({
  href,
  children,
  variant = "secondary",
  size = "md",
  className,
  external,
}: {
  href: string;
  children: ReactNode;
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  className?: string;
  /** Opens in a new tab — for the storefront. */
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      className={adminButtonClass(variant, size, className)}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {children}
    </Link>
  );
}

type LinkButtonProps = Omit<Parameters<typeof AdminLinkButton>[0], "variant">;

/** The page's main action. At most one per page header, and always last. */
export function AdminPrimaryAction(props: LinkButtonProps) {
  return <AdminLinkButton {...props} variant="primary" />;
}

/** Any other header action. */
export function AdminSecondaryAction(props: LinkButtonProps) {
  return <AdminLinkButton {...props} variant="secondary" />;
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
      <p className="font-sans text-base font-semibold text-ink">{title}</p>
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
      <strong className="mt-2 block font-sans text-[26px] font-bold leading-none tracking-[-0.01em] text-ink">
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

/**
 * Search and filters for a list.
 *
 * A plain GET form, so the URL is the whole filter state: a filtered list can
 * be bookmarked, shared with a colleague, refreshed and navigated back to, and
 * no second copy of the filters lives in a React hook. Every list page in the
 * back office filters this way.
 */
export function AdminFilterBar({
  children,
  action,
  resetHref,
  submitLabel = "Apply",
  hasActiveFilters = false,
}: {
  children: ReactNode;
  /** The page to submit to. Defaults to the current one. */
  action?: string;
  /** Where "Clear" goes. Shown only while a filter is applied. */
  resetHref?: string;
  submitLabel?: string;
  hasActiveFilters?: boolean;
}) {
  return (
    <form
      method="get"
      action={action}
      role="search"
      className="mb-4 flex flex-col gap-3 rounded-panel border border-border bg-taraWhite p-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {children}
      <div className="flex items-center gap-2">
        <button type="submit" className={adminButtonClass("primary", "md")}>
          {submitLabel}
        </button>
        {resetHref && hasActiveFilters && (
          <Link href={resetHref} className={adminButtonClass("ghost", "md")}>
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}

/** Kept for the pages that arrange their own filter form. */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-panel border border-border bg-taraWhite p-3 sm:flex-row sm:flex-wrap sm:items-end">
      {children}
    </div>
  );
}

/** The search box every list uses, labelled for screen readers. */
export function AdminSearchInput({
  name = "q",
  defaultValue,
  placeholder,
  label = "Search",
  className,
}: {
  name?: string;
  defaultValue?: string;
  placeholder: string;
  label?: string;
  className?: string;
}) {
  const id = `admin-search-${name}`;
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-[240px]", className)}>
      <label
        htmlFor={id}
        className="font-sans text-[12px] font-semibold uppercase tracking-wide text-ink"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={adminInputClass}
      />
    </div>
  );
}

/** A labelled select inside a filter bar. */
export function AdminFilterSelect({
  name,
  label,
  defaultValue,
  options,
  className,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const id = `admin-filter-${name}`;
  return (
    <div className={cn("flex flex-col gap-1.5 sm:w-48", className)}>
      <label
        htmlFor={id}
        className="font-sans text-[12px] font-semibold uppercase tracking-wide text-ink"
      >
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} className={adminSelectClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// --- Page sections ---------------------------------------------------------

/**
 * One titled section of a long form or workspace, and the target of the
 * section navigator. `id` is what `AdminSectionNav` scrolls to.
 */
export function AdminFormSection({
  id,
  title,
  description,
  step,
  actions,
  children,
  className,
  flush = false,
}: {
  id: string;
  title: string;
  description?: string;
  /** "Step 2" on the product builder. */
  step?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** No inner padding — for a section whose content is a table or a list. */
  flush?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("scroll-mt-28 rounded-panel border border-border bg-taraWhite", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          {step && (
            <p className="font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-wine">
              {step}
            </p>
          )}
          <h2
            id={`${id}-title`}
            className="font-sans text-base font-bold tracking-[-0.005em] text-ink"
          >
            {title}
          </h2>
          {description && <p className="mt-1 text-sm leading-6 text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={flush ? "" : "px-5 py-5"}>{children}</div>
    </section>
  );
}

/** A compact row of labelled facts — the summary at the top of an editor. */
export function AdminStatusSummary({
  items,
}: {
  items: { label: string; value: ReactNode; hint?: string }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-border bg-border sm:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-taraWhite px-4 py-3">
          <dt className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted">
            {item.label}
          </dt>
          <dd className="mt-1 truncate font-sans text-[15px] font-bold text-ink">{item.value}</dd>
          {item.hint && <dd className="mt-0.5 truncate text-xs text-muted">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/**
 * The bar that holds a long form's save buttons.
 *
 * Sticky to the bottom of the viewport, so "where do I save?" has the same
 * answer however far down the page somebody has scrolled. It is part of the
 * page's flow, not fixed over it, so it never covers the last field: the page
 * ends where the bar begins.
 */
export function AdminStickyActions({
  status,
  children,
  tone = "neutral",
}: {
  /** What is happening, or what state the form is in. Announced politely. */
  status?: ReactNode;
  children: ReactNode;
  tone?: "neutral" | "attention" | "danger";
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-6 border-t bg-taraWhite px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        tone === "attention" && "border-t-2 border-taraWine",
        tone === "danger" && "border-t-2 border-[#8C2F2F]",
        tone === "neutral" && "border-border",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div role="status" aria-live="polite" className="min-h-[1.25rem] min-w-0 font-sans text-sm text-muted">
          {status}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">{children}</div>
      </div>
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

/**
 * One-tap filters above a list — "Pending", "Unpaid", "Low stock".
 *
 * Links, not buttons, so each is a real URL a colleague can be sent. The active
 * one is marked with `aria-current` as well as colour.
 */
export function AdminQuickFilters({
  label,
  items,
}: {
  label: string;
  items: { label: string; href: string; active: boolean; count?: number }[];
}) {
  return (
    <nav aria-label={label} className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-2 sm:flex-wrap">
        {items.map((item) => (
          <li key={item.label} className="shrink-0">
            <Link
              href={item.href}
              aria-current={item.active ? "true" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-control border px-3 font-sans text-xs font-semibold uppercase tracking-wide transition-colors",
                item.active
                  ? "border-taraWine bg-taraWine text-taraIvory"
                  : "border-border bg-taraWhite text-ink hover:border-taraWine hover:text-taraWine",
              )}
            >
              {item.label}
              {typeof item.count === "number" && (
                <span className={item.active ? "text-taraIvory/80" : "text-muted"}>{item.count}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
