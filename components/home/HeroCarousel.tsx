"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { HERO_INITIAL_INDEX, heroCategories } from "@/data/hero-categories";
import { HeroCategoryCard } from "./HeroCategoryCard";

/**
 * The homepage hero: five category cards arranged as a fan, rotating.
 *
 * HOW A CARD KNOWS WHERE TO SIT
 * -----------------------------
 * Nothing is duplicated to fake an infinite loop. Each card works out its own
 * position relative to the active one, wrapped into the range -2..+2:
 *
 *     offset = ((index - activeIndex + 5) % 5)   ->  0..4
 *     if (offset > 2) offset -= 5                ->  -2..+2
 *
 * That wrap is the whole trick. Going from the last category to the first moves
 * every card by exactly one slot, the same as any other step, so the loop
 * boundary has no jump in it — there is no boundary, only five slots and a
 * pointer moving around a ring.
 *
 * WHY THE DRAG MOVES A WRAPPER
 * ----------------------------
 * Card positions are static Tailwind classes, which cannot express "and also
 * follow the finger by 37px". So the drag translates the stage that holds all
 * five cards, as one inline transform on one element. The fan slides as a
 * composition, and on release either the index changes or the stage springs
 * back — the cards themselves never learn about the gesture.
 */

const AUTOPLAY_MS = 4000;
/** After a manual change, the shopper is in charge; autoplay waits this long. */
const RESUME_AFTER_INTERACTION_MS = 7000;
/** How far a pointer must travel horizontally to count as a swipe, not a tap. */
const DRAG_THRESHOLD_PX = 56;
/** How far the fan is allowed to follow the finger, so the drag stays a hint. */
const MAX_DRAG_PULL_PX = 90;
/** Horizontal travel that commits the gesture to the carousel, freeing the page to scroll below it. */
const AXIS_LOCK_PX = 8;

type Axis = "undecided" | "horizontal" | "vertical";

export function HeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(HERO_INITIAL_INDEX);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [autoplayDelay, setAutoplayDelay] = useState(AUTOPLAY_MS);

  const count = heroCategories.length;

  // Gesture bookkeeping. Refs rather than state: these change on every
  // pointermove and none of them should cost a render.
  const pointerIdRef = useRef<number | null>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const axisRef = useRef<Axis>("undecided");
  const suppressClickRef = useRef(false);

  // The browser's own preference, read after mount so the server and the first
  // client render agree. Autoplay simply never starts when it is set; the
  // transitions are already neutralised by the global reduced-motion rule in
  // app/globals.css.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // A carousel advancing in a tab nobody is looking at is wasted work, and it
  // means returning to the tab lands mid-rotation.
  useEffect(() => {
    const sync = () => setIsPageVisible(!document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const goTo = useCallback(
    (index: number, manual = false) => {
      setActiveIndex(((index % count) + count) % count);
      setAutoplayDelay(manual ? RESUME_AFTER_INTERACTION_MS : AUTOPLAY_MS);
    },
    [count],
  );

  const goNext = useCallback(
    (manual = false) => goTo(activeIndex + 1, manual),
    [activeIndex, goTo],
  );
  const goPrevious = useCallback(
    (manual = false) => goTo(activeIndex - 1, manual),
    [activeIndex, goTo],
  );

  const isPaused = isDragging || isHovered || !isPageVisible || prefersReducedMotion;

  // A timeout restarted on every index change rather than a repeating interval:
  // a manual change re-arms it from that moment, so the shopper never gets a
  // card yanked away half a second after choosing it. The cleanup runs on every
  // dependency change, which is what makes an interval leak impossible here.
  useEffect(() => {
    if (isPaused) return;
    const id = window.setTimeout(() => goNext(), autoplayDelay);
    return () => window.clearTimeout(id);
  }, [activeIndex, autoplayDelay, isPaused, goNext]);

  // --- Pointer handling ----------------------------------------------------

  const endGesture = useCallback(() => {
    pointerIdRef.current = null;
    axisRef.current = "undecided";
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Secondary buttons open context menus; they are not drags.
    if (event.button !== 0 && event.pointerType === "mouse") return;
    pointerIdRef.current = event.pointerId;
    startRef.current = { x: event.clientX, y: event.clientY };
    axisRef.current = "undecided";
    suppressClickRef.current = false;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;

    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;

    // Which gesture is this? Decided once, from the first meaningful movement.
    // A vertical answer releases the pointer entirely so the page scrolls
    // normally — the hero must never be a place where the page stops scrolling.
    if (axisRef.current === "undecided") {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        axisRef.current = "vertical";
        pointerIdRef.current = null;
        return;
      }
      axisRef.current = "horizontal";
      setIsDragging(true);
      // Captured only now that the gesture is known to be ours, so a vertical
      // swipe is never stolen from the scroller.
      //
      // Guarded: capturing a pointer that is no longer active throws
      // InvalidStateError, which happens for real when a touch ends in the same
      // frame as the move that decided the axis. Losing capture only means the
      // drag ends early if the finger leaves the element — an uncaught throw
      // here would take the whole gesture, and the React error boundary, with it.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Capture is an enhancement, not a requirement.
      }
    }

    if (axisRef.current !== "horizontal") return;

    if (Math.abs(dx) > DRAG_THRESHOLD_PX / 2) suppressClickRef.current = true;

    // Resistance: the fan follows, but only so far, so the gesture reads as a
    // nudge towards the next card rather than a free-floating drag.
    const pull = Math.max(-MAX_DRAG_PULL_PX, Math.min(MAX_DRAG_PULL_PX, dx));
    setDragOffset(pull);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    const dx = event.clientX - startRef.current.x;

    if (axisRef.current === "horizontal" && Math.abs(dx) >= DRAG_THRESHOLD_PX) {
      // Dragging left pulls the next card in from the right, matching the
      // direction of the content rather than the direction of the finger.
      if (dx < 0) goNext(true);
      else goPrevious(true);
    }

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Already released by the browser; nothing to undo.
    }
    endGesture();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrevious(true);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext(true);
    }
  };

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Shop TARA by category"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex h-full w-full flex-col items-center justify-center"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          "relative w-full flex-1 select-none",
          // pan-y, never none: the browser keeps vertical scrolling for itself
          // and hands us the horizontal movement. `touch-action: none` here
          // would make the hero a dead zone the page cannot be scrolled from.
          "touch-pan-y",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 transform-gpu",
            !isDragging && "transition-transform duration-[750ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          )}
          style={{ transform: `translate3d(${dragOffset}px, 0, 0)` }}
        >
          {heroCategories.map((category, index) => {
            const wrapped = (index - activeIndex + count) % count;
            const offset = wrapped > count / 2 ? wrapped - count : wrapped;

            return (
              <HeroCategoryCard
                key={category.href}
                category={category}
                offset={offset}
                isActive={offset === 0}
                priority={index === HERO_INITIAL_INDEX}
                onActivate={() => goTo(index, true)}
                shouldSuppressClick={() => suppressClickRef.current}
              />
            );
          })}
        </div>
      </div>

      {/*
        Small enough to read as punctuation rather than a control bar, but real
        buttons: they give a keyboard user a way to reach every category without
        arrowing through, and they say where in the rotation the fan is.
      */}
      <div className="mt-5 flex items-center justify-center gap-2.5 lg:mt-6">
        {heroCategories.map((category, index) => (
          <button
            key={category.href}
            type="button"
            onClick={() => goTo(index, true)}
            aria-label={`Show ${category.name}`}
            aria-current={index === activeIndex}
            className={cn(
              "h-1.5 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              index === activeIndex ? "w-6 bg-taraWine" : "w-1.5 bg-taraTaupe/60 hover:bg-taraTaupe",
            )}
          />
        ))}
      </div>
    </div>
  );
}
