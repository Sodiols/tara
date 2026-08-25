"use server";

import { requireUser } from "../auth";
import { createClient } from "../server";
import { logFailure } from "@/lib/logger";
import type { WishlistItem } from "@/types";

/**
 * The wishlist reads only the columns the saved-items grid renders.
 *
 * It used to `select("*")` from products and product_images for every saved
 * item, which pulled descriptions, care instructions, SEO fields, the two jsonb
 * detail blobs and every image row across the wire to render a name, a price
 * and one thumbnail.
 */
const PRODUCT_COLUMNS = "id,slug,name_en,base_price,compare_at_price,status";

export async function syncWishlistAction(items: WishlistItem[]) {
  const user = await requireUser("/account");
  const supabase = await createClient();

  if (items.length) {
    const { error } = await supabase.from("wishlist_items").upsert(
      items.slice(0, 100).map((item) => ({ user_id: user.id, product_id: item.productId })),
      { onConflict: "user_id,product_id", ignoreDuplicates: true },
    );
    if (error) logFailure("wishlist.merge_failed", error, { userId: user.id });
  }

  const { data: saved } = await supabase
    .from("wishlist_items")
    .select("product_id")
    .eq("user_id", user.id);

  const ids = saved?.map((item) => item.product_id) ?? [];
  if (!ids.length) return { ok: true as const, items: [] as WishlistItem[] };

  const [{ data: products }, { data: images }] = await Promise.all([
    supabase.from("products").select(PRODUCT_COLUMNS).in("id", ids).eq("status", "active"),
    supabase
      .from("product_images")
      .select("product_id,image_url,is_primary,sort_order")
      .in("product_id", ids)
      .order("is_primary", { ascending: false })
      .order("sort_order"),
  ]);

  return {
    ok: true as const,
    items: (products ?? []).map((product) => ({
      productId: product.id,
      slug: product.slug,
      name: product.name_en,
      image: images?.find((image) => image.product_id === product.id)?.image_url ?? "",
      price: Number(product.base_price),
      previousPrice:
        product.compare_at_price == null ? undefined : Number(product.compare_at_price),
    })),
  };
}

export async function toggleWishlistAction(productId: string, add: boolean) {
  const user = await requireUser("/account/wishlist");
  const supabase = await createClient();

  const query = add
    ? supabase
        .from("wishlist_items")
        .upsert({ user_id: user.id, product_id: productId }, { onConflict: "user_id,product_id" })
    : supabase
        .from("wishlist_items")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);

  const { error } = await query;
  if (error) {
    logFailure("wishlist.toggle_failed", error, { userId: user.id, productId, add });
    return false;
  }
  return true;
}
