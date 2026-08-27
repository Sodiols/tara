"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { useCartStore } from "@/store/cartStore";
import { useToastStore } from "@/store/toastStore";

type DrawerComponent = ComponentType<{ announcement: string | null }>;
type EmptyComponent = ComponentType;

/**
 * Loads non-critical global behavior only when it can do useful work.
 *
 * The bag drawer and toast renderer used to be part of every route's initial
 * JavaScript even though both rendered nothing for a fresh visit. Account data
 * synchronization also competed with the LCP image immediately after
 * hydration. Keeping this tiny coordinator eager preserves every behavior while
 * moving the larger modules out of the critical loading path.
 */
export function ClientRuntime({
  storefront,
  announcement,
}: {
  storefront: boolean;
  announcement: string | null;
}) {
  const bagOpen = useCartStore((state) => state.isOpen);
  const toastCount = useToastStore((state) => state.toasts.length);
  const [Drawer, setDrawer] = useState<DrawerComponent | null>(null);
  const [Toasts, setToasts] = useState<EmptyComponent | null>(null);
  const [AuthSync, setAuthSync] = useState<EmptyComponent | null>(null);

  useEffect(() => {
    if (!storefront) return;
    void useCartStore.persist.rehydrate();
  }, [storefront]);

  useEffect(() => {
    if (!storefront || !bagOpen || Drawer) return;
    let active = true;
    void import("@/components/cart/ShoppingBagDrawer").then((module) => {
      if (active) setDrawer(() => module.ShoppingBagDrawer);
    });
    return () => {
      active = false;
    };
  }, [Drawer, bagOpen, storefront]);

  useEffect(() => {
    if (toastCount === 0 || Toasts) return;
    let active = true;
    void import("@/components/ui/ToastNotification").then((module) => {
      if (active) setToasts(() => module.ToastNotification);
    });
    return () => {
      active = false;
    };
  }, [Toasts, toastCount]);

  useEffect(() => {
    if (!storefront) return;
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let idleId: number | undefined;

    const load = () => {
      void import("@/components/AuthDataSync").then((module) => {
        if (active) setAuthSync(() => module.AuthDataSync);
      });
    };

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(load, { timeout: 1500 });
    } else {
      timeoutId = globalThis.setTimeout(load, 750);
    }

    return () => {
      active = false;
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
    };
  }, [storefront]);

  return (
    <>
      {storefront && AuthSync ? <AuthSync /> : null}
      {storefront && Drawer ? <Drawer announcement={announcement} /> : null}
      {Toasts ? <Toasts /> : null}
    </>
  );
}
