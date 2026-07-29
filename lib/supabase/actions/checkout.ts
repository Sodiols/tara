"use server";

import { z } from "zod";
import { createClient } from "../server";
import { checkoutSchema } from "@/lib/validation";
import type { CartItem } from "@/types";
import type { ActionResult } from "./auth";
import { isSupabaseConfigured } from "../env";

const checkoutInput = checkoutSchema.omit({ items: true }).extend({
  items: z.array(z.object({
    productId: z.string().uuid(),
    size: z.string().min(1),
    colour: z.string().min(1),
    quantity: z.number().int().min(1).max(20),
  })).min(1),
});

type OrderResult = { orderNumber: string; trackingToken: string; total: number };

export async function placeOrderAction(input: unknown): Promise<ActionResult<OrderResult>> {
  const parsed = checkoutInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "checkout.errors.invalidForm", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  if (!isSupabaseConfigured())
    return { ok: false, message: "auth.errors.notConfigured" };
  const supabase = await createClient();

  const resolved: { variantId: string; quantity: number }[] = [];
  for (const item of parsed.data.items) {
    const { data: variant } = await supabase
      .from("product_variants")
      .select("id")
      .eq("product_id", item.productId)
      .eq("size", item.size.replaceAll("Undready", "Unstitched"))
      .eq("colour_en", item.colour)
      .eq("is_active", true)
      .maybeSingle();
    if (!variant) return { ok: false, message: "checkout.errors.invalidVariant" };
    resolved.push({ variantId: variant.id, quantity: item.quantity });
  }

  const { data, error } = await supabase.rpc("place_order", {
    p_customer: {
      name: parsed.data.customerName,
      email: parsed.data.customerEmail ?? "",
      phone: parsed.data.customerPhone,
    },
    p_shipping_address: parsed.data.shippingAddress,
    p_items: resolved,
    p_delivery_method: parsed.data.deliveryMethod,
    p_payment_method: parsed.data.paymentMethod,
    p_coupon_code: parsed.data.couponCode || null,
    p_customer_note: parsed.data.customerNote || null,
  });
  if (error) {
    console.error("Order placement failed:", error.message);
    if (error.message.includes("out_of_stock")) return { ok: false, message: "checkout.errors.outOfStock" };
    if (error.message.includes("invalid_coupon")) return { ok: false, message: "checkout.errors.invalidCoupon" };
    return { ok: false, message: "checkout.errors.orderFailed" };
  }
  const result = data as unknown as OrderResult;
  return { ok: true, data: result };
}

export async function placeCartOrderAction(
  details: Omit<z.infer<typeof checkoutInput>, "items">,
  items: CartItem[],
) {
  return placeOrderAction({ ...details, items });
}

type CouponPreview = { discount: number; reason?: undefined } | { discount: 0; reason: string };

export async function previewCouponAction(code: string, subtotal: number): Promise<ActionResult<CouponPreview>> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, message: "bag.errors.couponRequired" };
  if (!isSupabaseConfigured()) return { ok: false, message: "auth.errors.notConfigured" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_coupon", {
    p_code: trimmed,
    p_subtotal: subtotal,
  });
  if (error) {
    console.error("Coupon preview failed:", error.message);
    return { ok: false, message: "bag.errors.couponFailed" };
  }
  const result = data as { valid: boolean; discount?: number; reason?: string; minimum?: number };
  if (!result.valid) {
    if (result.reason === "minimum_not_met") {
      return { ok: false, message: "bag.errors.couponMinimum" };
    }
    return { ok: false, message: "bag.errors.couponInvalid" };
  }
  return { ok: true, data: { discount: result.discount ?? 0 } };
}

export async function trackGuestOrderAction(orderNumber: string, trackingToken: string) {
  if (!isSupabaseConfigured())
    return { ok: false as const, message: "auth.errors.notConfigured" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_guest_order_tracking", {
    p_order_number: orderNumber.trim(),
    p_tracking_token: trackingToken.trim(),
  });
  if (error || !data) return { ok: false as const, message: "account.trackingNotFound" };
  return { ok: true as const, data };
}
