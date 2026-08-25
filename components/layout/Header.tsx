"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, Search, User, Heart, ShoppingBag } from "lucide-react";
import { DesktopNavigation } from "./DesktopNavigation";
import { MobileNavigation } from "./MobileNavigation";
import { SearchOverlay } from "./SearchOverlay";
import { AccountMenu } from "./AccountMenu";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useHasMounted } from "@/hooks/useHasMounted";
import { Container } from "./Container";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { StoreIdentity } from "@/lib/supabase/queries/settings";

export function Header({ identity }: { identity: StoreIdentity }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const hasMounted = useHasMounted();
  const cartCountRaw = useCartStore((s) => s.itemCount());
  const openBag = useCartStore((s) => s.openBag);
  const wishlistCountRaw = useWishlistStore((s) => s.items.length);
  const cartCount = hasMounted ? cartCountRaw : 0;
  const wishlistCount = hasMounted ? wishlistCountRaw : 0;
  const [authState, setAuthState] = useState<
    "loading" | "authenticated" | "anonymous"
  >(() => (isSupabaseConfigured() ? "loading" : "anonymous"));
  // Set at signup and not refreshed after a profile edit — good enough for a
  // header greeting without an extra profiles query on every page load.
  const [accountName, setAccountName] = useState<string | undefined>();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setAuthState(data.user ? "authenticated" : "anonymous");
      setAccountName(data.user?.user_metadata?.full_name as string | undefined);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(session?.user ? "authenticated" : "anonymous");
      setAccountName(session?.user?.user_metadata?.full_name as string | undefined);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-border">
      <Container>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-6 h-16 lg:h-20">
          <div className="flex items-center min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label={"Menu"}
              className="p-2 -ml-2 text-ink lg:hidden"
            >
              <Menu size={22} />
            </button>
            <DesktopNavigation />
          </div>

          <Link href="/" className="shrink-0 justify-self-center" aria-label={"TARA"}>
            <Image
              src="/logo/logo-black.png"
              alt={"TARA"}
              width={250}
              height={64}
              priority
              quality={90}
              className="h-5 lg:h-6 w-auto"
            />
          </Link>

          <div className="flex items-center justify-end gap-0.5 sm:gap-1 min-w-0">
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
      </Container>

      <MobileNavigation
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        identity={identity}
      />
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
