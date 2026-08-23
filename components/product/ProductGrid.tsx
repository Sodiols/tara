"use client";

import { useState } from "react";
import type { Product } from "@/types";
import { ProductCard } from "./ProductCard";
import { QuickViewModal } from "./QuickViewModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PackageSearch } from "lucide-react";

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
      <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </>
  );
}
