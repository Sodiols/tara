/**
 * The date range the marketing dashboard is looking at.
 *
 * DAYS ARE STORE DAYS. "Today" means today in Dhaka, not today in UTC — a shop
 * open at 1am local time is six hours into a UTC day that has not started, and
 * an owner checking the morning's orders should not be shown yesterday's.
 * Bangladesh is UTC+6 all year with no daylight saving, so a fixed offset is
 * exact here rather than an approximation.
 *
 * Pure, with an injectable clock, so tests/analytics.test.ts can pin a date.
 */

export const STORE_UTC_OFFSET_MINUTES = 6 * 60;

export const RANGE_PRESETS = ["today", "yesterday", "7d", "30d", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  custom: "Custom",
};

export interface ResolvedRange {
  preset: RangePreset;
  from: Date;
  /** Exclusive: the query is `created_at >= from and created_at < to`. */
  to: Date;
  /** The `<input type="date">` values, in store time. */
  fromInput: string;
  toInput: string;
}

/** Midnight in Dhaka, `days` before the store day that contains `now`. */
function storeMidnight(now: Date, daysBack: number): Date {
  const storeNow = new Date(now.getTime() + STORE_UTC_OFFSET_MINUTES * 60_000);
  const midnightUtc = Date.UTC(
    storeNow.getUTCFullYear(),
    storeNow.getUTCMonth(),
    storeNow.getUTCDate() - daysBack,
  );
  return new Date(midnightUtc - STORE_UTC_OFFSET_MINUTES * 60_000);
}

/** The YYYY-MM-DD of an instant, in store time. */
export function storeDateInput(value: Date): string {
  const shifted = new Date(value.getTime() + STORE_UTC_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Midnight in Dhaka at the start of a YYYY-MM-DD, or null if unparseable. */
function fromDateInput(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed - STORE_UTC_OFFSET_MINUTES * 60_000);
}

export function isRangePreset(value: unknown): value is RangePreset {
  return typeof value === "string" && (RANGE_PRESETS as readonly string[]).includes(value);
}

/**
 * Turns the URL's parameters into a real range.
 *
 * The URL is the whole filter state here, exactly as it is for the catalogue
 * listing — so a dashboard view is shareable, reload-safe and correct under the
 * back button, and no second copy of the range lives in a React hook.
 *
 * Anything unparseable falls back to the last 30 days rather than erroring: a
 * hand-edited date in an address bar is not worth a broken page.
 */
export function resolveRange(
  params: { range?: string; from?: string; to?: string },
  now: Date = new Date(),
): ResolvedRange {
  const preset: RangePreset = isRangePreset(params.range) ? params.range : "30d";

  if (preset === "custom") {
    const from = fromDateInput(params.from);
    const to = fromDateInput(params.to);
    if (from && to && to >= from) {
      // The `to` day is inclusive for the person reading it, so the query's
      // exclusive bound is the midnight after it.
      const exclusiveTo = new Date(to.getTime() + 24 * 60 * 60_000);
      return {
        preset,
        from,
        to: exclusiveTo,
        fromInput: storeDateInput(from),
        toInput: storeDateInput(to),
      };
    }
    // A half-filled custom range behaves like the default until it is complete.
  }

  const endOfToday = storeMidnight(now, -1);

  const [from, to] = (() => {
    switch (preset) {
      case "today":
        return [storeMidnight(now, 0), endOfToday];
      case "yesterday":
        return [storeMidnight(now, 1), storeMidnight(now, 0)];
      case "7d":
        return [storeMidnight(now, 6), endOfToday];
      default:
        return [storeMidnight(now, 29), endOfToday];
    }
  })();

  return {
    preset: preset === "custom" ? "30d" : preset,
    from,
    to,
    fromInput: storeDateInput(from),
    // The inclusive last day, which is the day before the exclusive bound.
    toInput: storeDateInput(new Date(to.getTime() - 24 * 60 * 60_000)),
  };
}
