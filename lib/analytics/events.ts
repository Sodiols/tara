import type { AnalyticsEventName } from "@/types/database";

/**
 * The shape of one first-party analytics event, shared by the browser that
 * records it and the route handler that validates it.
 *
 * Deliberately small and deliberately dull. Everything here is either an
 * identifier this shop minted, something the customer chose from the page, or a
 * price the page was already showing. Nothing identifies a person: no IP, no
 * user agent, no device fingerprint, no email, no phone number, no address.
 *
 * `purchase` is absent from what a browser may send. A conversion is recorded
 * by `recordPurchaseAction()`, which presents the order number AND that order's
 * tracking token and lets the database look up what the order was worth — so
 * nothing about revenue is ever taken from a browser.
 */
export type TrackableEventName = Exclude<AnalyticsEventName, "purchase">;

export interface AnalyticsEventInput {
  name: TrackableEventName;
  /** The route the event happened on. */
  path?: string;
  productId?: string;
  variantId?: string;
  colour?: string;
  size?: string;
  quantity?: number;
  /** Line or cart value in taka. Never an order total — see above. */
  value?: number;
  /**
   * The few extras that do not deserve a column: a search term, a checkout
   * step, which gallery image was opened. Capped server-side.
   */
  meta?: Record<string, string | number | boolean>;
}

/** What one link carried, and where the visitor landed. */
export interface AttributionInput {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  /**
   * The referrer's HOST only. The full URL is never sent: on a search engine it
   * carries what somebody typed, which is not this shop's business.
   */
  referrerHost?: string;
  landingPath?: string;
}

export interface AnalyticsBatch {
  visitorId: string;
  sessionId: string;
  attribution: AttributionInput;
  events: AnalyticsEventInput[];
}

/** How many events one request may carry. The database caps it again at 25. */
export const MAX_EVENTS_PER_BATCH = 20;

/**
 * A session ends after this much inactivity, so an afternoon and an evening
 * visit are two sessions rather than one very long one. Thirty minutes is the
 * convention every analytics product uses, which makes the numbers comparable
 * with GA4's.
 */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

/** Where the tracker posts. One endpoint, one shape. */
export const ANALYTICS_ENDPOINT = "/api/analytics/collect";
