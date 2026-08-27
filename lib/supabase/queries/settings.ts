import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicServerClient } from "../public-server";
import { isSupabaseConfigured } from "../env";
import { siteConfig } from "@/data/site";
import {
  DEFAULT_DELIVERY_SETTINGS,
  type DeliverySettings,
} from "@/lib/delivery";
import { resolveDivision } from "@/data/bangladesh-geography";

export type { DeliverySettings };

/**
 * Everything the storefront is allowed to know about the shop.
 *
 * This is the ONE place business information is resolved. The footer, the
 * contact page, the navigation, the organisation structured data, the checkout,
 * the invoice and the packing slip all read from here, so an edit in
 * /admin/settings reaches every one of them on the next request. Nothing that a
 * shop owner can change is duplicated as a constant in a component.
 */
export interface StoreIdentity {
  storeName: string;
  supportPhone: string;
  whatsappNumber: string;
  supportEmail: string;
  storeAddress: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
}

export interface PublicStoreSettings extends StoreIdentity {
  delivery: DeliverySettings;
  codEnabled: boolean;
  maintenanceMode: boolean;
}

/**
 * Fallbacks, not placeholders.
 *
 * The phone number, WhatsApp number and support email default to empty on
 * purpose: a blank contact detail is obviously unfinished and every component
 * hides it, whereas an invented one reaches production and quietly loses real
 * customers. The social URLs and the showroom address default to the real
 * values in data/site.ts, because those are facts about the business that
 * predate the settings table rather than things nobody has filled in yet.
 */
const DEFAULTS: PublicStoreSettings = {
  storeName: siteConfig.name,
  supportPhone: "",
  whatsappNumber: "",
  supportEmail: "",
  storeAddress: siteConfig.address,
  facebookUrl: siteConfig.facebook,
  instagramUrl: siteConfig.instagram,
  tiktokUrl: siteConfig.tiktok,
  delivery: DEFAULT_DELIVERY_SETTINGS,
  codEnabled: true,
  maintenanceMode: false,
};

/**
 * Reads every world-readable settings row in one query.
 *
 * Only rows flagged `is_public` in the database are visible to anon, so a
 * private value such as the internal order notification inbox can never be
 * reached from here or from a browser.
 *
 * Cached per render pass: the header, footer, checkout and invoice all want
 * these values, and one round trip is enough for all of them.
 */
const readPublicStoreSettings = unstable_cache(async (): Promise<PublicStoreSettings> => {
  if (!isSupabaseConfigured()) return DEFAULTS;

  const supabase = createPublicServerClient();
  const { data, error } = await supabase.from("store_settings").select("key,value");
  if (error || !data) return DEFAULTS;

  const byKey = new Map(data.map((row) => [row.key, row.value]));

  const asNumber = (key: string, fallback: number) => {
    const value = byKey.get(key);
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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
    storeName: asString("store_name", DEFAULTS.storeName),
    supportPhone: asString("support_phone", DEFAULTS.supportPhone),
    whatsappNumber: asString("whatsapp_number", DEFAULTS.whatsappNumber),
    supportEmail: asString("support_email", DEFAULTS.supportEmail),
    storeAddress: asString("store_address", DEFAULTS.storeAddress),
    facebookUrl: asString("facebook_url", DEFAULTS.facebookUrl),
    instagramUrl: asString("instagram_url", DEFAULTS.instagramUrl),
    tiktokUrl: asString("tiktok_url", DEFAULTS.tiktokUrl),
    delivery: {
      insideFee: asNumber("delivery_fee_inside_sylhet", DEFAULT_DELIVERY_SETTINGS.insideFee),
      outsideFee: asNumber("delivery_fee_outside_sylhet", DEFAULT_DELIVERY_SETTINGS.outsideFee),
      freeDeliveryThreshold: asNumber(
        "free_delivery_threshold",
        DEFAULT_DELIVERY_SETTINGS.freeDeliveryThreshold,
      ),
      freeDeliveryEnabled: asBoolean(
        "free_delivery_enabled",
        DEFAULT_DELIVERY_SETTINGS.freeDeliveryEnabled,
      ),
      // A division name typed into the settings table is still only valid if it
      // is a real division; an unrecognised one falls back rather than creating
      // a rule that can never match and so silently charges everyone.
      freeDeliveryDivision:
        resolveDivision(asString("free_delivery_division", "")) ??
        DEFAULT_DELIVERY_SETTINGS.freeDeliveryDivision,
    },
    codEnabled: asBoolean("cod_enabled", DEFAULTS.codEnabled),
    maintenanceMode: asBoolean("maintenance_mode", DEFAULTS.maintenanceMode),
  };
}, ["public-store-settings-v1"], {
  revalidate: 60,
  tags: ["store-settings"],
});

// React cache deduplicates callers inside one render; the Next data cache
// shares the same public result across requests and server instances.
export const getPublicStoreSettings = cache(readPublicStoreSettings);

export async function getDeliverySettings(): Promise<DeliverySettings> {
  return (await getPublicStoreSettings()).delivery;
}

/** The identity block, for the footer, contact page and structured data. */
export async function getStoreIdentity(): Promise<StoreIdentity> {
  const settings = await getPublicStoreSettings();
  return {
    storeName: settings.storeName,
    supportPhone: settings.supportPhone,
    whatsappNumber: settings.whatsappNumber,
    supportEmail: settings.supportEmail,
    storeAddress: settings.storeAddress,
    facebookUrl: settings.facebookUrl,
    instagramUrl: settings.instagramUrl,
    tiktokUrl: settings.tiktokUrl,
  };
}
