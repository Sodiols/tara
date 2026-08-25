import type { Metadata } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import "./globals.css";
import { SiteHeader, SiteFooter, SiteMain } from "@/components/layout/SiteChrome";
import { ToastNotification } from "@/components/ui/ToastNotification";
import { siteConfig } from "@/data/site";
import { AuthDataSync } from "@/components/AuthDataSync";
import { SupabaseConfigurationNotice } from "@/components/SupabaseConfigurationNotice";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";
import { jsonLdScriptProps } from "@/lib/json-ld";
import { freeDeliveryHeadline } from "@/lib/delivery";

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-heading",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "TARA | Women's Clothing and Accessories in Bangladesh",
    template: "%s | TARA",
  },
  description:
    "Refined unstitched and ready three piece clothing, and fashion accessories for the modern Bangladeshi woman, from Sylhet, Bangladesh.",
  openGraph: {
    title: "TARA | Women's Clothing and Accessories in Bangladesh",
    description:
      "Refined unstitched and ready three piece clothing, and fashion accessories for the modern Bangladeshi woman.",
    url: siteConfig.url,
    siteName: "TARA",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TARA | Women's Clothing and Accessories in Bangladesh",
    description:
      "Refined unstitched and ready three piece clothing, and fashion accessories from Sylhet, Bangladesh.",
  },
  alternates: {
    canonical: siteConfig.url,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // One cached read for the whole render pass. The footer, the announcement bar
  // and this structured data all draw on it, so an edit in /admin/settings
  // reaches every one of them together rather than some of them.
  const settings = await getPublicStoreSettings();

  const organizationSchema = {
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
  };

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
        <script {...jsonLdScriptProps(organizationSchema)} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-taraWine focus:px-4 focus:py-2 focus:text-sm focus:text-taraIvory"
        >
          Skip to main content
        </a>
        <AuthDataSync />
        <SiteHeader
          announcement={freeDeliveryHeadline(settings.delivery)}
          identity={settings}
        />
        <SiteMain>{children}</SiteMain>
        <SiteFooter
          identity={settings}
          announcement={freeDeliveryHeadline(settings.delivery)}
        />
        <ToastNotification />
      </body>
    </html>
  );
}
