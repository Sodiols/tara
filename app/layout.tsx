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
  alternates: {
    canonical: siteConfig.url,
  },
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
    "@type": "Organization",
    name: settings.storeName,
    url: siteConfig.url,
    logo: `${siteConfig.url}/logo/logo-black.png`,
    ...(settings.storeAddress
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: settings.storeAddress,
            addressCountry: "BD",
          },
        }
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
