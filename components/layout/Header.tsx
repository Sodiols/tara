"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Menu, User, ShoppingBag } from "lucide-react";
import { DesktopNavigation } from "./DesktopNavigation";
import { HeaderSearch } from "./HeaderSearch";
import { useCartStore } from "@/store/cartStore";
import { Container } from "./Container";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { StoreIdentity } from "@/lib/supabase/queries/settings";

const MobileNavigation = dynamic(
  () => import("./MobileNavigation").then((module) => module.MobileNavigation),
  { ssr: false },
);
const SearchOverlay = dynamic(
  () => import("./SearchOverlay").then((module) => module.SearchOverlay),
  { ssr: false },
);
const AccountMenu = dynamic(
  () => import("./AccountMenu").then((module) => module.AccountMenu),
  { ssr: false },
);

/**
 * Whether the browser holds a Supabase session cookie at all.
 *
 * Read without the Supabase SDK, so a signed-out visitor — most of them — sees
 * the plain account link at once instead of a dimmed one while ~250KB of SDK
 * downloads. It only chooses what to show first: the SDK, loaded once the page
 * is idle, is still what decides.
 */
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/;
const noSubscription = () => () => {};
const readSessionCookie = () => SESSION_COOKIE.test(document.cookie);
const serverSessionCookie = () => null;

export function Header({ identity }: { identity: StoreIdentity }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const cartCountRaw = useCartStore((s) => s.itemCount());
  const cartHasHydrated = useCartStore((s) => s.hasHydrated);
  const openBag = useCartStore((s) => s.openBag);
  const cartCount = cartHasHydrated ? cartCountRaw : 0;
  const [sdkAuthState, setAuthState] = useState<
    "loading" | "authenticated" | "anonymous"
  >(() => (isSupabaseConfigured() ? "loading" : "anonymous"));
  const hasSessionCookie = useSyncExternalStore(noSubscription, readSessionCookie, serverSessionCookie);
  const authState =
    sdkAuthState === "loading" && hasSessionCookie === false ? "anonymous" : sdkAuthState;
  // Set at signup and not refreshed after a profile edit — good enough for a
  // header greeting without an extra profiles query on every page load.
  const [accountName, setAccountName] = useState<string | undefined>();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;

    // Authentication changes the small account affordance but is not needed to
    // paint the page. The SDK is the largest script on the site, so it is
    // fetched only once the browser is idle — after the first paint and the
    // hero image, not competing with them. INITIAL_SESSION reads the locally
    // stored session and avoids a getUser() network request.
    const load = () => {
      void import("@/lib/supabase/client").then(({ createClient }) => {
        if (!active) return;
        const supabase = createClient();
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!active) return;
          setAuthState(session?.user ? "authenticated" : "anonymous");
          setAccountName(session?.user?.user_metadata?.full_name as string | undefined);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      });
    };

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(load, { timeout: 2000 });
    } else {
      timeoutId = globalThis.setTimeout(load, 1000);
    }

    return () => {
      active = false;
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
      unsubscribe?.();
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-border">
      <Container>
        {/*
          The search field is the centre of the bar.

          Logo, a search field filling the space in the middle, then account
          and bag — one row at every width, with the primary links on a row of
          their own underneath from lg. The field opens the full search panel.
        */}
        <div className="flex h-16 items-center gap-2 sm:gap-4 md:gap-6 lg:h-20 lg:gap-10">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label={"Menu"}
            className="-ml-2 shrink-0 p-2 text-ink lg:hidden"
          >
            <Menu size={22} />
          </button>

          <Link href="/" className="shrink-0" aria-label={"TARA"}>
            <Image
              src="/logo/logo-black.png"
              alt={"TARA"}
              width={250}
              height={64}
              /*
               * Eager, not `priority`.
               *
               * `priority` emitted a preload link that sat ABOVE the hero's in
               * the document, so a 5 KB wordmark was discovered before the
               * 57 KB photograph that is the LCP element and shared the first
               * round trips with it. Eager keeps the logo in the first wave of
               * requests — it is still painted with the header, with no flicker
               * — while `low` leaves the hero alone at the front of the queue.
               */
              loading="eager"
              fetchPriority="low"
              quality={90}
              className="h-5 w-auto"
            />
          </Link>

          <HeaderSearch onOpen={() => setSearchOpen(true)} className="min-w-0 flex-1" />

          <div className="flex shrink-0 items-center gap-0 sm:gap-1">
            {/*
              Visible at every width. It used to be desktop-only, which left a
              phone with no way into the account area from the bar at all —
              only from inside the hamburger drawer.
            */}
            {authState === "authenticated" ? (
              <AccountMenu fullName={accountName} />
            ) : (
              <Link
                href="/login"
                aria-label={"Account"}
                aria-busy={authState === "loading"}
                className={`inline-flex p-1.5 sm:p-2 text-ink hover:text-wine transition-colors ${
                  authState === "loading" ? "opacity-50" : ""
                }`}
              >
                <User size={20} />
              </Link>
            )}
            <button
              onClick={openBag}
              aria-label={"Shopping Bag"}
              className="relative p-1.5 sm:p-2 text-ink hover:text-wine transition-colors"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 bg-wine text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

      </Container>

      <div className="hidden border-t border-border lg:block">
        <Container>
          <div className="flex h-11 items-center justify-center">
            <DesktopNavigation />
          </div>
        </Container>
      </div>

      {mobileNavOpen ? (
        <MobileNavigation
          isOpen
          onClose={() => setMobileNavOpen(false)}
          identity={identity}
          authenticated={authState === "authenticated"}
        />
      ) : null}
      {searchOpen ? <SearchOverlay isOpen onClose={() => setSearchOpen(false)} /> : null}
    </header>
  );
}
