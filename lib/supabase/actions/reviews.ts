"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "../auth";
import { createClient } from "../server";
import { isSupabaseConfigured } from "../env";
import { reviewSchema } from "@/lib/validation";
import { logFailure } from "@/lib/logger";
import type { ActionResult } from "./auth";

export type ReviewEligibility =
  | { authenticated: false; eligible: false; reason: "sign_in" }
  | {
      authenticated: true;
      eligible: false;
      reason: "not_eligible" | "already_reviewed";
    }
  | { authenticated: true; eligible: true };

function parseEligibility(value: unknown): ReviewEligibility {
  if (!value || typeof value !== "object") {
    return { authenticated: true, eligible: false, reason: "not_eligible" };
  }
  const row = value as Record<string, unknown>;
  if (row.eligible === true) return { authenticated: true, eligible: true };
  return {
    authenticated: true,
    eligible: false,
    reason: row.reason === "already_reviewed" ? "already_reviewed" : "not_eligible",
  };
}

/** Resolve eligibility from authenticated orders, never browser-supplied order ids. */
export async function getReviewEligibilityAction(productId: string): Promise<ReviewEligibility> {
  const user = await getUser();
  if (!user) return { authenticated: false, eligible: false, reason: "sign_in" };
  if (!isSupabaseConfigured()) {
    return { authenticated: true, eligible: false, reason: "not_eligible" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_eligibility", {
    p_product_id: productId,
  });
  if (error) {
    logFailure("review.eligibility_failed", error, { productId, userId: user.id });
    return { authenticated: true, eligible: false, reason: "not_eligible" };
  }
  return parseEligibility(data);
}

/** Submit a pending review through the database's verified-purchase resolver. */
export async function submitReviewAction(input: unknown): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Check your review and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const user = await getUser();
  if (!user) return { ok: false, message: "Please sign in to review a product you purchased." };
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase has not been configured yet." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_verified_review", {
    p_product_id: parsed.data.productId,
    p_rating: parsed.data.rating,
    p_title: parsed.data.title ?? "",
    p_comment: parsed.data.commentEn,
  });

  if (error) {
    logFailure("review.submit_failed", error, {
      userId: user.id,
      productId: parsed.data.productId,
    });
    return { ok: false, message: "Your review could not be submitted." };
  }

  const result = (data ?? {}) as Record<string, unknown>;
  if (result.ok !== true) {
    return {
      ok: false,
      message:
        result.reason === "already_reviewed"
          ? "You have already reviewed this purchase."
          : "Reviews are available to customers who purchased and received this product.",
    };
  }

  revalidatePath("/admin/reviews");
  revalidatePath("/account/orders");
  revalidatePath("/product/[slug]", "page");
  return { ok: true, message: "Thank you. Your review has been submitted for approval." };
}
