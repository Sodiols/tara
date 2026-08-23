"use client";

import type { Product } from "@/types";
import { ProductCarousel } from "./ProductCarousel";

export function RelatedProductsSection({ products }: { products: Product[] }) {

  if (products.length === 0) return null;

  return (
    <section className="py-14 border-t border-border mt-14">
      <h2 className="font-serif text-2xl sm:text-3xl text-ink mb-8">{"You May Also Like"}</h2>
      <ProductCarousel products={products} />
    </section>
  );
}
