import type { Metadata } from "next";
import { WishlistClient } from "@/components/cart/WishlistClient";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "View and manage the products you have saved to your TARA wishlist.",
};

export default function WishlistPage() {
  return <WishlistClient />;
}
