"use client";

import { Heart } from "lucide-react";
import { useWishlistStore } from "@/store/wishlistStore";
import { useToastStore } from "@/store/toastStore";
import { useHasMounted } from "@/hooks/useHasMounted";
import type { Product } from "@/types";
import { cn } from "@/lib/utils";
import { toggleWishlistAction } from "@/lib/supabase/actions/wishlist";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface WishlistButtonProps {
  product: Product;
  className?: string;
}

export function WishlistButton({ product, className }: WishlistButtonProps) {
  const { isInWishlist, toggleItem } = useWishlistStore();
  const { addToast } = useToastStore();
  const hasMounted = useHasMounted();
  const active = hasMounted && isInWishlist(product.id);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.images[0],
      price: product.price,
      previousPrice: product.previousPrice,
    });
    const user = isSupabaseConfigured()
      ? (await (await import("@/lib/supabase/client")).createClient().auth.getUser()).data.user
      : null;
    if (user) {
      const saved = await toggleWishlistAction(product.id, !active);
      if (!saved) {
        toggleItem({
          productId: product.id,
          slug: product.slug,
          name: product.name,
          image: product.images[0],
          price: product.price,
          previousPrice: product.previousPrice,
        });
        addToast("Wishlist could not be updated");
        return;
      }
    }
    addToast(
      active
        ? ("Removed from wishlist")
        : ("Added to wishlist")
    );
  };

  return (
    <button
      onClick={handleClick}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={active}
      className={cn(
        "p-2 bg-white/90 hover:bg-white transition-colors rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        className
      )}
    >
      <Heart
        size={18}
        className={active ? "fill-wine text-wine" : "text-ink"}
      />
    </button>
  );
}
