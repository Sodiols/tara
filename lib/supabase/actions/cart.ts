"use server";

import { requireUser } from "../auth";
import { createClient } from "../server";
import { logFailure } from "@/lib/logger";
import type { CartItem } from "@/types";

/**
 * Server-side cart persistence.
 *
 * Both operations are a single database call into a SECURITY DEFINER function
 * that resolves every line, validates it and swaps the contents inside one
 * transaction.
 *
 * What this replaced mattered: `persistCartAction` used to DELETE every row and
 * then INSERT the replacement set as two separate statements, so a failure
 * between them left a signed-in customer with an empty cart and no way to tell
 * what had been in it. It also issued one SELECT per line to resolve the
 * variant, which on a twenty-line cart was twenty round trips before the write
 * even started.
 */

function toCartItems(payload: unknown): CartItem[] {
  if (!Array.isArray(payload)) return [];

  return payload.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const productId = typeof row.productId === "string" ? row.productId : null;
    const slug = typeof row.slug === "string" ? row.slug : null;
    if (!productId || !slug) return [];

    return [
      {
        productId,
        slug,
        name: typeof row.name === "string" ? row.name : "",
        image: typeof row.image === "string" ? row.image : "",
        price: typeof row.price === "number" ? row.price : Number(row.price) || 0,
        size: typeof row.size === "string" ? row.size : "",
        colour: typeof row.colour === "string" ? row.colour : "",
        quantity:
          typeof row.quantity === "number" ? row.quantity : Number(row.quantity) || 1,
      },
    ];
  });
}

/** The lines the database needs. Prices and names are never trusted from here. */
function toPayload(items: CartItem[]) {
  return items.slice(0, 100).map((item) => ({
    productId: item.productId,
    size: item.size,
    colour: item.colour,
    quantity: item.quantity,
  }));
}

/** Replaces the stored cart with exactly what the browser is holding. */
export async function persistCartAction(items: CartItem[]) {
  const user = await requireUser("/account");
  const supabase = await createClient();

  const { error } = await supabase.rpc("replace_cart_items", {
    p_items: toPayload(items),
  });

  if (error) {
    logFailure("cart.persist_failed", error, { userId: user.id, lines: items.length });
    return { ok: false as const };
  }
  return { ok: true as const };
}

/**
 * Merges a guest's local cart into the stored one at sign-in and returns the
 * result, so the browser adopts the server's view rather than its own.
 */
export async function syncCartAction(items: CartItem[]) {
  const user = await requireUser("/account");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("merge_cart_items", {
    p_items: toPayload(items),
  });

  if (error) {
    logFailure("cart.sync_failed", error, { userId: user.id, lines: items.length });
    return { ok: false as const, items: [] as CartItem[] };
  }

  return { ok: true as const, items: toCartItems(data) };
}
