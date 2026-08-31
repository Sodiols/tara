"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { CollectionEditorialItem } from "@/data/collection-editorials";
import { Container } from "@/components/layout/Container";
import styles from "./CollectionEditorial.module.css";

type Collection = CollectionEditorialItem & { cta: string };
type Direction = -1 | 1;
type Gesture = { id: number; x: number; y: number; axis: "pending" | "horizontal" | "vertical" };

const EASING = "cubic-bezier(0.22, 0.68, 0, 1)";
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
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const activeRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const motionRef = useRef(false);
  const animationsRef = useRef<Animation[]>([]);
  const gestureRef = useRef<Gesture | null>(null);
  const count = collections.length;
  const active = collections[activeIndex];

  useEffect(() => {
    mountedRef.current = true;
    sectionRef.current?.setAttribute("data-enhanced", "true");
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      motionRef.current = preference.matches;
      if (preference.matches) animationsRef.current.forEach((animation) => animation.finish());
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

    return () => {
      mountedRef.current = false;
      observer.disconnect();
      preference.removeEventListener("change", syncMotion);
      animationsRef.current.forEach((animation) => animation.cancel());
    };
  }, []);

  async function navigate(direction: Direction) {
    // Synchronous lock covers multiple events in one React batch. Keep focus
    // on the button; aria-disabled describes this brief lock.
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
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
      if (mountedRef.current) setMessage("This photograph couldn’t load. Try another collection or reload to retry.");
    } finally {
      clearTimeout(deadline);
      animationsRef.current.forEach((animation) => animation.cancel());
      animationsRef.current = [];
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  function resetGesture(event: PointerEvent<HTMLDivElement>) {
    gestureRef.current = null;
    event.currentTarget.removeAttribute("data-dragging");
    event.currentTarget.style.removeProperty("--drag-x");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (busyRef.current || !event.isPrimary || event.button !== 0) return;
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
              <span className={styles.counterLine} />
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
            <Link href={active.href} prefetch={false} className={styles.cta}>
              <span>{active.cta}</span><ArrowRight size={18} strokeWidth={1.25} aria-hidden="true" />
            </Link>
            <div className={styles.controls} aria-label="Browse collections">
              <button type="button" aria-label="Previous collection" aria-disabled={busy} onClick={() => void navigate(-1)}>
                <ArrowLeft size={22} strokeWidth={1.15} aria-hidden="true" />
              </button>
              <span className={styles.controlDivider} aria-hidden="true" />
              <button type="button" aria-label="Next collection" aria-disabled={busy} onClick={() => void navigate(1)}>
                <ArrowRight size={22} strokeWidth={1.15} aria-hidden="true" />
              </button>
            </div>
          </div>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{active.name}, collection {activeIndex + 1} of {count}.</p>
          <p className={styles.error} role="status">{message}</p>
        </div>
      </Container>
    </section>
  );
}
