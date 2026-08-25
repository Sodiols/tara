"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "../auth";
import { createClient } from "../server";
import type { ActionResult } from "./auth";
import {
  adminCategorySchema,
  adminCollectionSchema,
  adminCouponSchema,
  adminInventoryAdjustmentSchema,
  adminProductSchema,
  adminRoleSchema,
  adminSettingsSchema,
  adminVariantSchema,
  orderTransitionSchema,
  paymentStatusSchema,
} from "@/lib/validation";
import { describeTransitionError } from "@/lib/order-status";
import { storeLocalToIso } from "@/lib/format";
import { slugify } from "@/lib/utils";
import {
  EXTENSION_BY_MIME_TYPE,
  MAX_IMAGES_PER_PRODUCT,
} from "@/lib/product-images";
import { inspectImageFile } from "@/lib/image-validation";
import { logFailure, logger } from "@/lib/logger";
import { dispatchOrderNotificationsAsStaff } from "@/lib/email/dispatch";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";

/**
 * Admin mutations.
 *
 * Every action follows the same shape:
 *   1. `requirePermission` — rejects the request before any work happens
 *   2. Zod parse — turns a raw FormData into typed, bounded values
 *   3. Database call — an audited SECURITY DEFINER RPC where one exists,
 *      otherwise a plain write guarded by RLS
 *   4. `revalidatePath` — so the list the staff member came from is fresh
 *
 * Raw database errors are logged server-side and never returned to the client;
 * the caller gets a sentence they can act on.
 */

type FieldErrors = Record<string, string[]>;

function fail(message: string, fieldErrors?: FieldErrors): ActionResult {
  return { ok: false, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function checkbox(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

function logAndFail(context: string, error: { message: string }, fallback: string): ActionResult {
  // Structured, scrubbed and reported to error monitoring. The raw message can
  // name SKUs, constraints and column values, so it never reaches the browser.
  logFailure(`admin.${context}`, error);
  if (error.message.includes("permission_denied")) {
    return fail("Your role does not allow this action.");
  }
  if (error.message.includes("duplicate key")) {
    if (error.message.includes("slug")) return fail("That slug is already in use.");
    if (error.message.includes("sku")) return fail("That SKU is already in use.");
    if (error.message.includes("product_code")) return fail("That product code is already in use.");
    if (error.message.includes("code")) return fail("That code is already in use.");
    return fail("A record with those details already exists.");
  }
  return fail(fallback);
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the highlighted fields.";
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/**
 * Builds a URL slug from the product's English name.
 *
 * Called only when a product is created. On edit the existing slug is carried
 * through untouched — regenerating it from a renamed product would 404 every
 * link already shared with a customer and every entry already in the sitemap.
 *
 * A numeric suffix is appended if the natural slug is taken, so saving is never
 * blocked by a name collision the staff member cannot see.
 */
async function buildUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
): Promise<string> {
  // slugify() strips everything outside [a-z0-9], so a name written entirely in
  // Bangla or punctuation yields an empty string — fall back rather than
  // producing a product that lives at "/product/".
  const root = slugify(name).slice(0, 70) || "product";

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }

  return `${root}-${Date.now().toString(36)}`;
}

export async function saveProductAction(
  formData: FormData,
): Promise<ActionResult<string | undefined>> {
  await requirePermission("catalogue.manage");

  const parsed = adminProductSchema.safeParse({
    id: text(formData, "id") || undefined,
    productCode: text(formData, "productCode"),
    nameEn: text(formData, "nameEn"),
    descriptionEn: text(formData, "descriptionEn"),
    categoryId: text(formData, "categoryId"),
    collectionId: text(formData, "collectionId"),
    basePrice: text(formData, "basePrice"),
    compareAtPrice: text(formData, "compareAtPrice"),
    fabricEn: text(formData, "fabricEn"),
    materialEn: text(formData, "materialEn"),
    careInstructionsEn: text(formData, "careInstructionsEn"),
    sizeGuideNoteEn: text(formData, "sizeGuideNoteEn"),
    tags: text(formData, "tags"),
    status: text(formData, "status"),
    isNew: checkbox(formData, "isNew"),
    isFeatured: checkbox(formData, "isFeatured"),
    isBestSeller: checkbox(formData, "isBestSeller"),
    seoTitle: text(formData, "seoTitle"),
    seoDescription: text(formData, "seoDescription"),
  });

  if (!parsed.success) {
    return fail(firstIssue(parsed.error), parsed.error.flatten().fieldErrors as FieldErrors);
  }

  const input = parsed.data;
  const supabase = await createClient();

  // The product code is staff-entered and must stay unique — catch a collision
  // with a precise message rather than surfacing a raw unique-violation.
  let duplicateQuery = supabase
    .from("products")
    .select("id")
    .eq("product_code", input.productCode);
  if (input.id) duplicateQuery = duplicateQuery.neq("id", input.id);
  const { data: duplicate } = await duplicateQuery.maybeSingle();
  if (duplicate) return fail("Another product already uses that product code.");

  let slug: string;
  if (input.id) {
    // Keep the URL a product already has. Nothing in this form can change it.
    const { data: existing } = await supabase
      .from("products")
      .select("slug")
      .eq("id", input.id)
      .maybeSingle();
    if (!existing) return fail("That product no longer exists.");
    slug = existing.slug;
  } else {
    slug = await buildUniqueSlug(supabase, input.nameEn);
  }

  const payload = {
    slug,
    product_code: input.productCode,
    name_en: input.nameEn,
    description_en: input.descriptionEn,
    category_id: input.categoryId,
    collection_id: input.collectionId || null,
    base_price: input.basePrice,
    compare_at_price: input.compareAtPrice,
    fabric_en: input.fabricEn,
    material_en: input.materialEn,
    care_instructions_en: input.careInstructionsEn,
    size_guide_note_en: input.sizeGuideNoteEn,
    tags: input.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20),
    status: input.status,
    is_new: input.isNew,
    is_featured: input.isFeatured,
    is_best_seller: input.isBestSeller,
    seo_title: input.seoTitle,
    seo_description: input.seoDescription,
    archived_at: input.status === "archived" ? new Date().toISOString() : null,
  };

  const { data, error } = input.id
    ? await supabase.from("products").update(payload).eq("id", input.id).select("id").maybeSingle()
    : await supabase.from("products").insert(payload).select("id").maybeSingle();

  if (error) return logAndFail("product save", error, "Could not save this product.");

  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath(`/product/${slug}`);

  // Images attached to the create form are uploaded once the product exists,
  // because the storage path is keyed on the product id. A failed image never
  // discards the product that was just saved — the count is reported instead.
  const pendingImages = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!input.id && data?.id && pendingImages.length > 0) {
    const outcome = await uploadProductImages(supabase, data.id, pendingImages, 0);
    revalidatePath(`/admin/products/${data.id}`);

    if (outcome.failed > 0) {
      return {
        ok: true,
        data: data.id,
        message:
          outcome.uploaded > 0
            ? `Product created with ${outcome.uploaded} of ${pendingImages.length} images. ${outcome.failed} could not be uploaded — add them again below.`
            : "Product created, but the images could not be uploaded. Add them again below.",
      };
    }

    return {
      ok: true,
      data: data.id,
      message: `Product created with ${outcome.uploaded} image${outcome.uploaded === 1 ? "" : "s"}.`,
    };
  }

  return {
    ok: true,
    message: input.id ? "Product saved." : "Product created.",
    data: data?.id,
  };
}

export async function setProductStatusAction(
  productId: string,
  status: "draft" | "active" | "archived",
): Promise<ActionResult> {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      status,
      archived_at: status === "archived" ? new Date().toISOString() : null,
    })
    .eq("id", productId);

  if (error) return logAndFail("product status", error, "Could not update the product.");
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { ok: true, message: `Product ${status === "archived" ? "archived" : "updated"}.` };
}

/**
 * Duplicates a product and its variant definitions (with zero stock, since
 * stock is never copied) so a new colourway can start from an existing one.
 */
export async function duplicateProductAction(
  productId: string,
): Promise<ActionResult<string>> {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();

  const { data: source } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();
  if (!source) return fail("That product no longer exists.");

  const suffix = Date.now().toString(36).slice(-5);
  const { id: _id, created_at: _created, updated_at: _updated, ...rest } = source;
  const { data: created, error } = await supabase
    .from("products")
    .insert({
      ...rest,
      slug: `${source.slug}-copy-${suffix}`,
      product_code: `${source.product_code}-C${suffix.toUpperCase()}`,
      name_en: `${source.name_en} (copy)`,
      status: "draft",
      is_featured: false,
      is_best_seller: false,
      average_rating: 0,
      review_count: 0,
      archived_at: null,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    return logAndFail("product duplicate", error ?? { message: "no row" }, "Could not duplicate this product.");
  }

  const { data: variants } = await supabase
    .from("product_variants")
    .select("sku,size,colour_en,colour_hex,price_override,low_stock_threshold")
    .eq("product_id", productId);

  if (variants?.length) {
    await supabase.from("product_variants").insert(
      variants.map((variant) => ({
        ...variant,
        product_id: created.id,
        sku: `${variant.sku}-C${suffix.toUpperCase()}`,
        stock_quantity: 0,
        is_active: true,
      })),
    );
  }

  revalidatePath("/admin/products");
  return { ok: true, message: "Product duplicated as a draft.", data: created.id };
}

// ---------------------------------------------------------------------------
// Variants and inventory
// ---------------------------------------------------------------------------

export async function saveVariantAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("catalogue.manage");

  const parsed = adminVariantSchema.safeParse({
    id: text(formData, "id") || undefined,
    productId: text(formData, "productId"),
    sku: text(formData, "sku"),
    size: text(formData, "size"),
    colourEn: text(formData, "colourEn"),
    colourHex: text(formData, "colourHex"),
    priceOverride: text(formData, "priceOverride"),
    lowStockThreshold: text(formData, "lowStockThreshold") || "3",
    isActive: formData.has("id") ? checkbox(formData, "isActive") : true,
    initialStock: text(formData, "initialStock") || "0",
  });

  if (!parsed.success) {
    return fail(firstIssue(parsed.error), parsed.error.flatten().fieldErrors as FieldErrors);
  }
  const input = parsed.data;
  const supabase = await createClient();

  let duplicateQuery = supabase.from("product_variants").select("id").eq("sku", input.sku);
  if (input.id) duplicateQuery = duplicateQuery.neq("id", input.id);
  const { data: duplicate } = await duplicateQuery.maybeSingle();
  if (duplicate) return fail("Another variant already uses that SKU.");

  const payload = {
    product_id: input.productId,
    sku: input.sku,
    size: input.size,
    colour_en: input.colourEn,
    colour_hex: input.colourHex.toUpperCase(),
    price_override: input.priceOverride,
    low_stock_threshold: input.lowStockThreshold,
    is_active: input.isActive,
  };

  if (input.id) {
    // stock_quantity is deliberately absent: a database trigger rejects any
    // direct stock write so that every movement carries a reason and an audit
    // trail. Use adjustInventoryAction instead.
    const { error } = await supabase.from("product_variants").update(payload).eq("id", input.id);
    if (error) return logAndFail("variant update", error, "Could not save this variant.");
    revalidatePath(`/admin/products/${input.productId}`);
    return { ok: true, message: "Variant updated." };
  }

  const { error } = await supabase
    .from("product_variants")
    .insert({ ...payload, stock_quantity: input.initialStock });
  if (error) return logAndFail("variant insert", error, "Could not add this variant.");

  revalidatePath(`/admin/products/${input.productId}`);
  revalidatePath("/admin/inventory");
  return { ok: true, message: "Variant added." };
}

export async function adjustInventoryAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("inventory.adjust");

  const parsed = adminInventoryAdjustmentSchema.safeParse({
    variantId: text(formData, "variantId"),
    newQuantity: text(formData, "newQuantity"),
    reason: text(formData, "reason"),
    note: text(formData, "note"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_adjust_inventory", {
    p_variant_id: parsed.data.variantId,
    p_new_quantity: parsed.data.newQuantity,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note,
  });

  if (error) return logAndFail("inventory adjust", error, "Could not adjust this stock level.");

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { ok: true, message: `Stock set to ${parsed.data.newQuantity}.` };
}

// ---------------------------------------------------------------------------
// Product images
// ---------------------------------------------------------------------------

/**
 * Uploads files to the product-images bucket and records them.
 *
 * Shared by the create form (which attaches images before the product exists)
 * and the editor's uploader. Each file is validated server-side regardless of
 * what the browser allowed, and the stored filename is generated rather than
 * taken from the upload — an attacker-controlled filename must not be able to
 * shape a storage path.
 *
 * A file that fails is skipped rather than aborting the batch, and its storage
 * object is removed if the database row could not be written, so a partial
 * failure never leaves an orphan in the bucket.
 */
async function uploadProductImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  files: File[],
  existingCount: number,
): Promise<{ uploaded: number; failed: number }> {
  let uploaded = 0;
  let failed = 0;
  let position = existingCount;

  for (const file of files) {
    if (position >= MAX_IMAGES_PER_PRODUCT) {
      failed += 1;
      continue;
    }
    // The declared MIME type is whatever the client said. The file's own bytes
    // are checked here, so an HTML document or a script renamed to .jpg cannot
    // be stored in a public bucket and served back from the storage origin.
    const inspection = await inspectImageFile(file);
    if (!inspection.ok) {
      failed += 1;
      continue;
    }

    const extension = EXTENSION_BY_MIME_TYPE[file.type] ?? "jpg";
    const path = `${productId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      logFailure("admin.image_upload_failed", uploadError, { productId });
      failed += 1;
      continue;
    }

    const { data: publicUrl } = supabase.storage.from("product-images").getPublicUrl(path);
    const { error } = await supabase.from("product_images").insert({
      product_id: productId,
      image_url: publicUrl.publicUrl,
      storage_path: path,
      alt_en: "",
      sort_order: position,
      is_primary: position === 0,
    });

    if (error) {
      logFailure("admin.image_record_failed", error, { productId });
      await supabase.storage.from("product-images").remove([path]);
      failed += 1;
      continue;
    }

    uploaded += 1;
    position += 1;
  }

  return { uploaded, failed };
}

export async function addProductImageAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("catalogue.manage");

  const productId = z.string().uuid().safeParse(text(formData, "productId"));
  if (!productId.success) return fail("Unknown product.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Choose an image file to upload.");
  }

  // Single-file uploads report the precise reason, because a staff member who
  // picked one file deserves to be told what is wrong with it.
  const inspection = await inspectImageFile(file);
  if (!inspection.ok) {
    return fail(inspection.reason ?? "That file is not a usable product image.");
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId.data);

  if ((count ?? 0) >= MAX_IMAGES_PER_PRODUCT) {
    return fail(`A product can hold at most ${MAX_IMAGES_PER_PRODUCT} images.`);
  }

  const { uploaded, failed } = await uploadProductImages(
    supabase,
    productId.data,
    [file],
    count ?? 0,
  );

  if (uploaded === 0) {
    return fail("Could not upload the image. Please try again.");
  }

  // Alt text is only offered by the editor's single-image form, so it is
  // applied here rather than inside the shared batch helper.
  const altEn = text(formData, "altEn").slice(0, 160);
  if (altEn) {
    const { data: newest } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", productId.data)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (newest) {
      await supabase
        .from("product_images")
        .update({ alt_en: altEn })
        .eq("id", newest.id);
    }
  }

  revalidatePath(`/admin/products/${productId.data}`);
  return failed > 0
    ? fail("Could not upload the image. Please try again.")
    : { ok: true, message: "Image added." };
}

/**
 * Deletes an image and, if it was the primary, promotes the next one.
 *
 * Both happen inside `delete_product_image()`, so the product can never end up
 * with no primary image because the process died between two statements. The
 * storage object is removed only after the row is gone: the other order risks a
 * catalogue entry pointing at a file that no longer exists, which is a broken
 * image on the storefront rather than a tidy-up job.
 */
export async function deleteProductImageAction(
  imageId: string,
  productId: string,
): Promise<ActionResult> {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("delete_product_image", {
    p_image_id: imageId,
  });
  if (error) {
    if (error.message.includes("image_not_found")) return fail("That image no longer exists.");
    return logAndFail("image_delete", error, "Could not delete this image.");
  }

  const storagePath = (data as { storagePath?: string } | null)?.storagePath;
  if (storagePath) {
    const { error: storageError } = await supabase.storage
      .from("product-images")
      .remove([storagePath]);
    // An orphaned object costs a few kilobytes; a failed delete must not look
    // like a failed delete to the staff member, because the row really is gone.
    if (storageError) {
      logFailure("admin.image_storage_orphan", storageError, { imageId, productId });
    }
  }

  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Image deleted." };
}

/**
 * Promotes one image to primary.
 *
 * A partial unique index allows only one primary per product, so the old one
 * has to be cleared before the new one is set — and that used to be two
 * separate statements from here. A failure between them (a dropped connection,
 * a timeout) left the product with no primary image at all, and the storefront
 * silently fell back to whichever row sorted first.
 *
 * `set_product_primary_image()` does both in one transaction and derives the
 * product from the image row, so a request cannot pair an image with a product
 * it does not belong to.
 */
export async function setPrimaryImageAction(
  imageId: string,
  productId: string,
): Promise<ActionResult> {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_product_primary_image", {
    p_image_id: imageId,
  });
  if (error) {
    if (error.message.includes("image_not_found")) return fail("That image no longer exists.");
    return logAndFail("primary_image", error, "Could not update the main image.");
  }

  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Main image updated." };
}

/**
 * Moves one image up or down in the gallery.
 *
 * The whole ordering is written by `reorder_product_images()` in a single
 * statement. It used to be one UPDATE per image issued from here, so a failure
 * part-way through left two images claiming the same position and the gallery
 * rendered them in an arbitrary order.
 */
export async function moveProductImageAction(
  imageId: string,
  productId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();

  const { data: images } = await supabase
    .from("product_images")
    .select("id,sort_order")
    .eq("product_id", productId)
    .order("sort_order")
    .order("id");
  if (!images?.length) return fail("Nothing to reorder.");

  const index = images.findIndex((image) => image.id === imageId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= images.length) {
    return { ok: true, message: "Already in position." };
  }

  const reordered = images.map((image) => image.id);
  [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];

  const { error } = await supabase.rpc("reorder_product_images", {
    p_product_id: productId,
    p_image_ids: reordered,
  });
  if (error) return logAndFail("image_reorder", error, "Could not change the image order.");

  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Image order updated." };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function transitionOrderAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("orders.view");

  const parsed = orderTransitionSchema.safeParse({
    orderId: text(formData, "orderId"),
    status: text(formData, "status"),
    customerNote: text(formData, "customerNote"),
    internalNote: text(formData, "internalNote"),
    restock: formData.has("restock") ? checkbox(formData, "restock") : undefined,
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_transition_order", {
    p_order_id: parsed.data.orderId,
    p_status: parsed.data.status,
    p_customer_note: parsed.data.customerNote,
    p_internal_note: parsed.data.internalNote,
    p_restock: parsed.data.restock ?? null,
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  revalidatePath("/admin");

  if (error) {
    logFailure("admin.order_transition_failed", error, {
      orderId: parsed.data.orderId,
      status: parsed.data.status,
    });
    return fail(describeTransitionError(error.message));
  }

  logger.info("admin.order_transitioned", {
    orderId: parsed.data.orderId,
    status: parsed.data.status,
  });

  // The status change is committed. Telling the customer is best-effort and
  // handles its own failures — a provider outage must not make a staff member
  // think the order did not move.
  const { storeName } = await getPublicStoreSettings();
  void dispatchOrderNotificationsAsStaff(parsed.data.orderId, storeName);

  return { ok: true, message: `Order moved to ${parsed.data.status}.` };
}

export async function updatePaymentStatusAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("orders.payment");

  const parsed = paymentStatusSchema.safeParse({
    orderId: text(formData, "orderId"),
    paymentStatus: text(formData, "paymentStatus"),
    note: text(formData, "note"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_payment_status", {
    p_order_id: parsed.data.orderId,
    p_payment_status: parsed.data.paymentStatus,
    p_note: parsed.data.note,
  });

  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  revalidatePath("/admin/orders");
  if (error) return logAndFail("payment status", error, "Could not update the payment status.");
  return { ok: true, message: "Payment status updated." };
}

export async function addOrderNoteAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("orders.note");

  const orderId = z.string().uuid().safeParse(text(formData, "orderId"));
  const note = text(formData, "note").trim();
  if (!orderId.success) return fail("Unknown order.");
  if (note.length < 2) return fail("Write a note before saving.");
  if (note.length > 1000) return fail("Notes are limited to 1000 characters.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_order_note", {
    p_order_id: orderId.data,
    p_note: note,
  });

  revalidatePath(`/admin/orders/${orderId.data}`);
  if (error) return logAndFail("order note", error, "Could not save this note.");
  return { ok: true, message: "Internal note saved." };
}

// ---------------------------------------------------------------------------
// Categories and collections
// ---------------------------------------------------------------------------

export async function saveCategoryAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("catalogue.manage");

  const parsed = adminCategorySchema.safeParse({
    id: text(formData, "id") || undefined,
    slug: text(formData, "slug"),
    nameEn: text(formData, "nameEn"),
    descriptionEn: text(formData, "descriptionEn"),
    imageUrl: text(formData, "imageUrl"),
    isActive: checkbox(formData, "isActive"),
    sortOrder: text(formData, "sortOrder") || "0",
    seoTitle: text(formData, "seoTitle"),
    seoDescription: text(formData, "seoDescription"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const input = parsed.data;
  const supabase = await createClient();
  const payload = {
    slug: input.slug,
    name_en: input.nameEn,
    description_en: input.descriptionEn,
    image_url: input.imageUrl,
    is_active: input.isActive,
    sort_order: input.sortOrder,
    seo_title: input.seoTitle,
    seo_description: input.seoDescription,
  };

  const { error } = input.id
    ? await supabase.from("categories").update(payload).eq("id", input.id)
    : await supabase.from("categories").insert(payload);
  if (error) return logAndFail("category save", error, "Could not save this category.");

  revalidatePath("/admin/categories");
  revalidatePath("/");
  return { ok: true, message: "Category saved." };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();

  // Products carry a NOT NULL reference to their category, so deleting one that
  // is still in use would either fail with a foreign-key error or orphan the
  // catalogue. Refuse with a message that says what to do instead.
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if ((count ?? 0) > 0) {
    return fail(
      `${count} product${count === 1 ? "" : "s"} still use this category. Move them first, or deactivate the category instead.`,
    );
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return logAndFail("category delete", error, "Could not delete this category.");

  revalidatePath("/admin/categories");
  return { ok: true, message: "Category deleted." };
}

export async function saveCollectionAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("catalogue.manage");

  const parsed = adminCollectionSchema.safeParse({
    id: text(formData, "id") || undefined,
    slug: text(formData, "slug"),
    nameEn: text(formData, "nameEn"),
    descriptionEn: text(formData, "descriptionEn"),
    imageUrl: text(formData, "imageUrl"),
    isActive: checkbox(formData, "isActive"),
    isFeatured: checkbox(formData, "isFeatured"),
    sortOrder: text(formData, "sortOrder") || "0",
    seoTitle: text(formData, "seoTitle"),
    seoDescription: text(formData, "seoDescription"),
    startsAt: text(formData, "startsAt"),
    endsAt: text(formData, "endsAt"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const input = parsed.data;
  const supabase = await createClient();
  const payload = {
    slug: input.slug,
    name_en: input.nameEn,
    description_en: input.descriptionEn,
    image_url: input.imageUrl,
    is_active: input.isActive,
    is_featured: input.isFeatured,
    sort_order: input.sortOrder,
    seo_title: input.seoTitle,
    seo_description: input.seoDescription,
    starts_at: storeLocalToIso(input.startsAt),
    ends_at: storeLocalToIso(input.endsAt),
  };

  const { error } = input.id
    ? await supabase.from("collections").update(payload).eq("id", input.id)
    : await supabase.from("collections").insert(payload);
  if (error) return logAndFail("collection save", error, "Could not save this collection.");

  revalidatePath("/admin/collections");
  revalidatePath("/collection");
  return { ok: true, message: "Collection saved." };
}

export async function deleteCollectionAction(id: string): Promise<ActionResult> {
  await requirePermission("catalogue.manage");
  const supabase = await createClient();

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("collection_id", id);
  if ((count ?? 0) > 0) {
    return fail(
      `${count} product${count === 1 ? "" : "s"} are still in this collection. Remove them first, or deactivate the collection instead.`,
    );
  }

  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) return logAndFail("collection delete", error, "Could not delete this collection.");

  revalidatePath("/admin/collections");
  return { ok: true, message: "Collection deleted." };
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export async function saveCouponAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("coupons.manage");

  const parsed = adminCouponSchema.safeParse({
    id: text(formData, "id") || undefined,
    code: text(formData, "code"),
    descriptionEn: text(formData, "descriptionEn"),
    discountType: text(formData, "discountType"),
    discountValue: text(formData, "discountValue"),
    minimumOrderAmount: text(formData, "minimumOrderAmount") || "0",
    maximumDiscountAmount: text(formData, "maximumDiscountAmount"),
    startsAt: text(formData, "startsAt"),
    expiresAt: text(formData, "expiresAt"),
    usageLimit: text(formData, "usageLimit"),
    perCustomerLimit: text(formData, "perCustomerLimit"),
    isActive: checkbox(formData, "isActive"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const input = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_coupon", {
    p_payload: {
      id: input.id ?? "",
      code: input.code,
      descriptionEn: input.descriptionEn,
      discountType: input.discountType,
      discountValue: String(input.discountValue),
      minimumOrderAmount: String(input.minimumOrderAmount),
      maximumDiscountAmount:
        input.maximumDiscountAmount === null ? "" : String(input.maximumDiscountAmount),
      startsAt: storeLocalToIso(input.startsAt) ?? "",
      expiresAt: storeLocalToIso(input.expiresAt) ?? "",
      usageLimit: input.usageLimit === null ? "" : String(input.usageLimit),
      perCustomerLimit: input.perCustomerLimit === null ? "" : String(input.perCustomerLimit),
      isActive: String(input.isActive),
    },
  });

  revalidatePath("/admin/coupons");
  if (error) return logAndFail("coupon save", error, "Could not save this coupon.");
  return { ok: true, message: "Coupon saved." };
}

export async function archiveCouponAction(
  couponId: string,
  archived: boolean,
): Promise<ActionResult> {
  await requirePermission("coupons.manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_archive_coupon", {
    p_coupon_id: couponId,
    p_archived: archived,
  });
  revalidatePath("/admin/coupons");
  if (error) return logAndFail("coupon archive", error, "Could not update this coupon.");
  return { ok: true, message: archived ? "Coupon archived." : "Coupon restored." };
}

// ---------------------------------------------------------------------------
// Reviews, messages, newsletter
// ---------------------------------------------------------------------------

export async function moderateReviewAction(
  reviewId: string,
  status: "approved" | "rejected" | "pending",
  note?: string,
): Promise<ActionResult> {
  await requirePermission("reviews.moderate");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_moderate_review", {
    p_review_id: reviewId,
    p_status: status,
    p_note: note ?? null,
  });
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
  if (error) return logAndFail("review moderation", error, "Could not moderate this review.");
  return { ok: true, message: `Review ${status}.` };
}

export async function updateMessageStatusAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("messages.manage");
  const messageId = z.string().uuid().safeParse(text(formData, "messageId"));
  const status = z
    .enum(["new", "read", "replied", "resolved"])
    .safeParse(text(formData, "status"));
  if (!messageId.success || !status.success) return fail("Unknown message or status.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_message_status", {
    p_message_id: messageId.data,
    p_status: status.data,
    p_staff_note: text(formData, "staffNote").slice(0, 1000) || null,
  });

  revalidatePath("/admin/messages");
  revalidatePath("/admin");
  if (error) return logAndFail("message status", error, "Could not update this message.");
  return { ok: true, message: "Message updated." };
}

export async function setNewsletterActiveAction(
  subscriberId: string,
  active: boolean,
): Promise<ActionResult> {
  await requirePermission("newsletter.manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_newsletter_active", {
    p_subscriber_id: subscriberId,
    p_active: active,
  });
  revalidatePath("/admin/newsletter");
  if (error) return logAndFail("newsletter status", error, "Could not update this subscriber.");
  return { ok: true, message: active ? "Subscriber reactivated." : "Subscriber unsubscribed." };
}

// ---------------------------------------------------------------------------
// Settings, staff, customers
// ---------------------------------------------------------------------------

export async function saveSettingsAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("settings.manage");

  const parsed = adminSettingsSchema.safeParse({
    store_name: text(formData, "store_name"),
    support_phone: text(formData, "support_phone"),
    whatsapp_number: text(formData, "whatsapp_number"),
    support_email: text(formData, "support_email"),
    store_address: text(formData, "store_address"),
    facebook_url: text(formData, "facebook_url"),
    instagram_url: text(formData, "instagram_url"),
    tiktok_url: text(formData, "tiktok_url"),
    delivery_fee_inside_sylhet: text(formData, "delivery_fee_inside_sylhet"),
    delivery_fee_outside_sylhet: text(formData, "delivery_fee_outside_sylhet"),
    free_delivery_threshold: text(formData, "free_delivery_threshold"),
    free_delivery_enabled: checkbox(formData, "free_delivery_enabled"),
    free_delivery_division: text(formData, "free_delivery_division"),
    cod_enabled: checkbox(formData, "cod_enabled"),
    maintenance_mode: checkbox(formData, "maintenance_mode"),
    order_notification_email: text(formData, "order_notification_email"),
  });
  if (!parsed.success) return fail(firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_settings", {
    p_settings: parsed.data as never,
  });

  revalidatePath("/admin/settings");
  // The whole storefront reads these values -- the announcement bar, the footer,
  // the contact page, the delivery quote on every cart screen and the
  // organisation structured data -- so the layout is revalidated rather than
  // just this page. Without it a delivery-fee change would be charged
  // immediately but displayed only after the next deploy.
  revalidatePath("/", "layout");
  if (error) return logAndFail("settings_save", error, "Could not save the store settings.");
  return { ok: true, message: "Store settings saved." };
}

export async function setStaffRoleAction(formData: FormData): Promise<ActionResult> {
  await requirePermission("staff.manage");

  const parsed = adminRoleSchema.safeParse({
    profileId: text(formData, "profileId"),
    role: text(formData, "role"),
  });
  if (!parsed.success) return fail("Choose a valid role.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_profile_role", {
    p_profile_id: parsed.data.profileId,
    p_role: parsed.data.role,
  });

  revalidatePath("/admin/staff");
  revalidatePath("/admin/customers");
  if (error) {
    if (error.message.includes("last_admin_protected")) {
      return fail("This is the only administrator. Promote someone else first.");
    }
    if (error.message.includes("cannot_change_own_role")) {
      return fail("You cannot change your own role.");
    }
    return logAndFail("role change", error, "Could not change this role.");
  }
  return { ok: true, message: "Role updated." };
}

export async function setCustomerActiveAction(
  profileId: string,
  active: boolean,
  reason?: string,
): Promise<ActionResult> {
  await requirePermission("customers.manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_customer_active", {
    p_profile_id: profileId,
    p_active: active,
    p_reason: reason ?? null,
  });
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${profileId}`);
  if (error) {
    if (error.message.includes("cannot_change_own_status")) {
      return fail("You cannot deactivate your own account.");
    }
    return logAndFail("customer status", error, "Could not update this customer.");
  }
  return { ok: true, message: active ? "Customer reactivated." : "Customer deactivated." };
}
