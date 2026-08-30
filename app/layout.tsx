import type { Metadata } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ClientRuntime } from "@/components/layout/ClientRuntime";
import { siteConfig } from "@/data/site";
import { SupabaseConfigurationNotice } from "@/components/SupabaseConfigurationNotice";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";
import { jsonLdScriptProps } from "@/lib/json-ld";
import { freeDeliveryHeadline } from "@/lib/delivery";
import { SCHEMA_IDS, postalAddress, websiteSchema } from "@/lib/seo";

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-heading",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  icons: {
    icon: {
      url: "/logo/favicon.png",
      type: "image/png",
      sizes: "512x512",
    },
  },
  title: {
    default: "TARA | Women's Clothing and Accessories in Bangladesh",
    template: "%s | TARA",
  },
  description:
    "Refined unready three piece and two piece clothing, and fashion accessories for the modern Bangladeshi woman, from Sylhet, Bangladesh.",
  openGraph: {
    title: "TARA | Women's Clothing and Accessories in Bangladesh",
    description:
      "Refined unready three piece and two piece clothing, and fashion accessories for the modern Bangladeshi woman.",
    url: siteConfig.url,
    siteName: "TARA",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TARA | Women's Clothing and Accessories in Bangladesh",
    description:
      "Refined unready three piece and two piece clothing, and fashion accessories from Sylhet, Bangladesh.",
  },
  // Google Search Console domain verification, from the environment so no
  // personal token is committed. Absent or blank means no tag is emitted at
  // all, which is the correct behaviour — an empty verification meta tag is
  // invalid, and most deployments verify by DNS instead.
  ...(process.env.GOOGLE_SITE_VERIFICATION?.trim()
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION.trim() } }
    : {}),
  // NO canonical here, deliberately.
  //
  // A canonical in the root layout is inherited by every route that does not
  // set its own, so /about, /size-guide, /privacy-policy and the rest were all
  // telling Google they were duplicates of the homepage. The homepage declares
  // its own in app/page.tsx; every other route builds one through
  // buildMetadata() in lib/seo.ts, which cannot forget it.
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-tara-pathname") ?? "/";
  const chromeless =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/print") ||
    pathname.startsWith("/maintenance");

  // Admin and maintenance surfaces have their own shell, so they should not
  // wait for storefront settings they never render. Public routes share this
  // one cached read between the structured data, header, footer and page.
  const settings = chromeless ? null : await getPublicStoreSettings();
  const announcement = settings ? freeDeliveryHeadline(settings.delivery) : null;

  const organizationSchema = settings ? {
    "@context": "https://schema.org",
    // OnlineStore rather than a bare Organization: TARA sells directly from
    // this site, and the more specific type is what makes the entity legible
    // as a merchant rather than as a company that happens to have a website.
    "@type": "OnlineStore",
    "@id": SCHEMA_IDS.organization,
    name: settings.storeName,
    url: siteConfig.url,
    logo: `${siteConfig.url}/logo/logo-black.png`,
    image: `${siteConfig.url}/logo/logo-black.png`,
    areaServed: { "@type": "Country", name: "Bangladesh" },
    // Split into street / locality / region where the parts can be read with
    // confidence. No postal code and no coordinates: neither is in the data,
    // and an invented one is a fact a crawler would believe.
    ...(postalAddress(settings.storeAddress)
      ? { address: postalAddress(settings.storeAddress) }
      : {}),
    ...(settings.supportEmail ? { email: settings.supportEmail } : {}),
    ...(settings.supportPhone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            telephone: settings.supportPhone,
            contactType: "customer support",
            areaServed: "BD",
          },
        }
      : {}),
    // A blank social URL is omitted rather than published as an empty string,
    // which Search Console flags as an invalid sameAs entry.
    sameAs: [settings.facebookUrl, settings.instagramUrl, settings.tiktokUrl].filter(Boolean),
  } : null;

  return (
    <html
      lang="en"
      className={`${bodoniModa.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <SupabaseConfigurationNotice />
        {/*
          Serialised through jsonLd(), which escapes `<` — a store name or
          address typed into /admin/settings containing `</script>` would
          otherwise close this block and let the rest be parsed as markup.
        */}
        {organizationSchema ? <script {...jsonLdScriptProps(organizationSchema)} /> : null}
        {/*
          The site as an entity, carrying the names people actually type:
          "TARA Bangladesh" and "tarabd.co" alongside "TARA". Useful for a short
          brand name that collides with an ordinary word.
        */}
        {settings ? <script {...jsonLdScriptProps(websiteSchema())} /> : null}
        {!chromeless ? (
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-taraWine focus:px-4 focus:py-2 focus:text-sm focus:text-taraIvory"
          >
            Skip to main content
          </a>
        ) : null}
        {settings ? <AnnouncementBar message={announcement} /> : null}
        {settings ? <Header identity={settings} /> : null}
        {chromeless ? children : <main id="main-content">{children}</main>}
        {settings ? <Footer identity={settings} /> : null}
        <ClientRuntime storefront={!chromeless} announcement={announcement} />
      </body>
    </html>
  );
}
