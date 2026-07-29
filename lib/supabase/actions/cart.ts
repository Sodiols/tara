"use server";

import { requireUser } from "../auth";
import { createClient } from "../server";
import type { CartItem } from "@/types";

async function resolveCartRows(items: CartItem[]) {
  const supabase = await createClient();
  if (!supabase) return [];
  const rows: { product_variant_id: string; quantity: number }[] = [];

  for (const item of items.slice(0, 100)) {
    const { data: variant } = await supabase
      .from("product_variants")
      .select("id,stock_quantity")
      .eq("product_id", item.productId)
      .eq("size", item.size.replaceAll("Undready", "Unstitched"))
      .eq("colour_en", item.colour)
      .eq("is_active", true)
      .maybeSingle();
    if (!variant || variant.stock_quantity < 1) continue;
    rows.push({
      product_variant_id: variant.id,
      quantity: Math.min(20, variant.stock_quantity, Math.max(1, item.quantity)),
    });
  }

  return rows;
}

export async function persistCartAction(items: CartItem[]) {
  const user = await requireUser("/account");
  const supabase = await createClient();
  if (!supabase) return { ok: false as const };
  const { data: cart } = await supabase.from("carts").select("id").eq("user_id", user.id).single();
  if (!cart) return { ok: false as const };

  const rows = await resolveCartRows(items);
  const { error: deleteError } = await supabase.from("cart_items").delete().eq("cart_id", cart.id);
  if (deleteError) return { ok: false as const };
  if (!rows.length) return { ok: true as const };

  const { error } = await supabase.from("cart_items").insert(
    rows.map((row) => ({ ...row, cart_id: cart.id }))
  );
  return { ok: !error };
}

export async function syncCartAction(items: CartItem[]) {
  const user = await requireUser("/account");
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, items: [] as CartItem[] };
  const { data: cart } = await supabase.from("carts").select("id").eq("user_id", user.id).single();
  if (!cart) return { ok: false as const, items: [] as CartItem[] };

  const rows = await resolveCartRows(items);
  for (const row of rows) {
    const { data: existing } = await supabase
      .from("cart_items")
      .select("id,quantity")
      .eq("cart_id", cart.id)
      .eq("product_variant_id", row.product_variant_id)
      .maybeSingle();
    if (existing) {
      await supabase.from("cart_items").update({ quantity: Math.min(20, existing.quantity + row.quantity) }).eq("id", existing.id);
    } else {
      await supabase.from("cart_items").insert({ cart_id: cart.id, ...row });
    }
  }

  const { data: dbItems } = await supabase.from("cart_items").select("*").eq("cart_id", cart.id);
  if (!dbItems?.length) return { ok: true as const, items: [] as CartItem[] };
  const variantIds = dbItems.map((item) => item.product_variant_id);
  const { data: variants } = await supabase.from("product_variants").select("*").in("id", variantIds);
  const productIds = [...new Set((variants ?? []).map((variant) => variant.product_id))];
  const [{ data: products }, { data: images }] = await Promise.all([
    supabase.from("products").select("*").in("id", productIds),
    supabase.from("product_images").select("*").in("product_id", productIds).order("sort_order"),
  ]);
  const hydrated = dbItems.flatMap((dbItem) => {
    const variant = variants?.find((value) => value.id === dbItem.product_variant_id);
    const product = products?.find((value) => value.id === variant?.product_id);
    if (!variant || !product) return [];
    return [{
      productId: product.id,
      slug: product.slug,
      name: { en: product.name_en, bn: product.name_bn },
      image: images?.find((image) => image.product_id === product.id)?.image_url ?? "",
      price: Number(variant.price_override ?? product.base_price),
      size: variant.size,
      colour: variant.colour_en,
      quantity: dbItem.quantity,
    }];
  });
  return { ok: true as const, items: hydrated };
}
