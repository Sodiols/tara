"use client";

import { usePathname } from "next/navigation";
import { AnnouncementBar } from "./AnnouncementBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ShoppingBagDrawer } from "@/components/cart/ShoppingBagDrawer";
import type { StoreIdentity } from "@/lib/supabase/queries/settings";

/**
 * The admin panel and the print views are full-bleed surfaces with their own
 * chrome, so the storefront header, announcement bar, footer and bag drawer are
 * suppressed there. Everything else on the site keeps the normal shell.
 *
 * This lives in a client component because the root layout is a server
 * component and cannot read the pathname; the alternative — moving every
 * storefront route into a route group — would rewrite dozens of working URLs
 * for no user-visible benefit.
 *
 * The live store settings are read once on the server and passed down, rather
 * than being fetched again by each component: one query per request, and one
 * source of truth for the values an administrator can change.
 */
function useChromeless() {
  const pathname = usePathname();
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/print") ||
    // The maintenance page has to stand alone: the header's navigation links to
    // shopping routes that are closed, and offering a shopper a way back into a
    // shop that will only send them here again is worse than a plain page.
    pathname.startsWith("/maintenance")
  );
}

export function SiteHeader({
  announcement,
  identity,
}: {
  announcement: string | null;
  identity: StoreIdentity;
}) {
  if (useChromeless()) return null;
  return (
    <>
      <AnnouncementBar message={announcement} />
      <Header identity={identity} />
    </>
  );
}

export function SiteFooter({
  identity,
  announcement,
}: {
  identity: StoreIdentity;
  announcement: string | null;
}) {
  if (useChromeless()) return null;
  return (
    <>
      <Footer identity={identity} />
      <ShoppingBagDrawer announcement={announcement} />
    </>
  );
}

export function SiteMain({ children }: { children: React.ReactNode }) {
  // The admin renders its own <main> inside AdminShell, so wrapping again here
  // would nest landmarks and confuse screen readers.
  if (useChromeless()) return <>{children}</>;
  return <main id="main-content">{children}</main>;
}
