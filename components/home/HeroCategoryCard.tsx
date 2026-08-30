"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { HeroCategory } from "@/data/hero-categories";

/**
 * One card in the hero fan.
 *
 * The whole card is the link, so the target is the photograph rather than a
 * small label — which matters most on a phone, where a card is the biggest tap
 * target on the screen.
 *
 * The card knows nothing about the carousel. It is told which slot it occupies
 * and whether it is the active one; where the slots are and when they change is
 * the carousel's business. That split is what keeps the geometry in one table
 * instead of scattered through the markup.
 */

/**
 * Where each slot sits, as a class per relative position.
 *
 * The array is indexed by `offset + 2`, so `SLOT_STYLES[0]` is the far-left
 * card and `SLOT_STYLES[4]` the far-right one.
 *
 * Tailwind composes translate/rotate/scale into a single `transform`, applied
 * scale-first then rotate then translate — which is the order that makes a card
 * rotate about its own centre and then move, rather than swinging on an arc.
 * `transform-gpu` promotes it to translate3d so the browser composites the
 * whole fan on the GPU instead of repainting it.
 *
 * Percentages are of the card's own unscaled width, so the composition holds
 * together at every breakpoint without a second set of numbers.
 *
 * Three deliberate states: phone, tablet (md), desktop (lg). The fan opens
 * wider and tilts further as there is room for it; on a phone the outer pair
 * runs off the edge, which is what leaves the middle three legible.
 */
const SLOT_STYLES = [
  // far left
  "z-10 translate-x-[-112%] translate-y-[7%] rotate-[-9deg] scale-[0.74] " +
    "md:translate-x-[-108%] md:rotate-[-11deg] md:scale-[0.77] " +
    "lg:translate-x-[-104%] lg:translate-y-[8%] lg:rotate-[-13deg] lg:scale-[0.79]",
  // near left
  "z-20 translate-x-[-58%] translate-y-[3.5%] rotate-[-4.5deg] scale-[0.88] " +
    "md:translate-x-[-56%] md:rotate-[-5.5deg] md:scale-[0.89] " +
    "lg:translate-x-[-55%] lg:translate-y-[4%] lg:rotate-[-6deg] lg:scale-[0.9]",
  // centre
  "z-30 translate-x-0 translate-y-[-1.5%] rotate-0 scale-100 lg:translate-y-[-2%]",
  // near right
  "z-20 translate-x-[58%] translate-y-[3.5%] rotate-[4.5deg] scale-[0.88] " +
    "md:translate-x-[56%] md:rotate-[5.5deg] md:scale-[0.89] " +
    "lg:translate-x-[55%] lg:translate-y-[4%] lg:rotate-[6deg] lg:scale-[0.9]",
  // far right
  "z-10 translate-x-[112%] translate-y-[7%] rotate-[9deg] scale-[0.74] " +
    "md:translate-x-[108%] md:rotate-[11deg] md:scale-[0.77] " +
    "lg:translate-x-[104%] lg:translate-y-[8%] lg:rotate-[13deg] lg:scale-[0.79]",
];

export function HeroCategoryCard({
  category,
  offset,
  isActive,
  onActivate,
  shouldSuppressClick,
}: {
  category: HeroCategory;
  /** -2 (far left) through +2 (far right), relative to the active card. */
  offset: number;
  isActive: boolean;
  /** Brings this card to the centre — used when it is focused or clicked. */
  onActivate: () => void;
  /** True when the pointer travelled far enough that this was a drag, not a click. */
  shouldSuppressClick: () => boolean;
}) {
  // The five hero photographs are the one thing this component cannot supply
  // for itself. Until they are added to public/images/hero/, a card falls back
  // to a plain tonal panel carrying the category name: the composition still
  // reads, and it is obviously a placeholder rather than a broken image icon or
  // — worse — an unrelated photograph standing in for the real one.
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Link
      href={category.href}
      draggable={false}
      tabIndex={isActive ? 0 : -1}
      aria-hidden={!isActive}
      onFocus={onActivate}
      onClick={(event) => {
        // A drag that ends on top of a card must not navigate. The carousel
        // decides what counted as a drag; this only honours the verdict.
        if (shouldSuppressClick()) {
          event.preventDefault();
          return;
        }
        if (!isActive) {
          // A click on a side card brings it to the centre first rather than
          // navigating — the shopper is choosing, not committing.
          event.preventDefault();
          onActivate();
        }
      }}
      className={cn(
        "group absolute inset-0 m-auto block overflow-hidden rounded-[18px] bg-taraTaupe/20",
        "h-[336px] w-[240px] md:h-[386px] md:w-[276px] lg:h-[420px] lg:w-[300px] xl:h-[462px] xl:w-[330px]",
        // One shadow, set once and never animated — a transitioning box-shadow
        // repaints the card on every frame of the rotation.
        "shadow-[0_10px_30px_-18px_rgb(23_23_23/0.45)]",
        "transform-gpu will-change-transform",
        "transition-[transform,opacity] duration-[750ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-taraWine",
        SLOT_STYLES[offset + 2],
      )}
    >
      {imageFailed ? (
        // A bare tonal panel. No second copy of the name — the label below is
        // already there — and no scrim, which over a flat colour reads as a
        // smudge rather than as readability treatment.
        <span aria-hidden="true" className="block h-full w-full bg-taraIvory" />
      ) : (
        <Image
          src={category.image}
          alt={category.alt}
          fill
          // The centre card is the largest thing above the fold, so it is the
          // LCP candidate and is fetched eagerly. The other four are one
          // rotation away and can wait.
          priority={isActive}
          loading={isActive ? undefined : "lazy"}
          quality={75}
          sizes="(max-width: 767px) 240px, (max-width: 1023px) 276px, (max-width: 1279px) 300px, 330px"
          onError={() => setImageFailed(true)}
          draggable={false}
          // Anchored above centre: these are portrait fashion photographs and
          // the crop should come off the hem, never off the face.
          className="object-cover object-[center_28%]"
        />
      )}

      {/*
        A readability scrim, not a caption box. It covers the bottom third at a
        low opacity and fades to nothing, so the garment stays visible and the
        label still holds against a pale image. Only over a photograph — there
        is nothing to read against on the placeholder.
      */}
      {!imageFailed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-taraBlack/45 to-transparent"
        />
      )}

      <span
        className={cn(
          "absolute inset-x-0 bottom-0 px-4 pb-4 text-center font-serif",
          "text-[13px] leading-tight tracking-[0.14em] md:text-sm lg:text-[15px]",
          "uppercase transition-opacity duration-500",
          imageFailed ? "text-taraBlack/70" : "text-taraWhite",
          isActive ? "opacity-100" : "opacity-90",
        )}
      >
        {category.name}
      </span>
    </Link>
  );
}
