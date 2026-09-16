import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicServerClient } from "../public-server";
import { createClient } from "../server";
import { requirePermission } from "../auth";
import { isSupabaseConfigured } from "../env";
import type { LaunchOffer } from "@/lib/launch-offer";
import type { LaunchOfferScope, LaunchOfferType, Tables } from "@/types/database";

/**
 * Reading the launch offer.
 *
 * The public read goes through `active_launch_offer()`, which answers null
 * unless the offer is switched on AND inside its dates — so an offer being
 * drafted and one that expired last night are both invisible here, and neither
 * the cache nor a component has to know the rule.
 *
 * Cached the same way the store settings are, and tagged, so switching the
 * offer on in the back office reaches the storefront on the next request rather
 * than at the next deployment.
 */

const OFFER_TYPES: LaunchOfferType[] = [
  "free_delivery",
  "percentage",
  "fixed_amount",
  "first_order",
  "gift",
];

function asOffer(value: unknown): LaunchOffer | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;

  const offerType = OFFER_TYPES.includes(row.offerType as LaunchOfferType)
    ? (row.offerType as LaunchOfferType)
    : null;
  if (!offerType) return null;

  const appliesTo: LaunchOfferScope =
    row.appliesTo === "site_wide" ? "site_wide" : "selected_products";

  const asString = (input: unknown) => (typeof input === "string" ? input : "");
  const asNumber = (input: unknown) => {
    const parsed = typeof input === "number" ? input : Number(input);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const asIdList = (input: unknown) =>
    Array.isArray(input) ? input.filter((entry): entry is string => typeof entry === "string") : [];

  return {
    title: asString(row.title),
    description: asString(row.description),
    offerType,
    appliesTo,
    discountValue: row.discountValue == null ? null : asNumber(row.discountValue),
    minimumOrderAmount: asNumber(row.minimumOrderAmount),
    giftDescription: asString(row.giftDescription),
    startsAt: typeof row.startsAt === "string" ? row.startsAt : null,
    endsAt: typeof row.endsAt === "string" ? row.endsAt : null,
    productIds: asIdList(row.productIds),
    heroSlugs: asIdList(row.heroSlugs),
  };
}

const readActiveLaunchOffer = unstable_cache(
  async (): Promise<LaunchOffer | null> => {
    if (!isSupabaseConfigured()) return null;
    const supabase = createPublicServerClient();
    const { data, error } = await supabase.rpc("active_launch_offer");
    // A failure means no offer is shown. Announcing a campaign the database
    // could not confirm is the one outcome worth avoiding here.
    if (error) return null;
    return asOffer(data);
  },
  ["active-launch-offer-v1"],
  // Short, because a campaign switched off is a promise that must stop being
  // made quickly. The tag makes the admin panel's change immediate anyway.
  { revalidate: 60, tags: ["launch-offer"] },
);

/** Deduplicated per render, shared between requests by the data cache. */
export const getActiveLaunchOffer = cache(readActiveLaunchOffer);

export interface LaunchOfferAdminData {
  offer: Tables<"launch_offer">;
  /** Every active product, so the campaign can be assembled in one screen. */
  products: { id: string; name_en: string; product_code: string; slug: string }[];
  participating: { product_id: string; is_hero: boolean }[];
}

/**
 * The offer as an administrator edits it — including a disabled one, and one
 * whose dates have passed.
 *
 * `catalogue.manage`, the same permission that decides what is for sale and at
 * what price, because that is exactly what this is.
 */
export async function getLaunchOfferAdminData(): Promise<LaunchOfferAdminData | null> {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();

  const [offer, products, participating] = await Promise.all([
    supabase.from("launch_offer").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("products")
      .select("id,name_en,product_code,slug")
      .eq("status", "active")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("launch_offer_products").select("product_id,is_hero"),
  ]);

  if (!offer.data) return null;

  return {
    offer: offer.data,
    products: products.data ?? [],
    participating: participating.data ?? [],
  };
}
