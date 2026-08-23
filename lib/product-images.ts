/**
 * Product image upload limits.
 *
 * Shared by the browser picker (immediate feedback) and the server action
 * (the actual gate). They live here rather than in the action module because a
 * `"use server"` file may only export async functions — and because a single
 * source stops the two sides drifting apart, which would show a customer-facing
 * limit that does not match the one enforced.
 *
 * These are also the limits configured on the `product-images` storage bucket
 * in supabase/TARA_COMPLETE_SETUP.sql, so Supabase rejects an oversized upload
 * even if both layers above it were bypassed.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const MAX_IMAGES_PER_PRODUCT = 12;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

/** The `accept` attribute for a product image file input. */
export const IMAGE_ACCEPT_ATTRIBUTE = ALLOWED_IMAGE_TYPES.join(",");

/**
 * Extension used for the generated storage filename. The uploaded name is never
 * reused, so this maps from the verified MIME type rather than from anything
 * the client supplied.
 */
export const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function isAllowedImageType(type: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}
