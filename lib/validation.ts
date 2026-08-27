import { z } from "zod";
import { normalizeBdPhone } from "./phone";
import { DIVISIONS, resolveLocation } from "@/data/bangladesh-geography";
import { DELIVERY_ZONES } from "@/lib/delivery";

const email = z.string().trim().toLowerCase().email().max(200);
const password = z
  .string()
  .min(8)
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.");
// Accepts every common way a Bangladeshi number is written (+880…, 880…,
// 01…, with spaces or dashes) and stores the canonical 01XXXXXXXXX form, so a
// customer is never rejected for formatting and the same person is always
// recognised as the same person by the COD abuse checks.
const bangladeshPhone = z
  .string()
  .trim()
  .transform((value) => normalizeBdPhone(value))
  .refine((value): value is string => value !== null, {
    message: "Enter a valid Bangladesh mobile number, for example 01712345678.",
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(6),
  returnTo: z.string().optional(),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    phone: bangladeshPhone,
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: bangladeshPhone,
});

// upazila and area are no longer collected. The columns still exist and still
// hold what historic addresses were saved with; migration 0009 gave them a
// default so an address needs only division, district and the street address.
export const addressSchema = z
  .object({
    id: z.string().uuid().optional(),
    recipientName: z.string().trim().min(2).max(100),
    phone: bangladeshPhone,
    division: z.string().trim().min(2).max(80),
    district: z.string().trim().min(2).max(80),
    postalCode: z.string().trim().max(20).optional(),
    fullAddress: z.string().trim().min(8).max(500),
    deliveryNote: z.string().trim().max(500).optional(),
    isDefault: z.boolean().default(false),
  })
  .transform((value, ctx) => {
    const resolved = resolveLocation(value.division, value.district);
    if (!resolved) {
      ctx.addIssue({
        code: "custom",
        path: ["district"],
        message: "Choose a division and a district that belong together.",
      });
      return z.NEVER;
    }
    return { ...value, division: resolved.division, district: resolved.district };
  });

/**
 * A Bangladesh postal code: four digits, and optional.
 *
 * Validated rather than accepted blindly, but only for shape — there is no
 * authoritative list to check membership against, and rejecting a real address
 * because its code is unfamiliar is far worse than storing one that is merely
 * unusual.
 */
const bangladeshPostalCode = z
  .union([
    z.literal(""),
    z
      .string()
      .trim()
      .regex(/^\d{4}$/, "A Bangladesh postal code is four digits, for example 3100."),
  ])
  .optional()
  .transform((value) => (value ? value : null));

/**
 * The shipping details the checkout collects.
 *
 * Checkout used to ask for a division and a district and derive the delivery
 * charge from them. It now asks the question the price actually depends on —
 * inside Sylhet or outside it — and takes a plain street address alongside it.
 * `place_order()` re-validates all of this and recomputes the fee from the zone
 * before it locks a single row of stock.
 *
 * The country is always Bangladesh. It is recorded, not asked.
 */
export const shippingAddressSchema = z.object({
  address: z.string().trim().min(8, "Enter the full street address.").max(500),
  apartment: z
    .union([z.literal(""), z.string().trim().max(160)])
    .optional()
    .transform((value) => (value ? value : null)),
  city: z.string().trim().min(2, "Enter your city or town.").max(80),
  postalCode: bangladeshPostalCode,
  deliveryZone: z.enum(DELIVERY_ZONES),
});

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  // Required for both account and guest checkout because the saved order is the
  // source for the customer's confirmation and PDF receipt.
  customerEmail: email,
  customerPhone: bangladeshPhone,
  // The store offers one delivery option and one payment method. Both are
  // fixed here rather than being sent by the browser: `place_order()` refuses
  // anything else at the database level, so accepting a choice the checkout no
  // longer presents would only create orders the store cannot fulfil.
  paymentMethod: z.literal("cash_on_delivery").default("cash_on_delivery"),
  customerNote: z.string().trim().max(500).optional(),
  shippingAddress: shippingAddressSchema,
  couponCode: z.string().trim().max(50).optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1),
});

export const newsletterSchema = z.object({ email });
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  phone: z.union([bangladeshPhone, z.literal("")]).optional(),
  message: z.string().trim().min(10).max(3000),
});

export const reviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  commentEn: z.string().trim().min(10).max(2000),
});

// ---------------------------------------------------------------------------
// Admin schemas
//
// These run server-side in the admin server actions. The database re-checks
// everything that matters (permissions, price integrity, coupon caps), so
// these exist to give staff a precise error rather than a generic failure.
// ---------------------------------------------------------------------------

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.");

const sku = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(40)
  .regex(/^[A-Z0-9][A-Z0-9._-]*$/, "SKU may use letters, numbers, dot, underscore and hyphen.");

const price = z.coerce
  .number()
  .min(0, "Price cannot be negative.")
  .max(9_999_999, "Price is unrealistically high.")
  .refine((value) => Number.isFinite(value), "Enter a valid amount.");

const optionalPrice = z
  .union([z.literal(""), price])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

const optionalInt = (max = 1_000_000) =>
  z
    .union([z.literal(""), z.coerce.number().int().min(0).max(max)])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value));

const optionalDate = z
  .union([z.literal(""), z.string().trim()])
  .optional()
  .transform((value) => (value ? value : null));

const optionalText = (max: number) =>
  z
    .union([z.literal(""), z.string().trim().max(max)])
    .optional()
    .transform((value) => (value ? value : null));

// The slug is deliberately absent: it is derived from the English name when the
// product is created, then held stable so a later rename cannot silently break
// a live product URL, a shared link, or the sitemap entry.
//
// DRAFTS AND ACTIVE PRODUCTS ARE HELD TO DIFFERENT STANDARDS
// ----------------------------------------------------------
// A draft is work in progress: nobody can see it, it has no variants yet, and
// it is not buyable. Blocking it because the fabric line has not been written
// yet only teaches staff to type a full stop into the field to get past the
// error, which is worse than an empty column.
//
// An active product is a storefront page. It renders the description and the
// fabric in the product accordion, so both are required the moment the status
// is `active` — enforced by the refinements below, and again by
// `setProductStatusAction` for the paths that activate a product without going
// through this form.
export const adminProductSchema = z
  .object({
    id: z.string().uuid().optional(),
    productCode: z.string().trim().toUpperCase().min(2).max(40),
    nameEn: z.string().trim().min(2).max(160),
    descriptionEn: z.string().trim().max(5000).default(""),
    categoryId: z.string().uuid("Choose a category."),
    collectionId: z.union([z.string().uuid(), z.literal("")]).optional(),
    basePrice: price,
    compareAtPrice: optionalPrice,
    fabricEn: z.string().trim().max(160).default(""),
    materialEn: z.string().trim().max(200).default(""),
    careInstructionsEn: z.string().trim().max(1000).default(""),
    sizeGuideNoteEn: z.string().trim().max(1000).default(""),
    tags: z.string().trim().max(400).default(""),
    status: z.enum(["draft", "active", "archived"]),
    isNew: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    isBestSeller: z.boolean().default(false),
    seoTitle: optionalText(70),
    seoDescription: optionalText(180),
  })
  .refine(
    (value) =>
      value.compareAtPrice === null || value.compareAtPrice >= value.basePrice,
    {
      path: ["compareAtPrice"],
      message: "The compare-at price must be at least the selling price.",
    },
  )
  .refine((value) => value.status !== "active" || value.descriptionEn.length >= 10, {
    path: ["descriptionEn"],
    message: "An active product needs a description customers can read.",
  })
  .refine((value) => value.status !== "active" || value.fabricEn.length >= 2, {
    path: ["fabricEn"],
    message: "An active product needs its fabric filled in.",
  });

/**
 * Reads the product form out of a FormData, before validation.
 *
 * Exported because the browser runs `adminProductSchema` over exactly these
 * values before it creates anything — catching a missing category or a
 * compare-at price below the selling price costs one render, rather than a
 * product row and six image uploads that then have to be explained. The server
 * parses the same fields the same way and remains the authority.
 */
export function productFormValues(formData: FormData) {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const checkbox = (name: string) => {
    const value = formData.get(name);
    return value === "on" || value === "true" || value === "1";
  };

  return {
    id: text("id") || undefined,
    productCode: text("productCode"),
    nameEn: text("nameEn"),
    descriptionEn: text("descriptionEn"),
    categoryId: text("categoryId"),
    collectionId: text("collectionId"),
    basePrice: text("basePrice"),
    compareAtPrice: text("compareAtPrice"),
    fabricEn: text("fabricEn"),
    materialEn: text("materialEn"),
    careInstructionsEn: text("careInstructionsEn"),
    sizeGuideNoteEn: text("sizeGuideNoteEn"),
    tags: text("tags"),
    status: text("status"),
    isNew: checkbox("isNew"),
    isFeatured: checkbox("isFeatured"),
    isBestSeller: checkbox("isBestSeller"),
    seoTitle: text("seoTitle"),
    seoDescription: text("seoDescription"),
  };
}

/** The fields an active product may not leave blank. Checked here and again in
 * `setProductStatusAction`, which is how a draft is activated from the product
 * list without passing through the form. */
export function missingForActiveProduct(product: {
  description_en: string | null;
  fabric_en: string | null;
}): string[] {
  const missing: string[] = [];
  if ((product.description_en ?? "").trim().length < 10) missing.push("a description");
  if ((product.fabric_en ?? "").trim().length < 2) missing.push("the fabric");
  return missing;
}

export const adminVariantSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid(),
  sku,
  size: z.string().trim().min(1).max(40),
  colourEn: z.string().trim().min(1).max(60),
  colourHex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex colour, for example #702D42."),
  priceOverride: optionalPrice,
  lowStockThreshold: z.coerce.number().int().min(0).max(10_000).default(3),
  isActive: z.boolean().default(true),
  // Stock is never set here. It moves only through admin_adjust_inventory()
  // so that every change carries a reason and an audit record.
  initialStock: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const adminInventoryAdjustmentSchema = z.object({
  variantId: z.string().uuid(),
  newQuantity: z.coerce.number().int().min(0).max(1_000_000),
  reason: z.enum([
    "restock",
    "correction",
    "damaged",
    "lost",
    "return_to_stock",
    "transfer",
    "other",
  ]),
  note: optionalText(500),
});

export const adminCategorySchema = z.object({
  id: z.string().uuid().optional(),
  slug,
  nameEn: z.string().trim().min(2).max(120),
  descriptionEn: optionalText(1000),
  imageUrl: optionalText(500),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  seoTitle: optionalText(70),
  seoDescription: optionalText(180),
});

export const adminCollectionSchema = adminCategorySchema
  .extend({
    isFeatured: z.boolean().default(false),
    startsAt: optionalDate,
    endsAt: optionalDate,
  })
  .refine(
    (value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt,
    { path: ["endsAt"], message: "The end date must be after the start date." },
  );

export const adminCouponSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3)
      .max(30)
      .regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, hyphen or underscore only."),
    descriptionEn: z.string().trim().max(300).default(""),
    discountType: z.enum(["fixed", "percentage"]),
    discountValue: z.coerce.number().gt(0, "Enter a discount greater than zero."),
    minimumOrderAmount: z.coerce.number().min(0).default(0),
    maximumDiscountAmount: optionalPrice,
    startsAt: optionalDate,
    expiresAt: optionalDate,
    usageLimit: optionalInt(1_000_000),
    perCustomerLimit: optionalInt(1000),
    isActive: z.boolean().default(true),
  })
  .refine(
    (value) => value.discountType !== "percentage" || value.discountValue <= 100,
    { path: ["discountValue"], message: "A percentage discount cannot exceed 100." },
  )
  .refine(
    (value) => !value.startsAt || !value.expiresAt || value.expiresAt > value.startsAt,
    { path: ["expiresAt"], message: "The expiry must be after the start date." },
  );

// Every field here is written to store_settings and read back by something the
// customer can see. There is no setting in this schema the application ignores.
export const adminSettingsSchema = z.object({
  store_name: z.string().trim().min(1).max(80),
  support_phone: z.union([bangladeshPhone, z.literal("")]),
  whatsapp_number: z.union([bangladeshPhone, z.literal("")]),
  support_email: z.union([email, z.literal("")]),
  store_address: z.string().trim().max(300),
  facebook_url: z.union([z.string().trim().url().max(300), z.literal("")]),
  instagram_url: z.union([z.string().trim().url().max(300), z.literal("")]),
  tiktok_url: z.union([z.string().trim().url().max(300), z.literal("")]),
  delivery_fee_inside_sylhet: z.coerce.number().min(0).max(100_000),
  delivery_fee_outside_sylhet: z.coerce.number().min(0).max(100_000),
  free_delivery_threshold: z.coerce.number().min(0).max(1_000_000),
  free_delivery_enabled: z.boolean(),
  // Restricted to the eight real divisions: a free-text value here would create
  // a rule that can never match, and every customer would silently be charged.
  free_delivery_division: z.enum(DIVISIONS),
  cod_enabled: z.boolean(),
  maintenance_mode: z.boolean(),
  // Where the store's own "new order" notification is sent. Private — never
  // exposed to the storefront — and now genuinely used by lib/email.
  order_notification_email: z.union([email, z.literal("")]),
});

export const orderTransitionSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum([
    "pending",
    "confirmed",
    "processing",
    "packed",
    "shipped",
    "delivered",
    "cancelled",
    "returned",
  ]),
  customerNote: optionalText(300),
  internalNote: optionalText(1000),
  restock: z.boolean().optional(),
});

export const paymentStatusSchema = z.object({
  orderId: z.string().uuid(),
  paymentStatus: z.enum([
    "unpaid",
    "pending",
    "paid",
    "failed",
    "refunded",
    "partially_refunded",
  ]),
  note: optionalText(300),
});

export const adminRoleSchema = z.object({
  profileId: z.string().uuid(),
  role: z.enum(["customer", "support", "fulfilment", "manager", "staff", "admin"]),
});
