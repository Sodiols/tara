"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requirePermission } from "../auth";
import { createClient } from "../server";
import type { ActionResult } from "./auth";
import { launchOfferSchema } from "@/lib/validation";
import { storeLocalToIso } from "@/lib/format";
import { logFailure } from "@/lib/logger";

/**
 * Managing the launch offer.
 *
 * Two actions, both behind `catalogue.manage` — the permission that already
 * decides what is for sale and at what price, which is precisely what a
 * campaign discount is.
 *
 * Neither writes the tables directly: both call a SECURITY DEFINER function
 * that re-checks the permission, re-checks the bounds on the discount, and
 * writes an entry to the admin audit log. What is validated here is validated
 * there too, and there is the one that counts.
 */

function fail(message: string, fieldErrors?: Record<string, string[]>): ActionResult {
  return { ok: false, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

/** Every surface that can show the offer, refreshed together. */
function revalidateOffer() {
  // The cached public read, so the storefront sees the change on the next
  // request rather than at the next deployment.
  updateTag("launch-offer");
  // Product cards carry a badge, so the catalogue payload is refreshed too.
  updateTag("catalogue");
  revalidatePath("/admin/launch-offer");
  revalidatePath("/", "layout");
}

export async function saveLaunchOfferAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("catalogue.manage");

  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const checkbox = (name: string) => {
    const value = formData.get(name);
    return value === "on" || value === "true" || value === "1";
  };

  const parsed = launchOfferSchema.safeParse({
    isEnabled: checkbox("isEnabled"),
    title: text("title"),
    description: text("description"),
    offerType: text("offerType"),
    appliesTo: text("appliesTo"),
    discountValue: text("discountValue"),
    minimumOrderAmount: text("minimumOrderAmount") || 0,
    giftDescription: text("giftDescription"),
    startsAt: text("startsAt"),
    endsAt: text("endsAt"),
  });

  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "Please check the highlighted fields.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_launch_offer", {
    p_offer: {
      isEnabled: parsed.data.isEnabled,
      title: parsed.data.title,
      description: parsed.data.description,
      offerType: parsed.data.offerType,
      appliesTo: parsed.data.appliesTo,
      discountValue: parsed.data.discountValue,
      minimumOrderAmount: parsed.data.minimumOrderAmount,
      giftDescription: parsed.data.giftDescription,
      // The form asks for a local date and time; the store runs on Asia/Dhaka,
      // and this is the same conversion coupons use, so "ends at midnight"
      // means the same thing on both screens.
      startsAt: storeLocalToIso(parsed.data.startsAt),
      endsAt: storeLocalToIso(parsed.data.endsAt),
    },
  });

  if (error) {
    if (error.message.includes("permission_denied")) {
      return fail("Your role does not allow this action.");
    }
    if (error.message.includes("invalid_discount_value")) {
      return fail("That discount is outside the allowed range.");
    }
    logFailure("admin.launch_offer_save", error);
    return fail("Could not save the launch offer.");
  }

  revalidateOffer();
  return {
    ok: true,
    message: parsed.data.isEnabled
      ? "Launch offer saved and live within its dates."
      : "Launch offer saved. It is switched off, so nothing is shown to customers.",
  };
}

/**
 * Replaces the participating set and the hero products in one call.
 *
 * Sent whole rather than a product at a time: "these are the campaign" is one
 * decision, and applying it row by row can leave a half-built campaign live.
 */
export async function setLaunchOfferProductsAction(
  productIds: string[],
  heroIds: string[],
): Promise<ActionResult> {
  await requirePermission("catalogue.manage");

  const parsed = z
    .object({
      productIds: z.array(z.string().uuid()).max(500),
      heroIds: z.array(z.string().uuid()).max(20),
    })
    .safeParse({ productIds, heroIds });
  if (!parsed.success) return fail("That product selection could not be read.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_launch_offer_products", {
    p_product_ids: parsed.data.productIds,
    p_hero_ids: parsed.data.heroIds,
  });

  if (error) {
    if (error.message.includes("permission_denied")) {
      return fail("Your role does not allow this action.");
    }
    if (error.message.includes("too_many_products")) {
      return fail("Choose 500 products or fewer.");
    }
    logFailure("admin.launch_offer_products", error);
    return fail("Could not save which products are in the campaign.");
  }

  revalidateOffer();
  const heroCount = parsed.data.heroIds.length;
  return {
    ok: true,
    message: `Campaign saved: ${parsed.data.productIds.length} product${
      parsed.data.productIds.length === 1 ? "" : "s"
    }, ${heroCount} hero product${heroCount === 1 ? "" : "s"}.`,
  };
}
