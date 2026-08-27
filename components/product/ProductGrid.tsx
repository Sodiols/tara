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
}

export function ProductGrid({ products }: ProductGridProps) {
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-10 md:gap-x-6 lg:gap-x-8">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} onQuickView={setQuickViewProduct} />
        ))}
      </div>
      {quickViewProduct ? (
        <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
      ) : null}
    </>
  );
}
