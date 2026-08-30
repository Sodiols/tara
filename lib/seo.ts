import type { Metadata } from "next";
import { siteConfig } from "@/data/site";

/**
 * The one place page metadata is assembled.
 *
 * Before this existed, every route hand-wrote its own `alternates.canonical`
 * and most wrote no Open Graph block at all — so they silently inherited the
 * root layout's, and a dozen different pages told Facebook they were the
 * homepage. Others defined no canonical, and the root layout's
 * `alternates.canonical: siteConfig.url` became theirs, telling Google that
 * /about, /size-guide and /privacy-policy were all duplicates of the homepage.
 *
 * `buildMetadata` makes the correct thing the easy thing: give it a path and it
 * produces a self-canonical, a matching og:url, and Open Graph and Twitter
 * blocks that describe THAT page. A route that forgets to call it is visible in
 * review; a route that forgets one of six fields was not.
 *
 * Structured data is serialised through lib/json-ld.ts. There is no second
 * serialiser here — the escaping in that module is a security control, not a
 * formatting preference.
 */

/** The canonical production origin. Never http, never the bare apex. */
export const SITE_URL = siteConfig.url;

/**
 * Stable @id values, so the entities can reference each other instead of being
 * re-declared on every page. A crawler that sees the same @id twice understands
 * one thing described twice; two anonymous nodes are two things.
 */
export const SCHEMA_IDS = {
  website: `${SITE_URL}/#website`,
  organization: `${SITE_URL}/#organization`,
  store: `${SITE_URL}/#store`,
} as const;

/** Absolute URL for a site-relative path. Idempotent for absolute input. */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return suffix === "/" ? `${SITE_URL}/` : `${SITE_URL}${suffix}`;
}

/**
 * Trims a description to something a search engine will actually show.
 *
 * Cuts on a word boundary rather than mid-word, and only appends an ellipsis
 * when something was genuinely removed. Collapses whitespace first, because
 * descriptions sourced from a textarea arrive with newlines in them and a
 * meta description containing a line break is silently re-wrapped by crawlers.
 */
export function metaDescription(
  value: string | null | undefined,
  fallback: string,
  maxLength = 155,
): string {
  const cleaned = (value ?? "").replace(/\s+/g, " ").trim();
  const text = cleaned.length > 0 ? cleaned : fallback.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;

  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

/**
 * The robots directive for a page that must never be indexed.
 *
 * `follow` is kept on deliberately: a filtered category page should not be
 * indexed, but the product links on it are still worth crawling. `nofollow`
 * would waste the discovery.
 */
export const NOINDEX_FOLLOW = {
  index: false,
  follow: true,
  googleBot: { index: false, follow: true },
} as const;

/** For pages that should neither be indexed nor crawled onward from. */
export const NOINDEX_NOFOLLOW = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
} as const;

export interface PageSeoInput {
  /** Page title WITHOUT the brand — the root template appends "| TARA". */
  title: string;
  description: string;
  /** Site-relative path. This becomes both the canonical and og:url. */
  path: string;
  /** Absolute or site-relative image URLs. The first is used for Twitter. */
  images?: string[];
  /** Defaults to "website"; product pages pass their own. */
  type?: "website" | "article";
  robots?: typeof NOINDEX_FOLLOW | typeof NOINDEX_NOFOLLOW;
  /**
   * Set when the title already contains the brand and must not have "| TARA"
   * appended — a staff-written SEO title that says "TARA" itself, for example.
   */
  absoluteTitle?: boolean;
}

/**
 * Full metadata for one page: canonical, Open Graph and Twitter, all pointing
 * at this page rather than inheriting the homepage's.
 */
export function buildMetadata({
  title,
  description,
  path,
  images,
  type = "website",
  robots,
  absoluteTitle = false,
}: PageSeoInput): Metadata {
  const url = absoluteUrl(path);
  const resolved = (images ?? []).map((image) => absoluteUrl(image)).filter(Boolean);
  // Open Graph carries the brand even when the tab title does not: a shared
  // link has no site chrome around it to say whose page this is.
  const socialTitle = absoluteTitle ? title : `${title} | ${siteConfig.name}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    ...(robots ? { robots } : {}),
    openGraph: {
      title: socialTitle,
      description,
      url,
      siteName: siteConfig.name,
      locale: "en_US",
      type,
      ...(resolved.length > 0 ? { images: resolved } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      ...(resolved.length > 0 ? { images: [resolved[0]] } : {}),
    },
  };
}

// --- Structured data -------------------------------------------------------

export interface BreadcrumbCrumb {
  name: string;
  /** Site-relative path, or absolute. Omit for the final (current) crumb. */
  path?: string;
}

/**
 * BreadcrumbList for a visible trail.
 *
 * The trail passed in must match what the customer can actually see on the
 * page. A breadcrumb in structured data that does not exist in the interface is
 * a mismatch Search Console reports, and a crumb pointing at a route that does
 * not exist is worse — which is why callers filter out categories that have no
 * page of their own rather than linking to a 404.
 */
export function breadcrumbSchema(trail: readonly BreadcrumbCrumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      ...(crumb.path ? { item: absoluteUrl(crumb.path) } : {}),
    })),
  };
}

/**
 * The site as an entity, with the names people actually search for.
 *
 * `alternateName` is how a crawler learns that "TARA Bangladesh" and
 * "tarabd.co" refer to the same thing as "TARA" — a genuinely useful signal for
 * a short brand name that collides with a common word.
 *
 * No SearchAction is declared: Google retired the sitelinks search box, and
 * publishing a potentialAction for a feature that no longer renders is noise.
 */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SCHEMA_IDS.website,
    name: siteConfig.name,
    alternateName: ["TARA Bangladesh", siteConfig.domain],
    url: absoluteUrl("/"),
    publisher: { "@id": SCHEMA_IDS.organization },
    inLanguage: "en",
  };
}

/**
 * Splits the stored one-line address into a structured PostalAddress.
 *
 * Only the parts that can be read with confidence are emitted. Postal code and
 * coordinates are never guessed: an invented postcode is worse than an absent
 * one, because it is a fact a crawler will believe.
 */
export function postalAddress(storeAddress: string | null | undefined) {
  const parts = (storeAddress ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;

  // "Batortal Bazar, Zakiganj, Sylhet, Bangladesh" -> street, locality, region.
  const withoutCountry = parts.filter((part) => !/^bangladesh$/i.test(part));
  const [street, locality, region] = withoutCountry;

  return {
    "@type": "PostalAddress",
    ...(street ? { streetAddress: street } : {}),
    ...(locality ? { addressLocality: locality } : {}),
    ...(region ? { addressRegion: region } : {}),
    addressCountry: "BD",
  };
}

// --- Catalogue listing metadata --------------------------------------------

/**
 * The URL parameters that turn a category page into a filtered view of itself.
 *
 * Kept in step with `paramsFromProductFilters` in lib/catalogue-filters.ts,
 * which is what writes them. Tracking parameters (utm_*, fbclid, gclid) are
 * deliberately NOT in this list: they must never make a page noindex, because
 * a customer arriving from an ad campaign lands on the same page everyone else
 * does. The canonical alone is what stops them being indexed separately.
 */
const CATALOGUE_FILTER_PARAMS = [
  "q",
  "price",
  "size",
  "colour",
  "fabric",
  "collection",
  "availability",
  "sale",
  "new",
  "sort",
  "page",
] as const;

export type ListingSearchParamsInput =
  | Record<string, string | string[] | undefined>
  | undefined;

/** True when the URL carries at least one real filter, sort or page value. */
export function hasCatalogueParams(params: ListingSearchParamsInput): boolean {
  if (!params) return false;
  return CATALOGUE_FILTER_PARAMS.some((key) => {
    const value = params[key];
    if (Array.isArray(value)) return value.some((entry) => entry.trim() !== "");
    return typeof value === "string" && value.trim() !== "";
  });
}

/**
 * Metadata for a category or collection listing.
 *
 * The clean path is always the canonical, and it is always indexable. A
 * filtered or sorted or paginated version of it points its canonical back at
 * the clean path AND carries `noindex, follow` — belt and braces, because a
 * canonical is a hint a crawler may ignore while a robots directive is not.
 *
 * `follow` is kept: the product links on page 4 of a filtered listing are still
 * worth discovering even though page 4 itself should never appear in results.
 *
 * This is what stops size × colour × fabric × price × sort × page from becoming
 * tens of thousands of near-identical URLs competing with the one page that
 * should rank.
 */
export function listingMetadata({
  title,
  description,
  path,
  images,
  searchParams,
}: {
  title: string;
  description: string;
  path: string;
  images?: string[];
  searchParams?: ListingSearchParamsInput;
}): Metadata {
  return buildMetadata({
    title,
    description,
    path,
    images,
    ...(hasCatalogueParams(searchParams) ? { robots: NOINDEX_FOLLOW } : {}),
  });
}
