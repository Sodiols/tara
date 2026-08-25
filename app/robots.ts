import type { MetadataRoute } from "next";
import { siteConfig } from "@/data/site";

/**
 * Anything that renders one specific person's data, or exists only as a step in
 * a flow, is kept out of the index. The admin panel additionally sends
 * `X-Robots-Tag: noindex` from next.config.mjs and its layout sets `robots` in
 * metadata, so it is excluded three ways rather than relying on this file
 * alone — robots.txt is a request, not an access control.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/account",
          "/account/",
          "/checkout",
          "/bag",
          "/wishlist",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/auth/",
          "/track-order",
          "/unsubscribe",
          "/maintenance",
          "/api/",
          "/search",
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
