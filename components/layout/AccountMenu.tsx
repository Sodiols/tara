"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  Heart,
  KeyRound,
  LogOut,
  MapPin,
  Package,
  ShoppingBag,
  Truck,
  User,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { logoutAction } from "@/lib/supabase/actions/auth";

interface AccountMenuProps {
  fullName?: string;
}

export function AccountMenu({ fullName }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const openBag = useCartStore((s) => s.openBag);
  const clearBag = useCartStore((s) => s.clearBag);
  const clearWishlist = useWishlistStore((s) => s.replaceItems);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) close();
    };
    // pointerdown, not mousedown: the menu is on phones now, and a tap outside
    // it must close it without relying on emulated mouse events.
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      buttonRef.current?.focus();
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (!wrapperRef.current?.contains(e.relatedTarget as Node)) close();
  };

  const linkClass = "flex h-11 items-center gap-3 px-4 text-sm text-ink hover:bg-beige/60 transition-colors";

  return (
    // Positioned only from sm up. Below that the wrapper is static, so the panel
    // positions against the sticky <header> and spans the bar's width — anchored
    // to the icon it would open 260px wide from a button ~90px from the right
    // edge of a phone and run off the left of the screen.
    <div ref={wrapperRef} className="sm:relative" onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={"Account"}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex p-1.5 sm:p-2 text-ink hover:text-wine transition-colors"
      >
        <User size={20} />
      </button>

      {open && (
        <div className="absolute inset-x-3 top-full pt-2 sm:inset-x-auto sm:right-0 sm:w-[260px] sm:pt-3">
          <div
            id={panelId}
            role="menu"
            // Scrolls rather than running off a short phone screen: nine rows
            // are ~420px, taller than what is left below the bar on some.
            className="max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[6px] border border-border bg-white py-2 shadow-[0_12px_28px_-8px_rgba(23,23,23,0.16)]"
          >
            {fullName && (
              <p className="truncate px-4 pb-2 pt-1 font-sans text-xs text-muted">
                {"My Account"} · <span className="text-ink">{fullName}</span>
              </p>
            )}
            <Link href="/account" onClick={close} className={linkClass}>
              <User size={16} /> {"My Account"}
            </Link>
            <Link href="/account/profile" onClick={close} className={linkClass}>
              <User size={16} /> {"Profile"}
            </Link>
            <Link href="/account/wishlist" onClick={close} className={linkClass}>
              <Heart size={16} /> {"Wishlist"}
            </Link>
            <button
              type="button"
              onClick={() => {
                close();
                openBag();
              }}
              className={`${linkClass} w-full text-left`}
            >
              <ShoppingBag size={16} /> {"Shopping Bag"}
            </button>
            <Link href="/account/orders" onClick={close} className={linkClass}>
              <Package size={16} /> {"Order History"}
            </Link>
            <Link href="/track-order" onClick={close} className={linkClass}>
              <Truck size={16} /> {"Track Order"}
            </Link>
            <Link href="/account/addresses" onClick={close} className={linkClass}>
              <MapPin size={16} /> {"Addresses"}
            </Link>
            <Link href="/account/security" onClick={close} className={linkClass}>
              <KeyRound size={16} /> {"Change Password"}
            </Link>
            <div className="my-1 border-t border-border" role="presentation" />
            <form
              action={logoutAction}
              onSubmit={() => {
                clearBag();
                clearWishlist([]);
              }}
            >
              <button type="submit" className={`${linkClass} w-full text-left text-wine hover:text-wine`}>
                <LogOut size={16} /> {"Logout"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
