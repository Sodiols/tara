/**
 * Shrinks a product photograph in the browser before it is uploaded.
 *
 * WHY
 * ---
 * A phone camera produces a 4000×5000, 4–5 MB JPEG. The largest the site ever
 * shows a product image is the zoom view and the half-width gallery on a
 * high-density desktop screen — about 1,920px wide. Storing the camera original
 * cost three ways: a slow upload for staff, egress from storage, and a slow
 * first request on the storefront, because next/image has to decode the whole
 * original before it can encode each responsive size.
 *
 * WHY IN THE BROWSER
 * ------------------
 * Re-encoding on the server would need sharp's native binaries at upload time,
 * which lib/image-validation.ts deliberately avoids depending on. The browser
 * already has a fast image decoder and a canvas.
 *
 * It never blocks an upload: any failure, an unsupported format, or a result
 * that is not actually smaller returns the original file, and the server still
 * validates whatever arrives exactly as before.
 */

/** Longest edge kept. A 3:4 portrait keeps 1,800px of width — above every layout's need. */
export const UPLOAD_MAX_DIMENSION = 2400;
/** Files already this small and within the dimension are left untouched. */
export const UPLOAD_RESIZE_THRESHOLD_BYTES = 900 * 1024;
const JPEG_QUALITY = 0.9;

export function targetDimensions(width: number, height: number, max = UPLOAD_MAX_DIMENSION): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImageForUpload(file: File): Promise<File> {
  // AVIF is already efficient and not every browser can re-encode it; GIFs and
  // anything unexpected go up untouched for the server to judge.
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;

  let bitmap: ImageBitmap | undefined;
  try {
    // "from-image" applies the camera's EXIF orientation, so a portrait photo
    // is not stored sideways once the metadata is gone.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = targetDimensions(bitmap.width, bitmap.height);
    const needsResize = width !== bitmap.width || height !== bitmap.height;
    if (!needsResize && file.size <= UPLOAD_RESIZE_THRESHOLD_BYTES) return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    // A JPEG stays a JPEG. PNG and WebP may carry transparency, so they become
    // WebP, which keeps it — unless this browser cannot encode WebP, in which
    // case toBlob silently hands back a PNG and the original is kept instead.
    const outputType = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    const blob = await canvasToBlob(canvas, outputType, JPEG_QUALITY);
    if (!blob || blob.type !== outputType || blob.size >= file.size) return file;

    const extension = outputType === "image/jpeg" ? "jpg" : "webp";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.${extension}`, { type: outputType, lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
