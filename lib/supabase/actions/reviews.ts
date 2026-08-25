"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth";
import { createClient } from "../server";
import { reviewSchema } from "@/lib/validation";
import { logFailure } from "@/lib/logger";
import type { ActionResult } from "./auth";

export async function submitReviewAction(formData: FormData): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse({
    productId: String(formData.get("productId") ?? ""),
    orderItemId: String(formData.get("orderItemId") ?? ""),
    rating: Number(formData.get("rating")),
    title: String(formData.get("title") ?? ""),
    commentEn: String(formData.get("commentEn") ?? ""),
  });
  if (!parsed.success) return { ok: false, message: "Check your review and try again." };
  const user = await requireUser("/account/orders");
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Supabase has not been configured yet." };
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const { error } = await supabase.from("reviews").insert({
    product_id: parsed.data.productId,
    order_item_id: parsed.data.orderItemId,
    user_id: user.id,
    author_name: profile?.full_name || user.email || "TARA customer",
    rating: parsed.data.rating,
    title: parsed.data.title || null,
    comment_en: parsed.data.commentEn,
    status: "pending",
  });
  if (error) {
    logFailure("review.submit_failed", error, { userId: user.id, productId: parsed.data.productId });
    return { ok: false, message: "Your review could not be submitted." };
  }
  revalidatePath("/account/orders");
  return { ok: true, message: "Your review was submitted for approval." };
}
