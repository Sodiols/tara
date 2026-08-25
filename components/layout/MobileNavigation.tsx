"use client";

import Link from "next/link";
import { X, User, Heart, Headset, KeyRound, LogOut, MapPin, Package, Truck } from "lucide-react";
import { navItems } from "./DesktopNavigation";
import { MobileCollectionAccordion } from "./MobileCollectionAccordion";
import type { StoreIdentity } from "@/lib/supabase/queries/settings";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { logoutAction } from "@/lib/supabase/actions/auth";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { lockBodyScroll } from "@/lib/scroll-lock";

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  identity: StoreIdentity;
}

export function MobileNavigation({ isOpen, onClose, identity }: MobileNavigationProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const clearBag = useCartStore((s) => s.clearBag);
  const clearWishlist = useWishlistStore((s) => s.replaceItems);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setAuthenticated(!!data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setAuthenticated(!!session?.user));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    return lockBodyScroll();
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink/40 animate-fadeIn" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full w-[85%] max-w-sm bg-white animate-slideInLeft overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-serif text-xl tracking-widest uppercase">{"TARA"}</span>
          <button onClick={onClose} aria-label={"Close"} className="p-1 text-ink">
            <X size={22} />
          </button>
        </div>

        <nav aria-label="Mobile primary" className="flex flex-col py-2">
          {navItems.map((item) =>
            item.label === "Collection" ? (
              <MobileCollectionAccordion key={item.href} onNavigate={onClose} />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center h-14 px-5 font-sans font-medium text-sm uppercase tracking-[0.05em] text-ink border-b border-border/60 hover:bg-beige/60 transition-colors"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="flex flex-col py-2 mt-2">
          <Link
            href="/account"
            onClick={onClose}
            className="flex items-center gap-3 h-12 px-5 text-sm text-ink hover:bg-beige/60 transition-colors"
          >
            <User size={17} /> {"Account"}
          </Link>
          {authenticated && (
            <>
              <Link
                href="/account/orders"
                onClick={onClose}
                className="flex items-center gap-3 h-12 px-5 text-sm text-ink hover:bg-beige/60 transition-colors"
              >
                <Package size={17} /> {"Order History"}
              </Link>
              <Link
                href="/track-order"
                onClick={onClose}
                className="flex items-center gap-3 h-12 px-5 text-sm text-ink hover:bg-beige/60 transition-colors"
              >
                <Truck size={17} /> {"Track Order"}
              </Link>
              <Link
                href="/account/addresses"
                onClick={onClose}
                className="flex items-center gap-3 h-12 px-5 text-sm text-ink hover:bg-beige/60 transition-colors"
              >
                <MapPin size={17} /> {"Addresses"}
              </Link>
              <Link
                href="/account/security"
                onClick={onClose}
                className="flex items-center gap-3 h-12 px-5 text-sm text-ink hover:bg-beige/60 transition-colors"
              >
                <KeyRound size={17} /> {"Change Password"}
              </Link>
            </>
          )}
          <Link
            href="/wishlist"
            onClick={onClose}
            className="flex items-center gap-3 h-12 px-5 text-sm text-ink hover:bg-beige/60 transition-colors"
          >
            <Heart size={17} /> {"Wishlist"}
          </Link>
          <Link
            href="/contact"
            onClick={onClose}
            className="flex items-center gap-3 h-12 px-5 text-sm text-ink hover:bg-beige/60 transition-colors"
          >
            <Headset size={17} /> {"Customer Support"}
          </Link>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(identity.storeAddress)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 min-h-12 py-3 px-5 text-sm text-ink hover:bg-beige/60 transition-colors"
          >
            <MapPin size={17} className="shrink-0" /> {identity.storeAddress}
          </a>
          {authenticated && (
            <form
              action={logoutAction}
              onSubmit={() => {
                clearBag();
                clearWishlist([]);
                onClose();
              }}
            >
              <button
                type="submit"
                className="flex h-12 w-full items-center gap-3 px-5 text-sm text-wine hover:bg-beige/60 transition-colors"
              >
                <LogOut size={17} /> {"Logout"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
