import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public-client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { siteConfig } from "@/data/site";
import { logFailure } from "@/lib/logger";

/**
 * Only publicly indexable pages appear here.
 *
 * Deliberately excluded: the admin panel, the account area, checkout, the bag,
 * the wishlist, every auth screen, order tracking and search results. Those are
 * either private, transient, or infinite-variant URLs that would dilute the
 * index without ever earning a click.
 *
 * Product and collection URLs are generated from the database so the
 * sitemap reflects what is actually on sale, including `lastModified` taken
 * from the row's own `updated_at` rather than "now" — a sitemap that claims
 * everything changed today teaches crawlers to ignore the field.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteConfig.url, changeFrequency: "daily", priority: 1 },
    { url: `${siteConfig.url}/unstitched-three-piece`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteConfig.url}/three-piece`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteConfig.url}/ready-three-piece`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteConfig.url}/hijab`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteConfig.url}/accessories`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteConfig.url}/collection`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteConfig.url}/new-arrivals`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteConfig.url}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteConfig.url}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteConfig.url}/faq`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteConfig.url}/size-guide`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteConfig.url}/delivery-information`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteConfig.url}/exchange-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteConfig.url}/privacy-policy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteConfig.url}/terms-and-conditions`, changeFrequency: "yearly", priority: 0.2 },
  ];

  if (!isSupabaseConfigured()) return staticRoutes;

  try {
    // Session-free on purpose: the sitemap is identical for every visitor, so
    // binding it to cookies would opt the route out of static rendering and
    // force a database round trip on every crawl.
    const supabase = createPublicClient();
    const [products, collections] = await Promise.all([
      supabase
        .from("products")
        .select("slug,updated_at")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(5000),
      supabase
        .from("collections")
        .select("slug,updated_at,starts_at,ends_at")
        .eq("is_active", true),
    ]);

    const now = Date.now();

    const productRoutes: MetadataRoute.Sitemap = (products.data ?? []).map((product) => ({
      url: `${siteConfig.url}/product/${product.slug}`,
      lastModified: new Date(product.updated_at),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    // Categories are deliberately NOT listed.
    //
    // Only the four built-in ones have a route, and those are already hand-
    // written above. A category staff create in /admin/categories has no page
    // of its own, so emitting `${siteConfig.url}/${slug}` for it submitted a
    // URL that returns 404 — crawl budget spent on errors, and a "Submitted
    // URL not found" report in Search Console. Products in such a category are
    // still indexed through their own /product/<slug> URLs below.

    // A scheduled collection outside its window is not visible to shoppers, so
    // it must not be advertised to crawlers either.
    const collectionRoutes: MetadataRoute.Sitemap = (collections.data ?? [])
      .filter((collection) => {
        const startsOk = !collection.starts_at || new Date(collection.starts_at).getTime() <= now;
        const endsOk = !collection.ends_at || new Date(collection.ends_at).getTime() > now;
        return startsOk && endsOk;
      })
      .map((collection) => ({
        url: `${siteConfig.url}/collection/${collection.slug}`,
        lastModified: new Date(collection.updated_at),
        changeFrequency: "weekly",
        priority: 0.6,
      }));

    return [...staticRoutes, ...collectionRoutes, ...productRoutes];
  } catch (error) {
    // A sitemap that 500s is worse than a sitemap listing only the known-good
    // static routes, so a database problem degrades rather than fails.
    logFailure("sitemap.dynamic_routes_unavailable", error);
    return staticRoutes;
  }
}
