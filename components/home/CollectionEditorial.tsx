"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import type { CollectionEditorialItem } from "@/data/collection-editorials";
import { Container } from "@/components/layout/Container";
import styles from "./CollectionEditorial.module.css";

type Collection = CollectionEditorialItem & { cta: string };
type Direction = -1 | 1;
type Gesture = { id: number; x: number; y: number; axis: "pending" | "horizontal" | "vertical" };

const EASING = "cubic-bezier(0.22, 0.68, 0, 1)";
const AUTOPLAY_INTERVAL_MS = 2000;
const MANUAL_IDLE_MS = 5000;
const wrap = (index: number, count: number) => (index + count) % count;
const slotTransform = (slot: number) =>
  `translate(calc(var(--stack-step) * ${slot}), calc(var(--stack-lift) * ${slot})) rotate(calc(var(--stack-turn) * ${slot}))`;

/**
 * The first print, heading and link are server rendered. JS only adds browsing.
 * Five persistent nodes prevent image remounts and let previous reverse next.
 */
export function CollectionEditorial({ collections }: { collections: readonly Collection[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [autoplayPaused, setAutoplayPaused] = useState(false);
  const [announceChange, setAnnounceChange] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const activeRef = useRef(0);
  const busyRef = useRef(false);
  const automaticTurnRef = useRef(false);
  const pendingManualRef = useRef<Direction | null>(null);
  const mountedRef = useRef(false);
  const motionRef = useRef(false);
  const animationsRef = useRef<Animation[]>([]);
  const gestureRef = useRef<Gesture | null>(null);
  const inViewRef = useRef(false);
  const resumeAtRef = useRef(0);
  const count = collections.length;
  const active = collections[activeIndex];

  useEffect(() => {
    mountedRef.current = true;
    sectionRef.current?.setAttribute("data-enhanced", "true");
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      motionRef.current = preference.matches;
      if (preference.matches) {
        animationsRef.current.forEach((animation) => animation.finish());
        // Start in manual mode for reduced motion. Explicit Play can still
        // advance photographs without the card movement.
        setAutoplayPaused(true);
      }
    };
    syncMotion();
    preference.addEventListener("change", syncMotion);

    // Warm the small responsive renditions just before this below-fold section.
    // Nothing is preloaded in the document head at the expense of the hero.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        imagesRef.current.forEach((image) => { if (image) image.loading = "eager"; });
        observer.disconnect();
      }
    }, { rootMargin: "500px" });
    if (sectionRef.current) observer.observe(sectionRef.current);

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      inViewRef.current = entry.isIntersecting && entry.intersectionRatio >= 0.5;
      resumeAtRef.current = Math.max(resumeAtRef.current, Date.now() + AUTOPLAY_INTERVAL_MS);
    }, { threshold: 0.5, rootMargin: "-80px 0px 0px" });
    if (stackRef.current) visibilityObserver.observe(stackRef.current);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        resumeAtRef.current = Math.max(resumeAtRef.current, Date.now() + AUTOPLAY_INTERVAL_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mountedRef.current = false;
      observer.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      preference.removeEventListener("change", syncMotion);
      animationsRef.current.forEach((animation) => animation.cancel());
    };
  }, []);

  const navigate = useCallback(async function navigate(direction: Direction, automatic = false): Promise<void> {
    if (!automatic) resumeAtRef.current = Date.now() + MANUAL_IDLE_MS;
    // Synchronous lock covers multiple events in one React batch. Keep focus
    // on the button; aria-disabled describes this brief lock.
    if (busyRef.current) {
      // A user's click during an automatic turn takes priority as soon as the
      // print settles. Manual click bursts still keep the original single-turn lock.
      if (!automatic && automaticTurnRef.current) pendingManualRef.current = direction;
      return;
    }
    busyRef.current = true;
    automaticTurnRef.current = automatic;
    setBusy(true);
    setMessage("");
    setAnnounceChange(!automatic);
    const from = activeRef.current;
    const to = wrap(from + direction, count);
    const image = imagesRef.current[to];
    let deadline: ReturnType<typeof setTimeout> | undefined;

    try {
      if (!image) throw new Error("Image unavailable");
      image.loading = "eager";
      // Wait for the ACTUAL responsive image, including decoding. Failed or
      // slow requests leave the current photograph intact and allow a retry.
      await Promise.race([
        image.decode(),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(() => reject(new Error("Image timed out")), 8000);
        }),
      ]);
      if (!mountedRef.current) return;

      const movingIndex = direction === 1 ? from : to;
      const movingCard = cardsRef.current[movingIndex];
      if (!movingCard) return;
      movingCard.style.zIndex = String(count + 1);

      if (!motionRef.current && typeof movingCard.animate === "function") {
        const flight = "translate(-22%, -2%) rotate(-3deg)";
        const animations = cardsRef.current.flatMap((card, index) => {
          if (!card) return [];
          const before = wrap(index - from, count);
          const after = wrap(index - to, count);
          const frames = index === movingIndex
            ? (direction === 1
              ? [{ transform: slotTransform(0), opacity: 1 }, { transform: flight, opacity: 0 }]
              : [{ transform: flight, opacity: 0 }, { transform: slotTransform(0), opacity: 1 }])
            : [{ transform: slotTransform(before) }, { transform: slotTransform(after) }];
          return [card.animate(frames, { duration: 580, easing: EASING, fill: "forwards" })];
        });
        animationsRef.current = animations;
        await Promise.all(animations.map((animation) => animation.finished));
      }

      if (!mountedRef.current) return;
      // Commit underneath finished animations before removing them, avoiding
      // a frame where the outgoing print jumps back to the front.
      cardsRef.current.forEach((card, index) => {
        if (!card) return;
        const slot = wrap(index - to, count);
        card.style.transform = slotTransform(slot);
        card.style.zIndex = String(count - slot);
      });
      activeRef.current = to;
      setActiveIndex(to);
    } catch {
      if (mountedRef.current) {
        setAutoplayPaused(true);
        setMessage("This photograph couldn’t load. Try another collection or reload to retry.");
      }
    } finally {
      clearTimeout(deadline);
      animationsRef.current.forEach((animation) => animation.cancel());
      animationsRef.current = [];
      busyRef.current = false;
      automaticTurnRef.current = false;
      if (mountedRef.current) {
        setBusy(false);
        const pending = pendingManualRef.current;
        pendingManualRef.current = null;
        if (pending !== null) void navigate(pending);
      }
    }
  }, [count]);

  useEffect(() => {
    if (autoplayPaused) return;
    // Start-to-start cadence stays two seconds; the 580ms card animation does
    // not add another delay. The existing busy lock also covers slow decoding.
    const timer = window.setInterval(() => {
      const focused = document.activeElement;
      const isReadingOrNavigating = focused instanceof HTMLElement
        && sectionRef.current?.contains(focused) && focused.matches(":focus-visible")
        && focused.dataset.autoplayControl !== "true";
      // Read current browser hover state instead of retaining pointer events:
      // changing the Play/Pause icon can otherwise leave a stale hover flag.
      // Touch browsers can retain :hover after a tap, so exclude them here.
      const isHoveringAction = window.matchMedia("(hover: hover)").matches
        && sectionRef.current?.querySelector("[data-autoplay-pause-zone]:hover");
      if (
        !inViewRef.current || document.hidden || busyRef.current ||
        gestureRef.current || isHoveringAction || isReadingOrNavigating ||
        Date.now() < resumeAtRef.current
      ) return;
      void navigate(1, true);
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoplayPaused, navigate]);

  function resetGesture(event: PointerEvent<HTMLDivElement>) {
    gestureRef.current = null;
    event.currentTarget.removeAttribute("data-dragging");
    event.currentTarget.style.removeProperty("--drag-x");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    resumeAtRef.current = Date.now() + MANUAL_IDLE_MS;
    if (busyRef.current) return;
    gestureRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: "pending" };
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (gesture.axis === "pending") {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
      if (Math.abs(dy) >= Math.abs(dx)) gesture.axis = "vertical";
      else if (Math.abs(dx) > Math.abs(dy) * 1.4) {
        gesture.axis = "horizontal";
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.setAttribute("data-dragging", "true");
      }
    }
    if (gesture.axis === "horizontal" && !motionRef.current) {
      // No layout reads or React renders on pointermove.
      event.currentTarget.style.setProperty("--drag-x", `${Math.max(-18, Math.min(18, dx * 0.16))}px`);
    }
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const shouldNavigate = gesture.axis === "horizontal" && Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.4;
    resetGesture(event);
    if (shouldNavigate) void navigate(dx < 0 ? 1 : -1);
  }

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="collection-editorial-heading" data-collection-editorial="" data-active-collection={active.id}>
      <Container>
        <div className={styles.composition}>
          <div className={styles.masthead}>
            <p className={styles.eyebrow}>Collections</p>
            <p className={styles.edition}>A wardrobe, thoughtfully considered</p>
          </div>

          <div className={styles.stage}>
            <div
              ref={stackRef}
              className={styles.stack}
              role="group"
              aria-label="Collection photographs"
              aria-describedby="collection-gesture-hint"
              tabIndex={0}
              aria-busy={busy}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  void navigate(event.key === "ArrowRight" ? 1 : -1);
                }
              }}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={resetGesture}
              onLostPointerCapture={(event) => {
                // Touch starts with implicit capture on the inner print. Its
                // bubbled loss when capture moves to this wrapper is NOT the
                // end of the swipe.
                if (event.target === event.currentTarget) resetGesture(event);
              }}
              onPointerLeave={(event) => {
                if (gestureRef.current?.axis !== "horizontal") resetGesture(event);
              }}
            >
              {collections.map((collection, index) => {
                const slot = wrap(index - activeIndex, count);
                const current = slot === 0;
                return (
                  <div
                    key={collection.id}
                    ref={(node) => { cardsRef.current[index] = node; }}
                    className={styles.card}
                    aria-hidden={!current}
                    data-current={current}
                    style={{ transform: slotTransform(slot), zIndex: count - slot }}
                  >
                    <div className={styles.print}>
                      <Image
                        ref={(node) => { imagesRef.current[index] = node; }}
                        src={collection.image}
                        alt={current ? collection.alt : ""}
                        fill
                        sizes="(min-width: 1440px) 459px, (min-width: 1280px) calc((100vw - 128px) * .35), (min-width: 1024px) calc((100vw - 96px) * .35), (min-width: 768px) calc((100vw - 64px) * .4), calc((100vw - 40px) * .48)"
                        placeholder="blur"
                        className={styles.image}
                        style={{ objectPosition: collection.objectPosition }}
                        draggable={false}
                      />
                      <span className={styles.cardLabel}>{collection.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <h2 id="collection-editorial-heading" className={styles.heading} aria-label="Everyday Elegance">
              <span className={`${styles.word} ${styles.everyday}`} aria-hidden="true">Everyday</span>
              <span className={`${styles.word} ${styles.elegance}`} aria-hidden="true">Elegance</span>
            </h2>

            <div className={styles.counter} aria-hidden="true">
              <span className={styles.currentNumber}>{String(activeIndex + 1).padStart(2, "0")}</span>
              <span className={styles.totalNumber}>/ 05</span>
            </div>
            <p id="collection-gesture-hint" className={styles.gestureHint}>
              <span aria-hidden="true">Drag or swipe to discover</span>
              <span className="sr-only">Swipe horizontally or use the left and right arrow keys to browse. Previous and next buttons are also available.</span>
            </p>
          </div>

          <div className={styles.footer}>
            <p className={styles.description}>Thoughtfully selected pieces for work, family, celebrations, and everyday moments.</p>
            <Link
              href={active.href}
              prefetch={false}
              className={styles.cta}
              data-autoplay-pause-zone=""
            >
              <span>{active.cta}</span><ArrowRight size={18} strokeWidth={1.25} aria-hidden="true" />
            </Link>
            <div
              className={styles.controls}
              aria-label="Browse collections"
              data-autoplay-pause-zone=""
            >
              <button
                type="button"
                data-autoplay-control="true"
                aria-label={autoplayPaused ? "Play automatic collection changes" : "Pause automatic collection changes"}
                onClick={() => {
                  resumeAtRef.current = Date.now() + AUTOPLAY_INTERVAL_MS;
                  setAutoplayPaused((paused) => !paused);
                }}
              >
                {autoplayPaused
                  ? <Play size={15} strokeWidth={1.15} aria-hidden="true" />
                  : <Pause size={15} strokeWidth={1.15} aria-hidden="true" />}
              </button>
              <button type="button" aria-label="Previous collection" aria-disabled={busy} onClick={() => void navigate(-1)}>
                <ArrowLeft size={22} strokeWidth={1.15} aria-hidden="true" />
              </button>
              <span className={styles.controlDivider} aria-hidden="true" />
              <button type="button" aria-label="Next collection" aria-disabled={busy} onClick={() => void navigate(1)}>
                <ArrowRight size={22} strokeWidth={1.15} aria-hidden="true" />
              </button>
            </div>
          </div>
          <p className="sr-only" role="status" aria-live={announceChange ? "polite" : "off"} aria-atomic="true">{active.name}, collection {activeIndex + 1} of {count}.</p>
          <p className={styles.error} role="status">{message}</p>
        </div>
      </Container>
    </section>
  );
}
