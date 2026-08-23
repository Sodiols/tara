/**
 * Static identity for the site.
 *
 * Phone, WhatsApp and support email are deliberately NOT here. They used to
 * hold placeholders (`+880 1XXX-XXXXXX`) that would have shipped to production;
 * they now live in `store_settings`, are editable from /admin/settings, and are
 * hidden entirely by every component while blank — a missing number is obvious,
 * an invented one is not.
 *
 * Read the live values with `getPublicStoreSettings()` from
 * lib/supabase/queries/settings.ts.
 */
export const siteConfig = {
  name: "TARA",
  domain: "www.tarabd.co",
  url: process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") || "https://www.tarabd.co",
  instagram: "https://instagram.com/tarabd.co",
  facebook: "https://facebook.com/tarabd.co",
  tiktok: "https://tiktok.com/@tarabd.co",
  instagramHandle: "@tarabd.co",
  // The physical showroom. A real address, not a placeholder — kept static
  // because client components in the navigation link to it directly.
  address: "Batortal Bazar, Zakiganj, Sylhet, Bangladesh",
};

export const divisions = [
  "Sylhet",
  "Dhaka",
  "Chattogram",
  "Rajshahi",
  "Khulna",
  "Barishal",
  "Rangpur",
  "Mymensingh",
];

export const districtsByDivision: Record<string, string[]> = {
  Sylhet: ["Sylhet Sadar", "Zakiganj", "Golapganj", "Beanibazar", "Moulvibazar", "Habiganj", "Sunamganj"],
  Dhaka: ["Dhaka", "Gazipur", "Narayanganj", "Tangail", "Manikganj"],
  Chattogram: ["Chattogram", "Cox's Bazar", "Cumilla", "Feni"],
  Rajshahi: ["Rajshahi", "Bogura", "Pabna", "Natore"],
  Khulna: ["Khulna", "Jessore", "Satkhira"],
  Barishal: ["Barishal", "Patuakhali", "Bhola"],
  Rangpur: ["Rangpur", "Dinajpur", "Kurigram"],
  Mymensingh: ["Mymensingh", "Jamalpur", "Netrokona"],
};
