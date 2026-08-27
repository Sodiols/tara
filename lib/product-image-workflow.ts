/**
 * The client side of the product image workflow.
 *
 * Creating a product is one action for the administrator and two stages for the
 * system: the row has to exist before a storage path keyed on its id can be
 * written. The files are therefore held in the browser, and uploaded one at a
 * time once the product id comes back.
 *
 * Everything in here is pure and has no React, no DOM and no Supabase in it, so
 * the parts that are easy to get wrong — the order files are sent in, which one
 * is the main image, what happens when the fourth of six fails, and never
 * uploading the same file twice — are covered by tests rather than by clicking
 * through the admin panel.
 *
 * The limits come from ./product-images, which is also what the server action
 * enforces. Nothing here is a security boundary: every file is inspected again
 * on the server, which does not take the browser's word for the type, the size
 * or the count.
 */

import {
  MAX_IMAGES_PER_PRODUCT,
  MAX_IMAGE_BYTES,
  isAllowedImageType,
} from "./product-images";

/**
 * How many uploads may be in flight at once.
 *
 * One. Twelve five-megabyte requests started together is a memory and
 * bandwidth spike on both ends for a couple of seconds saved, and it makes the
 * progress line ("Uploading image 3 of 6") a lie. `runImageUploadQueue` accepts
 * a higher number and clamps it, so a caller can go to two without being able
 * to accidentally ask for twelve.
 */
export const IMAGE_UPLOAD_CONCURRENCY = 1;

/** The ceiling `runImageUploadQueue` clamps to. */
export const MAX_IMAGE_UPLOAD_CONCURRENCY = 2;

// --- Selection -------------------------------------------------------------

/** Anything file-like enough to screen. `File` satisfies this. */
export interface ImageCandidate {
  name: string;
  size: number;
  type: string;
}

export interface ScreenResult<T> {
  accepted: T[];
  /** One human sentence per skipped file, ready to show as a notice. */
  rejected: string[];
}

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

/**
 * Decides which of a freshly picked set of files may join the selection.
 *
 * Rejections are collected rather than thrown: picking eight images of which
 * one is a PDF should add the seven and say so, not refuse the whole pick.
 *
 * The remaining-slots calculation is why this takes the current selection —
 * "up to twelve" has to mean twelve in total, across every separate pick, and
 * on the editor it has to count the images the product already has.
 */
export function screenImageCandidates<T extends ImageCandidate>(
  current: readonly ImageCandidate[],
  incoming: readonly T[],
  limit: number = MAX_IMAGES_PER_PRODUCT,
): ScreenResult<T> {
  const accepted: T[] = [];
  const rejected: string[] = [];
  const seen = [...current];

  for (const candidate of incoming) {
    if (seen.length >= limit) {
      rejected.push(`${candidate.name} — the limit is ${limit} images`);
      continue;
    }
    if (!isAllowedImageType(candidate.type)) {
      rejected.push(`${candidate.name} — not a JPEG, PNG, WebP or AVIF`);
      continue;
    }
    if (candidate.size > MAX_IMAGE_BYTES) {
      rejected.push(`${candidate.name} — larger than ${megabytes(MAX_IMAGE_BYTES)} MB`);
      continue;
    }
    if (candidate.size === 0) {
      rejected.push(`${candidate.name} — the file is empty`);
      continue;
    }
    // The same file picked twice in two separate goes. Silent, because it is a
    // slip rather than a problem, and the thumbnail already shows it is there.
    const duplicate = seen.some(
      (item) => item.name === candidate.name && item.size === candidate.size,
    );
    if (duplicate) continue;

    seen.push(candidate);
    accepted.push(candidate);
  }

  return { accepted, rejected };
}

// --- Ordering and the main image -------------------------------------------

export interface Keyed {
  key: string;
}

/**
 * Moves one entry one place towards the front or the back.
 *
 * Returns the original array when the move would fall off either end, so a
 * caller can compare by identity to know nothing happened.
 */
export function moveByKey<T extends Keyed>(
  items: readonly T[],
  key: string,
  direction: -1 | 1,
): T[] {
  const index = items.findIndex((item) => item.key === key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return items as T[];

  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * The key of the main image.
 *
 * The first image is the default, and stays the default as the selection is
 * reordered — but only until the administrator picks one deliberately. A chosen
 * image that is then removed falls back to the first again rather than leaving
 * the product with no main image.
 */
export function resolvePrimaryKey<T extends Keyed>(
  items: readonly T[],
  preferred: string | null,
): string | null {
  if (items.length === 0) return null;
  if (preferred && items.some((item) => item.key === preferred)) return preferred;
  return items[0].key;
}

/** An entry that may or may not have been stored yet. */
export interface Uploadable extends Keyed {
  /** The `product_images.id`, once the server has stored this file. */
  imageId: string | null;
}

/**
 * The entries that still need sending.
 *
 * This one filter is what makes a retry safe: an image that already carries an
 * id is never handed to the queue again, so retrying after "5 of 6 uploaded"
 * sends the sixth file and nothing else — no duplicate rows, no second copy in
 * the bucket, no second charge on the connection.
 */
export function outstandingUploads<T extends Uploadable>(items: readonly T[]): T[] {
  return items.filter((item) => item.imageId === null);
}

/**
 * The stored image ids, in the order the administrator arranged them.
 *
 * Files that failed simply are not in it, so an order applied after a partial
 * failure describes the images that exist rather than leaving a gap.
 */
export function orderedImageIds(items: readonly Uploadable[]): string[] {
  return items
    .map((item) => item.imageId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/**
 * The id of the image that should end up `is_primary`.
 *
 * Null when the chosen image is not among the ones that stored — in which case
 * the first uploaded image keeps the primary flag it was inserted with, and the
 * product still has exactly one.
 */
export function primaryImageId(
  items: readonly (Uploadable & { key: string })[],
  mainKey: string | null,
): string | null {
  if (!mainKey) return null;
  return items.find((item) => item.key === mainKey)?.imageId ?? null;
}

// --- The upload queue ------------------------------------------------------

export interface UploadOutcome {
  ok: boolean;
  /** The `product_images.id` written by the server, when it succeeded. */
  imageId?: string;
  /** A sentence to show against the thumbnail, when it did not. */
  error?: string;
}

export interface QueueProgress {
  /** How many of `total` have finished, successfully or not. */
  completed: number;
  total: number;
  /** 1-based position of the item that just started, for "image 3 of 6". */
  position: number;
}

/**
 * Runs the uploads, in order, at most `concurrency` at a time.
 *
 * The caller passes only the files that still need uploading — an item that
 * already carries an image id is never handed to this — so a retry after a
 * partial failure re-sends the one that failed and nothing else.
 *
 * A rejected upload promise is turned into a failed outcome rather than being
 * allowed to escape: one unreachable request must not abandon the queue and
 * lose the record of what did succeed.
 */
export async function runImageUploadQueue<T extends Keyed>({
  items,
  upload,
  concurrency = IMAGE_UPLOAD_CONCURRENCY,
  onProgress,
}: {
  items: readonly T[];
  upload: (item: T, index: number) => Promise<UploadOutcome>;
  concurrency?: number;
  onProgress?: (progress: QueueProgress) => void;
}): Promise<Map<string, UploadOutcome>> {
  const results = new Map<string, UploadOutcome>();
  const total = items.length;
  if (total === 0) return results;

  const lanes = Math.min(
    Math.max(1, Math.floor(concurrency) || 1),
    MAX_IMAGE_UPLOAD_CONCURRENCY,
    total,
  );

  let cursor = 0;
  let completed = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor;
      if (index >= total) return;
      cursor += 1;

      const item = items[index];
      onProgress?.({ completed, total, position: index + 1 });

      let outcome: UploadOutcome;
      try {
        outcome = await upload(item, index);
      } catch {
        outcome = { ok: false, error: "The upload did not complete. Try again." };
      }

      results.set(item.key, outcome);
      completed += 1;
      onProgress?.({ completed, total, position: index + 1 });
    }
  };

  await Promise.all(Array.from({ length: lanes }, () => worker()));
  return results;
}

// --- Reporting -------------------------------------------------------------

/**
 * The sentence shown when not every image made it.
 *
 * Deliberately concrete about both numbers: "some images failed" leaves a staff
 * member unsure whether anything was saved at all, which is exactly when they
 * start the product again and create a duplicate.
 */
export function describePartialUpload(uploaded: number, total: number): string {
  const failed = total - uploaded;
  if (failed <= 0) {
    return `${total} image${total === 1 ? "" : "s"} uploaded.`;
  }
  return (
    `${uploaded} of ${total} image${total === 1 ? "" : "s"} uploaded. ` +
    `${failed} image${failed === 1 ? "" : "s"} could not be uploaded.`
  );
}
