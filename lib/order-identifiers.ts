/**
 * The two public order identifiers, and the rules for recognising them.
 *
 * An order has THREE identities, and they are not interchangeable:
 *
 *   id              uuid. Internal primary key. Foreign keys and admin routes
 *                   use it; no customer ever sees it.
 *   order_number    TARA-YY-MM-XXXXXXXXXX. The human reference: confirmation,
 *                   account history, admin, invoice, packing slip, receipt,
 *                   emails and support calls.
 *   tracking_token  TRK-XXXXXXXXXXXXXXXXXXXX. An opaque bearer secret. Its only
 *                   job is the public page at /track/<token>.
 *
 * Both public values are generated in PostgreSQL, inside place_order()'s
 * transaction (supabase/migrations/0027_secure_order_identifiers.sql), from
 * the CSPRNG behind gen_random_uuid(). Nothing in this file generates one: the
 * application only ever recognises, normalises and displays them. That is what
 * makes "the browser cannot choose its own order number" true by construction
 * rather than by validation.
 *
 * The patterns below mirror the SQL predicates `is_valid_order_number`,
 * `is_valid_tracking_token` and `is_current_tracking_token` in that migration.
 * The database is the authority; these exist so a malformed value is refused
 * before it costs a round trip or a rate-limit slot.
 */

/**
 * 32 symbols: A–Z without I and O, 2–9 without 0 and 1. Nothing that reads
 * as something else over the phone, and exactly 5 bits per character, so the
 * SQL generator maps a random byte onto it with `& 31` and no modulo bias.
 */
export const IDENTIFIER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const ORDER_NUMBER_RANDOM_LENGTH = 10;
export const TRACKING_TOKEN_RANDOM_LENGTH = 20;

const SYMBOL = "[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]";

/** Every order placed from migration 0027 on. */
export const ORDER_NUMBER_PATTERN = new RegExp(
  `^TARA-\\d{2}-(0[1-9]|1[0-2])-${SYMBOL}{${ORDER_NUMBER_RANDOM_LENGTH}}$`,
);

/**
 * Orders placed before 0027: TARA-YYYYMMDD-NNNNNN from a sequence. They keep
 * their numbers -- the numbers are already printed on invoices and sitting in
 * customers' inboxes, and an order number is immutable.
 */
export const LEGACY_ORDER_NUMBER_PATTERN = /^TARA-\d{8}-\d{6,}$/;

/** Every token issued from migration 0027 on. */
export const TRACKING_TOKEN_PATTERN = new RegExp(`^TRK-${SYMBOL}{${TRACKING_TOKEN_RANDOM_LENGTH}}$`);

/**
 * Tokens issued before 0027: 48 lowercase hex characters taken from two v4
 * UUIDs (~180 random bits). Still secure, still in customers' emails, so still
 * honoured -- they simply were never in the new shape.
 */
export const LEGACY_TRACKING_TOKEN_PATTERN = /^[0-9a-f]{48}$/;

/** Longest value either kind of token can be. Anything longer is refused unread. */
export const MAX_TRACKING_TOKEN_LENGTH = 48;

declare const orderNumberBrand: unique symbol;
declare const trackingTokenBrand: unique symbol;

/** A customer-facing order reference. Not an id, not a token. */
export type OrderNumber = string & { readonly [orderNumberBrand]: true };

/** The public tracking secret. Not an id, not an order number. */
export type TrackingToken = string & { readonly [trackingTokenBrand]: true };

export function isOrderNumber(value: string): value is OrderNumber {
  return ORDER_NUMBER_PATTERN.test(value) || LEGACY_ORDER_NUMBER_PATTERN.test(value);
}

export function isTrackingToken(value: string): value is TrackingToken {
  return TRACKING_TOKEN_PATTERN.test(value) || LEGACY_TRACKING_TOKEN_PATTERN.test(value);
}

/**
 * Turns whatever a person pasted -- a bare token, a token in the wrong case,
 * or the whole tracking link from their email -- into a token, or null.
 *
 * Exact-match only once normalised: no prefix search, no fuzzy match, no
 * partial token. A value that does not match one of the two shapes never
 * reaches the database.
 */
export function normaliseTrackingToken(input: unknown): TrackingToken | null {
  if (typeof input !== "string") return null;
  let value = input.trim();
  // A pasted link: keep the last path segment. Bounded before parsing so a
  // megabyte of input is not handed to the URL parser.
  if (value.length > 300) return null;
  const fromPath = /\/track\/([^/?#\s]+)\/?(?:[?#].*)?$/i.exec(value);
  if (fromPath) value = fromPath[1];
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  value = value.trim();
  if (value.length === 0 || value.length > MAX_TRACKING_TOKEN_LENGTH) return null;

  if (/^trk-/i.test(value)) {
    const upper = value.toUpperCase();
    return TRACKING_TOKEN_PATTERN.test(upper) ? (upper as TrackingToken) : null;
  }
  const lower = value.toLowerCase();
  return LEGACY_TRACKING_TOKEN_PATTERN.test(lower) ? (lower as TrackingToken) : null;
}

/** Recognises an order number typed with stray spaces or in lower case. */
export function normaliseOrderNumber(input: unknown): OrderNumber | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toUpperCase();
  if (value.length > 40) return null;
  return isOrderNumber(value) ? value : null;
}

/** The public tracking page for a token -- the only public route keyed on an order. */
export function trackingPath(token: TrackingToken): string {
  return `/track/${encodeURIComponent(token)}`;
}

export function trackingUrl(origin: string, token: TrackingToken): string {
  return `${origin.replace(/\/+$/, "")}${trackingPath(token)}`;
}

/**
 * The tracking page's URL is a secret. Anything that records a path -- TARA's
 * own analytics, GA4, the Meta pixel -- sees this instead of the token.
 */
export const REDACTED_TRACKING_PATH = "/track/[token]";

export function isTrackingPagePath(path: string): boolean {
  return /^\/track\/[^/]+/.test(path);
}

export function redactTrackingPath(path: string): string {
  return isTrackingPagePath(path) ? REDACTED_TRACKING_PATH : path;
}
