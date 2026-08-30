/** @type {import('next').NextConfig} */

// Derived from the env var (rather than hardcoded) so this keeps working across
// dev/staging/prod Supabase projects without a manual config edit.
function supabaseOrigin() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return { hostname: url.hostname };
  } catch {
    return { hostname: undefined };
  }
}

const supabase = supabaseOrigin();

/**
 * The Content-Security-Policy is NOT here any more.
 *
 * It is built per request in lib/supabase/proxy.ts, because it now carries a
 * per-request nonce. A static header cannot: a nonce that is the same for every
 * response is exactly as useful to an attacker as 'unsafe-inline', which is
 * what the policy used to allow for scripts.
 *
 * Everything below is genuinely static and belongs in the build config.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // next/image re-encodes every product photograph to AVIF or WebP at the
    // size the layout actually asks for, and does not carry EXIF through — so a
    // 4000px original uploaded by staff is never what reaches a phone.
    qualities: [75, 90],
    // A year: the URL contains the source, the width and the quality, so a
    // different rendition is a different URL and this can be cached hard.
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(supabase.hostname
        ? [
            {
              protocol: "https",
              hostname: supabase.hostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },
  /**
   * Permanent redirects for the two category slugs renamed by migration 0020.
   *
   * `/unstitched-three-piece` and `/ready-three-piece` were live for the whole
   * life of the shop: they are in the sitemap that has already been submitted,
   * in Search Console, in customers' bookmarks, and in any link ever shared.
   * A rename without these is a 404 for every one of them and the loss of
   * whatever ranking the old URL had earned.
   *
   * 308 (permanent: `permanent: true`) rather than 307, because that is what
   * tells a crawler to transfer the old URL's signals to the new one and stop
   * requesting the old path. The query string is carried across automatically,
   * so a shared filtered link keeps its filters.
   */
  async redirects() {
    return [
      {
        source: "/unstitched-three-piece",
        destination: "/unready-three-piece",
        permanent: true,
      },
      {
        source: "/ready-three-piece",
        destination: "/two-piece",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Nothing under these paths should ever be cached by a shared cache or
        // indexed: they render one specific customer's or staff member's data.
        source: "/(admin|account|checkout|bag|wishlist)/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        // The health endpoint is polled by uptime monitors; a cached answer
        // would report health the instance no longer has.
        source: "/api/health",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
