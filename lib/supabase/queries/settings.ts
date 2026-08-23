import "server-only";

import { cache } from "react";
import { createClient } from "../server";
import { isSupabaseConfigured } from "../env";

export interface DeliverySettings {
  freeDeliveryThreshold: number;
  standardDeliveryFee: number;
}

export interface PublicStoreSettings extends DeliverySettings {
  storeName: string;
  supportPhone: string;
  whatsappNumber: string;
  supportEmail: string;
  storeAddress: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  codEnabled: boolean;
  maintenanceMode: boolean;
}

// Matches the defaults `place_order()` falls back to in
// supabase/migrations/0002_production_hardening.sql when a store_settings row
// is missing, so the storefront never shows a delivery fee that diverges from
// what the server actually charges.
const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  freeDeliveryThreshold: 1500,
  standardDeliveryFee: 100,
};

const DEFAULTS: PublicStoreSettings = {
  ...DEFAULT_DELIVERY_SETTINGS,
  storeName: "TARA",
  // Contact details deliberately default to empty rather than to a plausible
  // looking placeholder. A blank phone number is obviously unfinished; a fake
  // one can silently reach production and lose real customers.
  supportPhone: "",
  whatsappNumber: "",
  supportEmail: "",
  storeAddress: "",
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  codEnabled: true,
  maintenanceMode: false,
};

/**
 * Reads every world-readable settings row in one query.
 *
 * Only rows flagged `is_public` in the database are visible to anon, so a
 * private key such as the internal order notification inbox can never be
 * reached from here or from a browser.
 *
 * Cached per render pass: the header, footer, checkout and invoice all want
 * these values, and one round trip is enough.
 */
export const getPublicStoreSettings = cache(async (): Promise<PublicStoreSettings> => {
  if (!isSupabaseConfigured()) return DEFAULTS;

  const supabase = await createClient();
  const { data, error } = await supabase.from("store_settings").select("key,value");
  if (error || !data) return DEFAULTS;

  const byKey = new Map(data.map((row) => [row.key, row.value]));

  const asNumber = (key: string, fallback: number) => {
    const value = byKey.get(key);
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const asString = (key: string, fallback: string) => {
    const value = byKey.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  };
  const asBoolean = (key: string, fallback: boolean) => {
    const value = byKey.get(key);
    return typeof value === "boolean" ? value : fallback;
  };

  return {
    freeDeliveryThreshold: asNumber("free_delivery_threshold", DEFAULTS.freeDeliveryThreshold),
    standardDeliveryFee: asNumber("standard_delivery_fee", DEFAULTS.standardDeliveryFee),
    storeName: asString("store_name", DEFAULTS.storeName),
    supportPhone: asString("support_phone", DEFAULTS.supportPhone),
    whatsappNumber: asString("whatsapp_number", DEFAULTS.whatsappNumber),
    supportEmail: asString("support_email", DEFAULTS.supportEmail),
    storeAddress: asString("store_address", DEFAULTS.storeAddress),
    facebookUrl: asString("facebook_url", DEFAULTS.facebookUrl),
    instagramUrl: asString("instagram_url", DEFAULTS.instagramUrl),
    tiktokUrl: asString("tiktok_url", DEFAULTS.tiktokUrl),
    codEnabled: asBoolean("cod_enabled", DEFAULTS.codEnabled),
    maintenanceMode: asBoolean("maintenance_mode", DEFAULTS.maintenanceMode),
  };
});

export async function getDeliverySettings(): Promise<DeliverySettings> {
  const settings = await getPublicStoreSettings();
  return {
    freeDeliveryThreshold: settings.freeDeliveryThreshold,
    standardDeliveryFee: settings.standardDeliveryFee,
  };
}
