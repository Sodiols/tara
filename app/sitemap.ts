import type { MetadataRoute } from "next";
import { getActiveProducts } from "@/lib/supabase/queries/products";
import { siteConfig } from "@/data/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getActiveProducts(500);
  const staticRoutes = [
    "",
    "/unstitched-three-piece",
    "/ready-three-piece",
    "/collection",
    "/accessories",
    "/new-arrivals",
    "/about",
    "/contact",
    "/faq",
    "/delivery-information",
    "/exchange-policy",
    "/privacy-policy",
    "/terms-and-conditions",
    "/size-guide",
    "/wishlist",
    "/bag",
    "/login",
    "/register",
  ].map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(),
  }));

  const productRoutes = products.map((p) => ({
    url: `${siteConfig.url}/product/${p.slug}`,
    lastModified: new Date(),
  }));

  return [...staticRoutes, ...productRoutes];
}
