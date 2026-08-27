"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useWishlistStore } from "@/store/wishlistStore";
import { useToastStore } from "@/store/toastStore";
import { useAddToCart } from "@/hooks/useAddToCart";
import { ONE_SIZE } from "@/lib/product-size";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Container } from "@/components/layout/Container";
import { PriceDisplay } from "@/components/product/PriceDisplay";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Product } from "@/types";
import { toggleWishlistAction } from "@/lib/supabase/actions/wishlist";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function WishlistClient() {
  const { items, removeItem } = useWishlistStore();
  const addToCart = useAddToCart();
  const { addToast } = useToastStore();

  const handleMoveToBag = async (item: (typeof items)[number]) => {
    const response = await fetch(`/api/products?slugs=${encodeURIComponent(item.slug)}`);
    const [product] = response.ok ? await response.json() as Product[] : [];
    if (!product) {
      return addToast("A selected product option is no longer available.", "error");
    }
    addToCart({
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      image: item.image,
      price: item.price,
      size: product.sizes[0] ?? ONE_SIZE,
      colour: product.colours[0]?.name ?? "",
      quantity: 1,
    });
    removeItem(item.productId);
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if ((await supabase.auth.getUser()).data.user) {
        await toggleWishlistAction(item.productId, false);
      }
    }
  };

  const handleRemove = async (productId: string) => {
    removeItem(productId);
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if ((await supabase.auth.getUser()).data.user) {
        const result = await toggleWishlistAction(productId, false);
        if (!result) addToast("Your changes could not be saved.", "error");
      }
    }
  };

  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Your Wishlist" }]} />
      <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] text-ink mt-3 mb-8">{"Your Wishlist"}</h1>

      {items.length === 0 ? (
        <EmptyState
          icon={Heart}
          heading={"Your wishlist is empty"}
          text={"Save items you love for later."}
          action={
            <Link href="/new-arrivals">
              <Button>{"Shop Now"}</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-10 md:gap-x-6 lg:gap-x-8">
          {items.map((item) => (
            <div key={item.productId} className="flex h-full flex-col">
              <Link href={`/product/${item.slug}`} className="relative aspect-[4/5] shrink-0 bg-beige mb-3 block">
                <Image src={item.image} alt={item.name} fill sizes="25vw" className="object-cover" />
              </Link>
              <div className="flex flex-1 flex-col">
                <Link href={`/product/${item.slug}`}>
                  <h3 className="text-sm text-ink hover:text-wine transition-colors line-clamp-2 min-h-[2.5rem] leading-snug">
                    {item.name}
                  </h3>
                </Link>
                <div className="mt-1.5">
                  <PriceDisplay price={item.price} previousPrice={item.previousPrice} />
                </div>
                <div className="flex flex-col gap-2 mt-auto pt-3">
                  <Button size="sm" onClick={() => handleMoveToBag(item)}>
                    {"Move to Bag"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void handleRemove(item.productId)}>
                    {"Remove"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Container>
  );
}
