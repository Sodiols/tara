"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "../auth";
import { createClient } from "../server";
import type { ActionResult } from "./auth";

const productSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(2).regex(/^[a-z0-9-]+$/),
  nameEn: z.string().trim().min(2),
  nameBn: z.string().trim().min(2),
  descriptionEn: z.string().trim().min(10),
  descriptionBn: z.string().trim().min(2),
  categoryId: z.string().uuid(),
  collectionId: z.union([z.string().uuid(), z.literal("")]).optional(),
  basePrice: z.coerce.number().min(0),
  compareAtPrice: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  fabricEn: z.string().trim().min(2),
  fabricBn: z.string().trim().min(2),
  productCode: z.string().trim().min(2),
  status: z.enum(["draft", "active", "archived"]),
});

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export async function saveProductAction(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const parsed = productSchema.safeParse({
    id: value(formData, "id") || undefined,
    slug: value(formData, "slug"),
    nameEn: value(formData, "nameEn"),
    nameBn: value(formData, "nameBn"),
    descriptionEn: value(formData, "descriptionEn"),
    descriptionBn: value(formData, "descriptionBn"),
    categoryId: value(formData, "categoryId"),
    collectionId: value(formData, "collectionId"),
    basePrice: value(formData, "basePrice"),
    compareAtPrice: value(formData, "compareAtPrice"),
    fabricEn: value(formData, "fabricEn"),
    fabricBn: value(formData, "fabricBn"),
    productCode: value(formData, "productCode"),
    status: value(formData, "status"),
  });
  if (!parsed.success) return { ok: false, message: "admin.invalidProduct", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "auth.errors.notConfigured" };
  const payload = {
    slug: parsed.data.slug,
    name_en: parsed.data.nameEn,
    name_bn: parsed.data.nameBn,
    description_en: parsed.data.descriptionEn,
    description_bn: parsed.data.descriptionBn,
    category_id: parsed.data.categoryId,
    collection_id: parsed.data.collectionId || null,
    base_price: parsed.data.basePrice,
    compare_at_price: parsed.data.compareAtPrice === "" ? null : parsed.data.compareAtPrice,
    fabric_en: parsed.data.fabricEn,
    fabric_bn: parsed.data.fabricBn,
    product_code: parsed.data.productCode,
    status: parsed.data.status,
  };
  const query = parsed.data.id
    ? supabase.from("products").update(payload).eq("id", parsed.data.id)
    : supabase.from("products").insert(payload);
  const { error } = await query;
  if (error) {
    console.error("Admin product save failed:", error.message);
    return { ok: false, message: "admin.saveFailed" };
  }
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { ok: true, message: "admin.saved" };
}

export async function archiveProductAction(id: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase!.from("products").update({ status: "archived" }).eq("id", id);
  revalidatePath("/admin/products");
  return !error;
}

const orderStatusEnum = z.enum(["pending", "confirmed", "processing", "packed", "shipped", "delivered", "cancelled", "returned"]);
const paymentStatusEnum = z.enum(["unpaid", "pending", "paid", "failed", "refunded"]);

function orderTransitionMessage(code: string): string {
  if (code.includes("order_already_"))
    return "This order is already cancelled or returned and cannot be changed further.";
  if (code.includes("use_returned_not_cancelled"))
    return "A delivered order can't be cancelled — use \"returned\" instead.";
  if (code.includes("only_delivered_can_be_returned"))
    return "Only a delivered order can be marked as returned.";
  if (code.includes("_to_"))
    return "That status change skips backwards or ahead in the order pipeline and isn't allowed.";
  return "Could not update the order.";
}

export async function updateOrderAction(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = value(formData, "id");
  const status = orderStatusEnum.parse(value(formData, "status"));
  const paymentStatus = paymentStatusEnum.parse(value(formData, "paymentStatus"));
  const note = value(formData, "note") || undefined;
  const supabase = await createClient();
  const { error } = await supabase!.rpc("admin_update_order_status", {
    p_order_id: id,
    p_status: status,
    p_payment_status: paymentStatus,
    p_note: note ?? null,
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  if (error) {
    if (error.message.includes("invalid_transition")) {
      return { ok: false, message: orderTransitionMessage(error.message) };
    }
    console.error("Admin order status update failed:", error.message);
    return { ok: false, message: "Could not update the order. Please try again." };
  }
  return { ok: true, message: "Order updated." };
}

export async function moderateReviewAction(id: string, status: "approved" | "rejected") {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase!.from("reviews").update({ status }).eq("id", id);
  revalidatePath("/admin/reviews");
  return !error;
}

export async function saveTaxonomyAction(kind: "categories" | "collections", formData: FormData) {
  await requireStaff();
  const payload = {
    slug: value(formData, "slug"),
    name_en: value(formData, "nameEn"),
    name_bn: value(formData, "nameBn"),
    is_active: true,
    sort_order: Number(value(formData, "sortOrder") || 0),
  };
  if (!/^[a-z0-9-]+$/.test(payload.slug) || !payload.name_en || !payload.name_bn) return false;
  const supabase = await createClient();
  const { error } = await supabase!.from(kind).upsert(payload, { onConflict: "slug" });
  revalidatePath(`/admin/${kind}`);
  return !error;
}

const couponSchema = z
  .object({
    code: z.string().trim().min(3).max(30),
    descriptionEn: z.string().trim().max(300),
    descriptionBn: z.string().trim().max(300),
    discountType: z.enum(["fixed", "percentage"]),
    discountValue: z.coerce.number().gt(0),
    minimumOrderAmount: z.coerce.number().min(0),
  })
  .refine((v) => v.discountType !== "percentage" || v.discountValue <= 100, {
    path: ["discountValue"],
    message: "A percentage discount can't exceed 100.",
  });

export async function saveCouponAction(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const parsed = couponSchema.safeParse({
    code: value(formData, "code"),
    descriptionEn: value(formData, "descriptionEn"),
    descriptionBn: value(formData, "descriptionBn"),
    discountType: value(formData, "discountType") === "fixed" ? "fixed" : "percentage",
    discountValue: value(formData, "discountValue"),
    minimumOrderAmount: value(formData, "minimumOrderAmount") || "0",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the coupon details." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").upsert({
    code: parsed.data.code.toUpperCase(),
    description_en: parsed.data.descriptionEn,
    description_bn: parsed.data.descriptionBn,
    discount_type: parsed.data.discountType,
    discount_value: parsed.data.discountValue,
    minimum_order_amount: parsed.data.minimumOrderAmount,
    is_active: true,
  }, { onConflict: "code" });
  revalidatePath("/admin/coupons");
  if (error) {
    console.error("Admin coupon save failed:", error.message);
    return { ok: false, message: "Could not save this coupon." };
  }
  return { ok: true, message: "Coupon saved." };
}

export async function saveVariantAction(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const productId = z.string().uuid().parse(value(formData, "productId"));
  const id = value(formData, "id") || undefined;
  const payload = {
    product_id: productId,
    sku: value(formData, "sku"),
    size: value(formData, "size"),
    colour_en: value(formData, "colourEn"),
    colour_bn: value(formData, "colourBn"),
    colour_hex: value(formData, "colourHex"),
    stock_quantity: Math.max(0, Number(value(formData, "stockQuantity")) || 0),
    low_stock_threshold: Math.max(0, Number(value(formData, "lowStockThreshold")) || 3),
    is_active: true,
  };
  const supabase = await createClient();
  const query = id
    ? supabase.from("product_variants").update(payload).eq("id", id)
    : supabase.from("product_variants").insert(payload);
  const { error } = await query;
  revalidatePath(`/admin/products/${productId}`);
  if (error) {
    console.error("Admin variant save failed:", error.message);
    return { ok: false, message: "Could not save this variant." };
  }
  return { ok: true, message: id ? "Variant updated." : "Variant added." };
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function addProductImageAction(formData: FormData): Promise<ActionResult> {
  await requireStaff();
  const productId = z.string().uuid().parse(value(formData, "productId"));
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image file to upload." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, message: "Only JPEG, PNG, WebP, or AVIF images are allowed." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Image must be smaller than 5MB." };
  }

  const supabase = await createClient();
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${productId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error("Admin image upload failed:", uploadError.message);
    return { ok: false, message: "Could not upload the image." };
  }

  const { data: publicUrlData } = supabase.storage.from("product-images").getPublicUrl(path);
  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    image_url: publicUrlData.publicUrl,
    storage_path: path,
    alt_en: value(formData, "altEn"),
    alt_bn: value(formData, "altBn"),
    sort_order: count ?? 0,
    is_primary: (count ?? 0) === 0,
  });
  revalidatePath(`/admin/products/${productId}`);
  if (error) {
    console.error("Admin image record insert failed:", error.message);
    await supabase.storage.from("product-images").remove([path]);
    return { ok: false, message: "Could not save the uploaded image." };
  }
  return { ok: true, message: "Image added." };
}

export async function deleteProductImageAction(imageId: string, productId: string): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();
  const { data: image } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("id", imageId)
    .maybeSingle();
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (!error && image?.storage_path) {
    await supabase.storage.from("product-images").remove([image.storage_path]);
  }
  revalidatePath(`/admin/products/${productId}`);
  return error
    ? { ok: false, message: "Could not delete this image." }
    : { ok: true, message: "Image deleted." };
}

export async function setPrimaryImageAction(imageId: string, productId: string): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();
  await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
  const { error } = await supabase.from("product_images").update({ is_primary: true }).eq("id", imageId);
  revalidatePath(`/admin/products/${productId}`);
  return error
    ? { ok: false, message: "Could not update the primary image." }
    : { ok: true, message: "Primary image updated." };
}
