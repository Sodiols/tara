"use server";

import { requireUser } from "../auth";
import { createClient } from "../server";
import type { WishlistItem } from "@/types";

export async function syncWishlistAction(items: WishlistItem[]) {
  const user = await requireUser("/account");
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, items: [] as WishlistItem[] };
  if (items.length) {
    await supabase.from("wishlist_items").upsert(
      items.slice(0, 100).map((item) => ({ user_id: user.id, product_id: item.productId })),
      { onConflict: "user_id,product_id", ignoreDuplicates: true },
    );
  }
  const { data: saved } = await supabase.from("wishlist_items").select("*").eq("user_id", user.id);
  const ids = saved?.map((item) => item.product_id) ?? [];
  if (!ids.length) return { ok: true as const, items: [] as WishlistItem[] };
  const [{ data: products }, { data: images }] = await Promise.all([
    supabase.from("products").select("*").in("id", ids),
    supabase.from("product_images").select("*").in("product_id", ids).order("sort_order"),
  ]);
  return {
    ok: true as const,
    items: (products ?? []).map((product) => ({
      productId: product.id,
      slug: product.slug,
      name: product.name_en,
      image: images?.find((image) => image.product_id === product.id)?.image_url ?? "",
      price: Number(product.base_price),
      previousPrice: product.compare_at_price == null ? undefined : Number(product.compare_at_price),
    })),
  };
}

export async function toggleWishlistAction(productId: string, add: boolean) {
  const user = await requireUser("/account/wishlist");
  const supabase = await createClient();
  if (!supabase) return false;
  const query = add
    ? supabase.from("wishlist_items").upsert({ user_id: user.id, product_id: productId }, { onConflict: "user_id,product_id" })
    : supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", productId);
  const { error } = await query;
  return !error;
}
