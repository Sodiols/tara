"use client";

import { usePathname } from "next/navigation";
import { AnnouncementBar } from "./AnnouncementBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ShoppingBagDrawer } from "@/components/cart/ShoppingBagDrawer";

/**
 * The admin panel and the print views are full-bleed surfaces with their own
 * chrome, so the storefront header, announcement bar, footer and bag drawer are
 * suppressed there. Everything else on the site keeps the normal shell.
 *
 * This lives in a client component because the root layout is a server
 * component and cannot read the pathname; the alternative — moving every
 * storefront route into a route group — would rewrite dozens of working URLs
 * for no user-visible benefit.
 */
function useChromeless() {
  const pathname = usePathname();
  return pathname.startsWith("/admin") || pathname.startsWith("/print");
}

export function SiteHeader() {
  if (useChromeless()) return null;
  return (
    <>
      <AnnouncementBar />
      <Header />
    </>
  );
}

export function SiteFooter() {
  if (useChromeless()) return null;
  return (
    <>
      <Footer />
      <ShoppingBagDrawer />
    </>
  );
}

export function SiteMain({ children }: { children: React.ReactNode }) {
  // The admin renders its own <main> inside AdminShell, so wrapping again here
  // would nest landmarks and confuse screen readers.
  if (useChromeless()) return <>{children}</>;
  return <main id="main-content">{children}</main>;
}
