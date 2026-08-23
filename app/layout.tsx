import type { Metadata } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import "./globals.css";
import { SiteHeader, SiteFooter, SiteMain } from "@/components/layout/SiteChrome";
import { ToastNotification } from "@/components/ui/ToastNotification";
import { siteConfig } from "@/data/site";
import { AuthDataSync } from "@/components/AuthDataSync";
import { SupabaseConfigurationNotice } from "@/components/SupabaseConfigurationNotice";

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
    description: "Refined unstitched and ready three piece clothing, and fashion accessories from Sylhet, Bangladesh.",
  },
  alternates: {
    canonical: siteConfig.url,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TARA",
    url: siteConfig.url,
    logo: `${siteConfig.url}/logo/logo-black.png`,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Batortal Bazar, Zakiganj",
      addressLocality: "Sylhet",
      addressCountry: "BD",
    },
    sameAs: [siteConfig.facebook, siteConfig.instagram, siteConfig.tiktok],
  };

  return (
    <html
      lang="en"
      className={`${bodoniModa.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <SupabaseConfigurationNotice />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-taraWine focus:px-4 focus:py-2 focus:text-sm focus:text-taraIvory"
        >
          Skip to main content
        </a>
        <AuthDataSync />
        <SiteHeader />
        <SiteMain>{children}</SiteMain>
        <SiteFooter />
        <ToastNotification />
      </body>
    </html>
  );
}
