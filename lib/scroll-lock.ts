"use client";

/**
 * Reference-counted body scroll lock.
 *
 * Five separate overlays can cover the page — the modal, the bag drawer, the
 * search overlay, the mobile menu and the mobile filter drawer — and more than
 * one can be open at a time. Adding to the bag from inside the Quick View modal
 * opens the bag drawer on top of it; the product page can show the size guide
 * modal and the bag drawer together.
 *
 * Each of them used to set `document.body.style.overflow` directly, so
 * whichever closed FIRST reset it to "" and the page began scrolling behind the
 * one still open. Counting the locks means the body is only released when the
 * last overlay has gone.
 *
 * The returned release function is idempotent, so React re-running an effect
 * (StrictMode mounts, unmounts and mounts again) cannot drive the count
 * negative or release a lock twice.
 */

let depth = 0;
let restoreTo = "";

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (depth === 0) {
    restoreTo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  depth += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    depth = Math.max(0, depth - 1);
    if (depth === 0) document.body.style.overflow = restoreTo;
  };
}
