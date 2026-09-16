/**
 * The third-party measurement tags, and whether any of them exist.
 *
 * All three are optional and all three are off unless an id is configured. No
 * tracking id is written into the source: they differ between the real shop, a
 * staging deployment and a developer's machine, and a hardcoded one means a
 * developer's clicks land in the shop's reports.
 *
 * Read through these helpers rather than from `process.env` directly, so
 * "configured" means the same thing in the tag component, in the Content
 * Security Policy and in the tests. Next.js inlines `NEXT_PUBLIC_*` at build
 * time, so this module is safe on both sides.
 *
 * The shapes are checked, not just the presence: a placeholder left in an
 * environment file ("G-XXXXXXX", "your-pixel-id") must not load a tag that then
 * fails silently in the browser.
 */

function readEnv(value: string | undefined, pattern: RegExp): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return pattern.test(trimmed) ? trimmed : null;
}

/** GA4 measurement ids look like `G-XXXXXXXXXX`. */
export const GA4_MEASUREMENT_ID = readEnv(
  process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
  /^G-[A-Z0-9]{6,20}$/i,
);

/** Meta pixel ids are 15 or 16 digits. */
export const META_PIXEL_ID = readEnv(
  process.env.NEXT_PUBLIC_META_PIXEL_ID,
  /^\d{10,20}$/,
);

/** TikTok pixel ids are an alphanumeric handle. */
export const TIKTOK_PIXEL_ID = readEnv(
  process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
  /^[A-Z0-9]{10,40}$/i,
);

export const hasGa4 = GA4_MEASUREMENT_ID !== null;
export const hasMetaPixel = META_PIXEL_ID !== null;
export const hasTikTokPixel = TIKTOK_PIXEL_ID !== null;
export const hasAnyPixel = hasGa4 || hasMetaPixel || hasTikTokPixel;

/**
 * The origins each configured tag needs, for the Content Security Policy.
 *
 * The policy is built per request in lib/supabase/proxy.ts and lists nothing
 * for a tag that is not configured — a shop with no Meta pixel does not
 * announce facebook.net in its headers.
 */
export const PIXEL_SCRIPT_ORIGINS: string[] = [
  ...(hasGa4 ? ["https://www.googletagmanager.com"] : []),
  ...(hasMetaPixel ? ["https://connect.facebook.net"] : []),
  ...(hasTikTokPixel ? ["https://analytics.tiktok.com"] : []),
];

/** Where each tag sends its measurements. Without these the tags are blocked. */
export const PIXEL_CONNECT_ORIGINS: string[] = [
  ...(hasGa4
    ? [
        "https://www.google-analytics.com",
        "https://analytics.google.com",
        // GA4 sends to a regional collector for visitors outside the US.
        "https://region1.google-analytics.com",
        "https://www.googletagmanager.com",
      ]
    : []),
  ...(hasMetaPixel ? ["https://connect.facebook.net", "https://www.facebook.com"] : []),
  ...(hasTikTokPixel
    ? ["https://analytics.tiktok.com", "https://analytics-sg.tiktok.com"]
    : []),
];

/** The <img> fallbacks the pixels use when a request cannot be sent by script. */
export const PIXEL_IMAGE_ORIGINS: string[] = [
  ...(hasGa4 ? ["https://www.google-analytics.com"] : []),
  ...(hasMetaPixel ? ["https://www.facebook.com"] : []),
  ...(hasTikTokPixel ? ["https://analytics.tiktok.com"] : []),
];
