import type { Metadata } from "next";
import { Bodoni_Moda, Manrope, Noto_Sans_Bengali, Noto_Serif_Bengali } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ShoppingBagDrawer } from "@/components/cart/ShoppingBagDrawer";
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

const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bengali",
  display: "swap",
});

const notoSerifBengali = Noto_Serif_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600"],
  variable: "--font-bengali-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "TARA | Women's Clothing and Accessories in Bangladesh",
    template: "%s | TARA",
  },
  description:
    "TARA | বাংলাদেশের নারীদের পোশাক ও অ্যাক্সেসরিজ — refined undready and ready three piece clothing, and fashion accessories from Sylhet, Bangladesh.",
  openGraph: {
    title: "TARA | Women's Clothing and Accessories in Bangladesh",
    description:
      "Refined undready and ready three piece clothing, and fashion accessories for the modern Bangladeshi woman.",
    url: siteConfig.url,
    siteName: "TARA",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TARA | Women's Clothing and Accessories in Bangladesh",
    description: "Refined undready and ready three piece clothing, and fashion accessories from Sylhet, Bangladesh.",
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
    logo: `${siteConfig.url}/logo.png`,
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
      className={`${bodoniModa.variable} ${manrope.variable} ${notoBengali.variable} ${notoSerifBengali.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <SupabaseConfigurationNotice />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <LanguageProvider>
          <AuthDataSync />
          <AnnouncementBar />
          <Header />
          <main>{children}</main>
          <Footer />
          <ShoppingBagDrawer />
          <ToastNotification />
        </LanguageProvider>
      </body>
    </html>
  );
}
