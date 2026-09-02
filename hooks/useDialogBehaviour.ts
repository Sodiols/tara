"use client";

import { useEffect, type RefObject } from "react";
import { lockBodyScroll } from "@/lib/scroll-lock";

/**
 * Everything a modal surface owes a keyboard or screen reader user, in one
 * place.
 *
 * WHY THIS IS A HOOK AND NOT THREE IMPLEMENTATIONS
 * ------------------------------------------------
 * The site had three overlays and three different answers. `Modal` was
 * complete — dialog role, Escape, a focus trap, focus restoration, scroll lock.
 * `SearchOverlay` and `MobileNavigation` had the scroll lock and nothing else:
 * no Escape, no trap, no restoration, and no dialog semantics at all. Tab from
 * inside either of them walked straight out into the page behind, which is
 * still rendered and still focusable, so a keyboard user ended up operating
 * controls they could not see while an overlay covered them.
 *
 * Rather than write the trap twice more, it moved here and all three call it.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It does not render anything, and it does not decide what the dialog looks
 * like. Markup keeps `role="dialog"` and `aria-modal="true"` at the call site,
 * where the accessible name also lives — those belong to the element, not to
 * the behaviour.
 */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogBehaviourOptions {
  isOpen: boolean;
  onClose: () => void;
  /** The panel to trap focus inside. */
  panelRef: RefObject<HTMLElement | null>;
  /**
   * What to focus on open. Falls back to the first focusable element in the
   * panel, and then to the panel itself, so focus is never left on the element
   * behind the overlay that opened it.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function useDialogBehaviour({
  isOpen,
  onClose,
  panelRef,
  initialFocusRef,
}: DialogBehaviourOptions): void {
  useEffect(() => {
    if (!isOpen) return;

    // Captured before anything is focused, so closing returns the shopper to
    // the control they opened this from rather than to the top of the document.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const release = lockBodyScroll();

    const focusables = () =>
      panelRef.current
        ? [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
            // A control can match the selector and still be unfocusable — a
            // panel that animates in from `display: none`, an input inside a
            // collapsed accordion. offsetParent is null for both.
            (element) => element.offsetParent !== null || element === document.activeElement,
          )
        : [];

    // One frame late: a portal's children are not in the document on the tick
    // the effect runs, so focusing here without waiting focuses nothing.
    const focusTimer = window.setTimeout(() => {
      const target = initialFocusRef?.current ?? focusables()[0] ?? panelRef.current;
      target?.focus();
    }, 0);

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusables();
      if (elements.length === 0) {
        // Nothing to move to, so Tab must not be allowed to leave the dialog.
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;

      // Wrapping at both ends is the trap. The third case matters more than it
      // looks: if focus is somewhere outside the panel entirely — the page
      // behind, or the body after a click on the backdrop — Tab pulls it back
      // in rather than continuing through the page under the overlay.
      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panelRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKey);
      release();
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose, panelRef, initialFocusRef]);
}
