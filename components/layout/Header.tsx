"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Menu, Search, User, ShoppingBag } from "lucide-react";
import { DesktopNavigation } from "./DesktopNavigation";
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
          Two layouts, one bar.

          FROM lg the logo sits at the left edge and everything else — the
          primary links, then the four icons — is one right-aligned group.
          `justify-between` across the two visible items does that with no
          spacer elements and no magic widths.

          BELOW lg there are no primary links, so the bar falls back to the
          standard phone arrangement: hamburger, centred logo, icons. That is
          what the three grid columns are for; 1fr / auto / 1fr centres the logo
          in the bar however wide either side happens to be.
        */}
        {/*
          BELOW sm the columns are auto / 1fr / auto, not 1fr / auto / 1fr.
          A phone header now carries three icons — search, account, bag —
          and those icons beside a hamburger cannot share a bar with a
          logo held at the exact centre until roughly 430px: the equal side
          columns are too narrow for the icon group, which then overflows into
          the logo. So on a phone the logo centres in the space between the
          two sides instead, and from sm up the true centre returns.
        */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 h-16 sm:grid-cols-[1fr_auto_1fr] sm:gap-x-6 lg:h-20 lg:flex lg:justify-between lg:gap-x-8">
          <div className="flex min-w-0 items-center lg:hidden">
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label={"Menu"}
              className="p-2 -ml-2 text-ink"
            >
              <Menu size={22} />
            </button>
          </div>

          <Link
            href="/"
            className="shrink-0 justify-self-center lg:justify-self-start"
            aria-label={"TARA"}
          >
            <Image
              src="/logo/logo-black.png"
              alt={"TARA"}
              width={250}
              height={64}
              priority
              quality={90}
              // 20px at every width. It was 24px from lg, which put the
              // wordmark at 30% of an 80px bar and made it read heavier than
              // the 13px links sitting beside it. One size is also one less
              // thing to keep in step between breakpoints.
              className="h-5 w-auto"
            />
          </Link>

          {/*
            The links and the icons travel together as the right-hand group. The
            outer gap only separates those two clusters — the icons keep their
            own tight spacing in the inner box, so moving the nav here does not
            push the cart away from the other icons.
          */}
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-6 xl:gap-10">
            <DesktopNavigation />
            <div className="flex shrink-0 items-center gap-0 sm:gap-1">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label={"Search"}
                className="p-1.5 sm:p-2 text-ink hover:text-wine transition-colors"
              >
                <Search size={20} />
              </button>
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
        </div>
      </Container>

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
