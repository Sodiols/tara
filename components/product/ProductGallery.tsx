"use client";

import { useState } from "react";
import Image from "next/image";
import { ZoomIn, X } from "lucide-react";
import { createPortal } from "react-dom";

interface ProductGalleryProps {
  images: string[];
  /**
   * Alt text per image, parallel to `images`. The main image gets a real
   * description; a thumbnail with no stored alt of its own gets "" because it
   * is decorative — the product has already been named on the page, and
   * repeating it on every thumbnail is noise for a screen reader.
   */
  alts: string[];
}

export function ProductGallery({ images, alts }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  /*
   * RESETTING TO THE FIRST PHOTOGRAPH WHEN THE COLOUR CHANGES
   * ---------------------------------------------------------
   * Not done here. The product page gives this component a `key` of the
   * selected colour, so choosing Maroon while looking at the fourth Black
   * photograph mounts a fresh gallery: `activeIndex` starts at 0 and the zoom
   * overlay starts closed, with no effect to run, no stale frame painted, and
   * no state to keep in step. Remounting IS the reset.
   *
   * `safeIndex` is the belt to that braces: it keeps the index inside the array
   * even if a caller swaps the images without changing the key, so a shorter
   * list can never be addressed past its end.
   */
  const safeIndex = activeIndex < images.length ? activeIndex : 0;

  // A product with no photographs at all still has to render a page.
  if (images.length === 0) {
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <div
          role="img"
          aria-label="No photograph available for this product"
          className="flex aspect-[4/5] w-full items-center justify-center bg-beige text-center font-sans text-xs uppercase tracking-[0.12em] text-muted"
        >
          {"No image available"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 min-w-0 min-[900px]:grid min-[900px]:grid-cols-[76px_minmax(0,1fr)] min-[900px]:items-start min-[900px]:gap-4">
      {/* Main image: first on mobile, second column on tablet/desktop */}
      <div className="order-1 relative w-full min-w-0 aspect-[4/5] overflow-hidden bg-beige group min-[900px]:order-2">
        <Image
          src={images[safeIndex]}
          alt={alts[safeIndex] ?? ""}
          fill
          priority
          sizes="(min-width: 900px) 50vw, 100vw"
          className="object-cover"
        />
        <button
          onClick={() => setZoomOpen(true)}
          aria-label="Zoom image"
          className="absolute bottom-3 right-3 bg-white/90 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      {/* Thumbnails: horizontal scroll row on mobile, vertical column (fixed 76px) on tablet/desktop */}
      <div className="order-2 flex gap-2.5 overflow-x-auto min-[900px]:order-1 min-[900px]:flex-col min-[900px]:overflow-visible">
        {images.map((image, i) => (
          <button
            key={image + i}
            onClick={() => setActiveIndex(i)}
            aria-label={`View image ${i + 1}`}
            aria-current={safeIndex === i}
            className={`relative w-16 aspect-[4/5] shrink-0 overflow-hidden border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink min-[900px]:w-full ${
              safeIndex === i ? "border-wine" : "border-border hover:border-wine/50"
            }`}
          >
            <Image src={image} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>

      {zoomOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[70] bg-ink/90 flex items-center justify-center p-4 animate-fadeIn">
            <button
              onClick={() => setZoomOpen(false)}
              aria-label="Close zoom"
              className="absolute top-5 right-5 text-white"
            >
              <X size={28} />
            </button>
            <div className="relative w-full max-w-3xl aspect-[4/5]">
              <Image
                src={images[safeIndex]}
                alt={alts[safeIndex] ?? ""}
                fill
                sizes="800px"
                className="object-contain"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
