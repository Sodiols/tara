/**
 * Static identity for the site.
 *
 * These are the values that either cannot come from the database or are facts
 * about the business rather than settings someone has yet to fill in:
 *
 *   name, domain, url   needed at build time for metadata, the sitemap and
 *                       robots.txt, before any request exists
 *   socials, address    real, long-standing values that act as the fallback
 *                       when the corresponding store_settings row is blank
 *
 * Phone, WhatsApp and support email are deliberately NOT here. They used to
 * hold placeholders (`+880 1XXX-XXXXXX`) that would have shipped to production;
 * they live in `store_settings` and are hidden entirely by every component
 * while blank — a missing number is obvious, an invented one is not.
 *
 * Nothing should read the fields below directly to render a page. Go through
 * `getPublicStoreSettings()` / `getStoreIdentity()` in
 * lib/supabase/queries/settings.ts, which layers the admin's live values over
 * these defaults — otherwise an edit in /admin/settings updates some of the
 * site and not the rest.
 *
 * Bangladesh divisions and districts used to live here too, in a list that was
 * both wrong and duplicated. They are now in data/bangladesh-geography.ts.
 */
export const siteConfig = {
  name: "TARA",
  domain: "www.tarabd.co",
  url: process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") || "https://www.tarabd.co",
  instagram: "https://instagram.com/tarabd.co",
  facebook: "https://facebook.com/tarabd.co",
  tiktok: "https://tiktok.com/@tarabd.co",
  instagramHandle: "@tarabd.co",
  /** The physical showroom. A real address, not a placeholder. */
  address: "Batortal Bazar, Zakiganj, Sylhet, Bangladesh",
};
