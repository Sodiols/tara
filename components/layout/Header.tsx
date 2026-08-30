"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Menu, Search, User, Heart, ShoppingBag } from "lucide-react";
import { DesktopNavigation } from "./DesktopNavigation";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useHasMounted } from "@/hooks/useHasMounted";
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

export function Header({ identity }: { identity: StoreIdentity }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const hasMounted = useHasMounted();
  const cartCountRaw = useCartStore((s) => s.itemCount());
  const cartHasHydrated = useCartStore((s) => s.hasHydrated);
  const openBag = useCartStore((s) => s.openBag);
  const wishlistCountRaw = useWishlistStore((s) => s.items.length);
  const cartCount = cartHasHydrated ? cartCountRaw : 0;
  const wishlistCount = hasMounted ? wishlistCountRaw : 0;
  const [authState, setAuthState] = useState<
    "loading" | "authenticated" | "anonymous"
  >(() => (isSupabaseConfigured() ? "loading" : "anonymous"));
  // Set at signup and not refreshed after a profile edit — good enough for a
  // header greeting without an extra profiles query on every page load.
  const [accountName, setAccountName] = useState<string | undefined>();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;

    // Authentication changes the small account affordance but is not needed to
    // paint the page. Loading the SDK after hydration keeps it out of the
    // critical bundle; INITIAL_SESSION reads the locally stored session and
    // avoids a getUser() network request for display-only state.
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

    return () => {
      active = false;
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
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-6 h-16 lg:h-20 lg:flex lg:justify-between lg:gap-x-8">
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
            push the cart away from the wishlist.
          */}
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-6 xl:gap-10">
            <DesktopNavigation />
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label={"Search"}
                className="p-2 text-ink hover:text-wine transition-colors"
              >
                <Search size={20} />
              </button>
              {authState === "authenticated" ? (
                <div className="hidden lg:inline-flex">
                  <AccountMenu fullName={accountName} />
                </div>
              ) : (
                <Link
                  href="/login"
                  aria-label={"Account"}
                  aria-busy={authState === "loading"}
                  className={`p-2 text-ink hover:text-wine transition-colors hidden lg:inline-flex ${
                    authState === "loading" ? "opacity-50" : ""
                  }`}
                >
                  <User size={20} />
                </Link>
              )}
              <Link
                href="/wishlist"
                aria-label={"Wishlist"}
                className="relative p-2 text-ink hover:text-wine transition-colors hidden sm:inline-flex"
              >
                <Heart size={20} />
                {wishlistCount > 0 && (
                  <span className="absolute top-1 right-1 bg-wine text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <button
                onClick={openBag}
                aria-label={"Shopping Bag"}
                className="relative p-2 text-ink hover:text-wine transition-colors"
              >
                <ShoppingBag size={20} />
                {cartCount > 0 && (
                  <span className="absolute top-1 right-1 bg-wine text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
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
        />
      ) : null}
      {searchOpen ? <SearchOverlay isOpen onClose={() => setSearchOpen(false)} /> : null}
    </header>
  );
}
