"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth";
import { createClient } from "../server";
import { reviewSchema } from "@/lib/validation";
import type { ActionResult } from "./auth";

export async function submitReviewAction(formData: FormData): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse({
    productId: String(formData.get("productId") ?? ""),
    orderItemId: String(formData.get("orderItemId") ?? ""),
    rating: Number(formData.get("rating")),
    title: String(formData.get("title") ?? ""),
    commentEn: String(formData.get("commentEn") ?? ""),
    commentBn: String(formData.get("commentBn") ?? ""),
  });
  if (!parsed.success) return { ok: false, message: "product.reviewInvalid" };
  const user = await requireUser("/account/orders");
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "auth.errors.notConfigured" };
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const { error } = await supabase.from("reviews").insert({
    product_id: parsed.data.productId,
    order_item_id: parsed.data.orderItemId,
    user_id: user.id,
    author_name: profile?.full_name || user.email || "TARA customer",
    rating: parsed.data.rating,
    title: parsed.data.title || null,
    comment_en: parsed.data.commentEn,
    comment_bn: parsed.data.commentBn || null,
    status: "pending",
  });
  if (error) {
    console.error("Review submission failed:", error.message);
    return { ok: false, message: "product.reviewFailed" };
  }
  revalidatePath("/account/orders");
  return { ok: true, message: "product.reviewSubmitted" };
}
