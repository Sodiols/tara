"use client";

import { create } from "zustand";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

/**
 * How long a toast stays on screen when the caller does not say.
 *
 * Long enough to read an error or a validation message without rushing. Callers
 * that show a purely confirmatory message — "Added to cart", where the cart
 * count updating is the real feedback — pass something shorter.
 */
export const DEFAULT_TOAST_DURATION_MS = 3200;

/** The confirmation shown when something is added to the cart. */
export const CART_TOAST_DURATION_MS = 1000;

interface ToastState {
  toasts: Toast[];
  /**
   * @param duration milliseconds to keep the toast on screen. Omit for the
   *        default; only pass a shorter value for messages the customer does
   *        not need to act on. Errors and validation messages must keep the
   *        default, because a customer who looks away for a second should not
   *        miss the reason something failed.
   */
  addToast: (message: string, type?: Toast["type"], duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = "success", duration = DEFAULT_TOAST_DURATION_MS) =>
    set((state) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // Clamped so a caller cannot pin a toast on screen forever or make one
      // that flashes too briefly to read.
      const visibleFor = Math.min(15_000, Math.max(600, duration));
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, visibleFor);
      return { toasts: [...state.toasts, { id, message, type }] };
    }),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
