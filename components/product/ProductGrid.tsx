"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PackageSearch } from "lucide-react";

const QuickViewModal = dynamic(
  () => import("./QuickViewModal").then((module) => module.QuickViewModal),
  { ssr: false },
);

interface ProductGridProps {
  products: Product[];
  /**
   * Cards whose photograph loads immediately instead of lazily. Set it where
   * the grid starts on the first screen (a category listing); leave it at 0
   * where the grid is below the fold (the homepage). The first two also get a
   * high fetch priority: the top row on a phone.
   */
  eagerImages?: number;
}

export function ProductGrid({ products, eagerImages = 0 }: ProductGridProps) {
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  if (products.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        heading={"No products found"}
        text={"Try adjusting your filters or search terms."}
      />
    );
  }

  return (
    <>
      {/*
        The columns are fixed, so the gap is the only thing deciding how wide a
        card is: every pixel taken out of it goes straight into the photograph.
        It was 32px at lg, which left the four cards reading as four separate
        objects with the page showing between them. At 20px they read as one
        grid, and each card is about 10px wider for it. The row gap stays the
        larger of the two so rows still separate without a rule between them.
      */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-4 lg:grid-cols-4 lg:gap-x-5">
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            onQuickView={setQuickViewProduct}
            imagePriority={index < Math.min(2, eagerImages) ? "high" : index < eagerImages ? "eager" : undefined}
          />
        ))}
      </div>
      {quickViewProduct ? (
        <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
      ) : null}
    </>
  );
}
