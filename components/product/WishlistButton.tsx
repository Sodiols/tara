"use client";

import { Heart } from "lucide-react";
import { useWishlistStore } from "@/store/wishlistStore";
import { useToastStore } from "@/store/toastStore";
import { useHasMounted } from "@/hooks/useHasMounted";
import type { Product } from "@/types";
import { cn } from "@/lib/utils";
import { toggleWishlistAction } from "@/lib/supabase/actions/wishlist";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Appearance presets.
 *
 * These exist because `cn()` in this project is a plain join, not a Tailwind
 * class merger: passing `bg-taraIvory` alongside a built-in `bg-white/90`
 * leaves both in the attribute and lets stylesheet order decide the winner.
 * The product page was working around that with `!important` prefixes. A named
 * variant means each caller gets one coherent set of classes instead.
 *
 *   card    a floating circle beside the product title in a listing card
 *   detail  the bordered control next to "Wishlist" on the product page
 */
type WishlistVariant = "card" | "detail";

const variantClasses: Record<WishlistVariant, string> = {
  card:
    "h-9 w-9 rounded-full border border-taraTaupe/25 bg-taraIvory shadow-[0_2px_8px_-5px_rgb(23_23_23/0.3)] hover:bg-taraWhite sm:h-10 sm:w-10",
  detail:
    "rounded-control border border-border bg-transparent p-3 hover:border-wine",
};

interface WishlistButtonProps {
  product: Product;
  variant?: WishlistVariant;
  /** Positioning only — appearance comes from the variant. */
  className?: string;
}

export function WishlistButton({
  product,
  variant = "card",
  className,
}: WishlistButtonProps) {
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
        "inline-flex shrink-0 items-center justify-center transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine",
        variantClasses[variant],
        className,
      )}
    >
      <Heart
        size={variant === "card" ? 17 : 18}
        aria-hidden="true"
        className={active ? "fill-wine text-wine" : "text-wine"}
      />
    </button>
  );
}
