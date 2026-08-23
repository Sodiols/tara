/**
 * Money, date and number formatting for a Bangladeshi storefront.
 *
 * Money is handled in poisha (integer 1/100 of a Taka) wherever arithmetic is
 * involved. Values arriving from Postgres `numeric(12,2)` come across the wire
 * as strings or numbers; `toPoisha` is the single place that conversion
 * happens, so no other module has to think about float drift.
 */

export const TAKA = "৳";
export const STORE_TIME_ZONE = "Asia/Dhaka";

/** Converts a Taka amount (number or numeric-as-string) to integer poisha. */
export function toPoisha(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

export function fromPoisha(poisha: number): number {
  return poisha / 100;
}

/** Adds Taka amounts without accumulating binary floating point error. */
export function sumTaka(...values: (number | string | null | undefined)[]): number {
  return fromPoisha(values.reduce<number>((total, value) => total + toPoisha(value), 0));
}

export function multiplyTaka(unit: number | string, quantity: number): number {
  return fromPoisha(toPoisha(unit) * Math.round(quantity));
}

/**
 * Formats an amount as Taka. Whole amounts render without decimals (the store
 * prices in whole Taka); fractional amounts keep two places so a discount or a
 * partial refund is never silently rounded away on screen.
 */
export function formatTaka(
  value: number | string | null | undefined,
  options: { withDecimals?: boolean } = {},
): string {
  const poisha = toPoisha(value);
  const showDecimals = options.withDecimals ?? poisha % 100 !== 0;
  const amount = fromPoisha(poisha);
  return `${TAKA}${amount.toLocaleString("en-US", {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  })}`;
}

/** Compact form for dashboard tiles: ৳1.2L, ৳45.6k. */
export function formatTakaCompact(value: number | string | null | undefined): string {
  const amount = fromPoisha(toPoisha(value));
  const abs = Math.abs(amount);
  if (abs >= 10_000_000) return `${TAKA}${(amount / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `${TAKA}${(amount / 100_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${TAKA}${(amount / 1_000).toFixed(1)}k`;
  return formatTaka(amount);
}

export function formatNumber(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("en-US");
}

export function formatPercent(value: number | string | null | undefined): string {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return `${Number.isFinite(numeric) ? numeric.toFixed(1) : "0.0"}%`;
}

// --- Dates ----------------------------------------------------------------
// Postgres stores timestamptz in UTC. Everything the store operates on —
// "today's orders", a printed invoice date, a fulfilment timestamp — must be
// read in Bangladesh Standard Time, so every formatter below pins the zone
// rather than using the viewer's locale.

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: STORE_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: STORE_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Start of today in Bangladesh, as an ISO instant usable in a query filter. */
export function startOfStoreDay(reference = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(reference);
  // BST is a fixed UTC+06:00 with no daylight saving, so the offset is safe to
  // pin rather than compute.
  return new Date(`${parts}T00:00:00+06:00`).toISOString();
}

/** `YYYY-MM-DD` in Bangladesh time — for <input type="date"> defaults. */
export function storeDateInputValue(value: string | Date | null | undefined): string {
  const date = toDate(value) ?? new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Converts a datetime-local form value to an ISO instant in store time. */
export function storeLocalToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}+06:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Converts an ISO instant to the `datetime-local` value for store time. */
export function isoToStoreLocal(value: string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
