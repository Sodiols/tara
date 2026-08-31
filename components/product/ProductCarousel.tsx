"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";
import { cn } from "@/lib/utils";

const QuickViewModal = dynamic(
  () => import("./QuickViewModal").then((module) => module.QuickViewModal),
  { ssr: false },
);

interface ProductCarouselProps {
  products: Product[];
}

export function ProductCarousel({ products }: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateBoundaries = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };

  useEffect(() => {
    updateBoundaries();
  }, [products]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  const arrowBaseClass =
    "hidden md:flex absolute top-[38%] -translate-y-1/2 z-10 w-11 h-11 items-center justify-center rounded-full bg-white border border-border shadow-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:border-wine";

  return (
    <div className="relative">
      <button
        onClick={() => scroll("left")}
        aria-label="Scroll left"
        disabled={atStart}
        className={cn(arrowBaseClass, "-left-5")}
      >
        <ChevronLeft size={18} />
      </button>
      <div
        ref={scrollRef}
        onScroll={updateBoundaries}
        className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:gap-4 lg:gap-5"
      >
        {/*
          A row fills the rail exactly, which a flat percentage cannot do: with
          n cards across there are n-1 gaps to pay for, so the width is
          `100%/n` minus that share of them. Written as calc rather than a
          rounded percentage because the two have to stay in step — the old 23%
          against a 32px gap left the fourth card 16px over the edge at 1024,
          clipped rather than peeking.

          The 46% on a phone is deliberately not that: two cards and a sliver of
          a third is the only thing telling a thumb there is more to the right,
          and below md there are no arrows to say it instead.
        */}
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[46%] shrink-0 snap-start sm:w-[calc(33.333%-10.667px)] lg:w-[calc(25%-15px)]"
          >
            <ProductCard product={product} onQuickView={setQuickViewProduct} />
          </div>
        ))}
      </div>
      <button
        onClick={() => scroll("right")}
        aria-label="Scroll right"
        disabled={atEnd}
        className={cn(arrowBaseClass, "-right-5")}
      >
        <ChevronRight size={18} />
      </button>
      {quickViewProduct ? (
        <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
      ) : null}
    </div>
  );
}
