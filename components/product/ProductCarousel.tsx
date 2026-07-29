"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";
import { QuickViewModal } from "./QuickViewModal";
import { cn } from "@/lib/utils";

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
        className="flex gap-4 md:gap-6 lg:gap-8 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => (
          <div key={product.id} className="w-[46%] sm:w-[31%] lg:w-[23%] shrink-0 snap-start">
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
      <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </div>
  );
}
