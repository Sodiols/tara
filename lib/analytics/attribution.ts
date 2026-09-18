import type { AttributionInput } from "./events";

/**
 * Reading a campaign out of a link.
 *
 * Pure functions with no browser and no database, so both sides can use them
 * and `tests/analytics.test.ts` can exercise every rule without either.
 *
 * WHAT A UTM PARAMETER IS FOR
 * ---------------------------
 * Grouping a report. Nothing else. It is typed by whoever wrote the link and
 * arrives from the address bar, so it is never allowed to decide what anybody
 * can see, what anything costs, or where a request goes. It is trimmed,
 * lowercased where it is used as a key, and length-capped — and that is the
 * whole of the trust placed in it.
 */

/** The five parameters, in the order the reports read them. */
export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const MAX_VALUE_LENGTH = 120;

function clean(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, MAX_VALUE_LENGTH);
  return trimmed || undefined;
}

/**
 * The UTM parameters carried by a query string.
 *
 * Takes the search string rather than a URL so it works with
 * `window.location.search`, with `useSearchParams()` and with a plain test
 * fixture.
 */
export function utmFromSearch(search: string): AttributionInput {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    utmSource: clean(params.get("utm_source")),
    utmMedium: clean(params.get("utm_medium")),
    utmCampaign: clean(params.get("utm_campaign")),
    utmContent: clean(params.get("utm_content")),
    utmTerm: clean(params.get("utm_term")),
  };
}

/**
 * The host of a referring URL, or undefined for a referrer from this site.
 *
 * Only the host. A full referrer from a search engine carries the query the
 * person typed, and from another shop it can carry an order id — neither is
 * anything TARA needs to know to count where its visitors came from.
 */
export function referrerHost(referrer: string, currentHost?: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return undefined;
    // An internal referrer is not a traffic source; it is the previous page.
    if (currentHost && host === currentHost.toLowerCase().replace(/^www\./, "")) {
      return undefined;
    }
    return host.slice(0, 120);
  } catch {
    return undefined;
  }
}

/**
 * The normalised channel a visit came from.
 *
 * MIRRORS `public.resolve_traffic_source()` in migration 0026, which is the
 * authority — the database resolves and stores this, and this copy exists so
 * the browser and the tests can reason about the same rule. There is a test
 * asserting the two agree.
 */
export function resolveSource(
  utmSource: string | undefined,
  host: string | undefined,
): string {
  const explicit = utmSource?.trim();
  if (explicit) return explicit.toLowerCase().slice(0, 40);
  if (!host) return "direct";

  if (host.includes("instagram")) return "instagram";
  if (host.includes("facebook") || host.startsWith("fb.") || host.includes("messenger")) {
    return "facebook";
  }
  if (host.includes("tiktok")) return "tiktok";
  if (host.includes("google")) return "google";
  if (host.includes("youtube")) return "youtube";
  if (host.includes("whatsapp")) return "whatsapp";
  if (host.includes("bing") || host.includes("duckduckgo") || host.includes("yahoo")) {
    return "search";
  }
  return host.toLowerCase().slice(0, 40);
}

/** True when a visit carries no campaign information of any kind. */
export function isDirect(attribution: AttributionInput): boolean {
  return resolveSource(attribution.utmSource, attribution.referrerHost) === "direct";
}

/**
 * The creator a link credits.
 *
 * Two conventions, both documented in docs/MARKETING.md and both readable by a
 * human looking at the link:
 *
 *   utm_source=creator&utm_campaign=nabila     → "nabila"
 *   utm_content=creator_nabila_tryon_01        → "nabila"
 *
 * MIRRORS the same expression in `admin_marketing_analytics()`.
 */
export function creatorFrom(attribution: {
  utmSource?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
}): string | undefined {
  if (attribution.utmSource?.trim().toLowerCase() === "creator") {
    return attribution.utmCampaign?.trim() || undefined;
  }
  const content = attribution.utmContent?.trim();
  if (content && /^creator[_-]/i.test(content)) {
    return content.split("_")[1] || undefined;
  }
  return undefined;
}

/**
 * Builds a tracked link.
 *
 * Used by the link builder in /admin/marketing so the team generates links that
 * the dashboard can actually group, rather than typing five parameters by hand
 * and misspelling one of them on the third post.
 */
export function buildTrackedUrl(
  baseUrl: string,
  parameters: {
    source: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  },
): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return "";
  }

  const assign = (key: (typeof UTM_KEYS)[number], value: string | undefined) => {
    const normalised = value?.trim().toLowerCase().replace(/\s+/g, "_").slice(0, MAX_VALUE_LENGTH);
    if (normalised) url.searchParams.set(key, normalised);
    else url.searchParams.delete(key);
  };

  assign("utm_source", parameters.source);
  assign("utm_medium", parameters.medium);
  assign("utm_campaign", parameters.campaign);
  assign("utm_content", parameters.content);
  assign("utm_term", parameters.term);

  return url.toString();
}
