/** @type {import('next').NextConfig} */

// Derived from the env var (rather than hardcoded) so this keeps working
// across dev/staging/prod Supabase projects without a manual config edit.
function supabaseStorageHostname() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || undefined;
  } catch {
    return undefined;
  }
}

const supabaseHostname = supabaseStorageHostname();

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(supabaseHostname
        ? [
            {
              protocol: "https",
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
