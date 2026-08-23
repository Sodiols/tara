/** @type {import('next').NextConfig} */

// Derived from the env var (rather than hardcoded) so this keeps working
// across dev/staging/prod Supabase projects without a manual config edit.
function supabaseOrigin() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return { hostname: url.hostname, origin: url.origin };
  } catch {
    return { hostname: undefined, origin: undefined };
  }
}

const supabase = supabaseOrigin();
const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy.
 *
 * Built from the origins this application actually talks to:
 *   - Supabase REST/Auth/Realtime (connect-src, from the env var)
 *   - Supabase Storage + Unsplash for product imagery (img-src)
 *   - next/font/google, which self-hosts the font files at build time, so no
 *     fonts.googleapis.com entry is needed at runtime
 *
 * 'unsafe-inline' is required in style-src because Next.js and Tailwind emit
 * inline style attributes, and in script-src during development for React Fast
 * Refresh. In production script-src stays on 'self' plus the inline JSON-LD
 * block, which is why 'unsafe-eval' is dev-only.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com" +
    (supabase.origin ? ` ${supabase.origin}` : ""),
  "font-src 'self' data:",
  `connect-src 'self'${supabase.origin ? ` ${supabase.origin} ${supabase.origin.replace("https://", "wss://")}` : ""}${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
    // 75 is the default used by product and lifestyle photography. The brand
    // wordmark is rendered small and has fine serifs, so it is served at 90 —
    // Next 16 refuses any quality not listed here.
    qualities: [75, 90],
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
    ];
  },
};

export default nextConfig;
