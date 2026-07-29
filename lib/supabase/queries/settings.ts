import "server-only";

import { createClient } from "../server";
import { isSupabaseConfigured } from "../env";

export interface DeliverySettings {
  freeDeliveryThreshold: number;
  standardDeliveryFee: number;
  expressDeliveryFee: number;
}

// Matches the defaults `place_order()` falls back to in
// supabase/TARA_COMPLETE_SETUP.sql when a store_settings row is missing, so
// the storefront never shows a delivery fee that diverges from what the
// server actually charges.
const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  freeDeliveryThreshold: 1500,
  standardDeliveryFee: 100,
  expressDeliveryFee: 180,
};

export async function getDeliverySettings(): Promise<DeliverySettings> {
  if (!isSupabaseConfigured()) return DEFAULT_DELIVERY_SETTINGS;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_settings")
    .select("key,value")
    .in("key", ["free_delivery_threshold", "standard_delivery_fee", "express_delivery_fee"]);
  if (error || !data) return DEFAULT_DELIVERY_SETTINGS;

  const byKey = new Map(data.map((row) => [row.key, row.value]));
  const numeric = (key: string, fallback: number) => {
    const value = byKey.get(key);
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    freeDeliveryThreshold: numeric("free_delivery_threshold", DEFAULT_DELIVERY_SETTINGS.freeDeliveryThreshold),
    standardDeliveryFee: numeric("standard_delivery_fee", DEFAULT_DELIVERY_SETTINGS.standardDeliveryFee),
    expressDeliveryFee: numeric("express_delivery_fee", DEFAULT_DELIVERY_SETTINGS.expressDeliveryFee),
  };
}
