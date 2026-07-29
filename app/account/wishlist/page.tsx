import { requireUser } from "@/lib/supabase/auth";
import { WishlistClient } from "@/components/cart/WishlistClient";

export default async function AccountWishlistPage() {
  await requireUser("/account/wishlist");
  return <WishlistClient />;
}
