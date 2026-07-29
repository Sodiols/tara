"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useWishlistStore } from "@/store/wishlistStore";
import { useCartStore } from "@/store/cartStore";
import { useToastStore } from "@/store/toastStore";
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
  const { t, pick } = useLanguage();
  const { items, removeItem } = useWishlistStore();
  const addItem = useCartStore((s) => s.addItem);
  const { addToast } = useToastStore();

  const handleMoveToBag = async (item: (typeof items)[number]) => {
    const response = await fetch(`/api/products?slugs=${encodeURIComponent(item.slug)}`);
    const [product] = response.ok ? await response.json() as Product[] : [];
    if (!product) return addToast(t("checkout.errors.invalidVariant"));
    addItem({
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      image: item.image,
      price: item.price,
      size: product.sizes[0] ?? "One Size",
      colour: product.colours[0]?.name.en ?? "",
      quantity: 1,
    });
    removeItem(item.productId);
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if ((await supabase.auth.getUser()).data.user) {
        await toggleWishlistAction(item.productId, false);
      }
    }
    addToast(t("common.addToBag"));
  };

  const handleRemove = async (productId: string) => {
    removeItem(productId);
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if ((await supabase.auth.getUser()).data.user) {
        const result = await toggleWishlistAction(productId, false);
        if (!result) addToast(t("account.errors.saveFailed"));
      }
    }
  };

  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: t("wishlist.heading") }]} />
      <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] text-ink mt-3 mb-8">{t("wishlist.heading")}</h1>

      {items.length === 0 ? (
        <EmptyState
          icon={Heart}
          heading={t("wishlist.empty")}
          text={t("wishlist.emptyText")}
          action={
            <Link href="/new-arrivals">
              <Button>{t("common.shopNow")}</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-10 md:gap-x-6 lg:gap-x-8">
          {items.map((item) => (
            <div key={item.productId} className="flex h-full flex-col">
              <Link href={`/product/${item.slug}`} className="relative aspect-[4/5] shrink-0 bg-beige mb-3 block">
                <Image src={item.image} alt={pick(item.name)} fill sizes="25vw" className="object-cover" />
              </Link>
              <div className="flex flex-1 flex-col">
                <Link href={`/product/${item.slug}`}>
                  <h3 className="text-sm text-ink hover:text-wine transition-colors line-clamp-2 min-h-[2.5rem] leading-snug">
                    {pick(item.name)}
                  </h3>
                </Link>
                <div className="mt-1.5">
                  <PriceDisplay price={item.price} previousPrice={item.previousPrice} />
                </div>
                <div className="flex flex-col gap-2 mt-auto pt-3">
                  <Button size="sm" onClick={() => handleMoveToBag(item)}>
                    {t("wishlist.moveToBag")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void handleRemove(item.productId)}>
                    {t("wishlist.remove")}
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
