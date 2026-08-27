"use client";

import {
  IMAGE_UPLOAD_CONCURRENCY,
  outstandingUploads,
  runImageUploadQueue,
  type UploadOutcome,
} from "@/lib/product-image-workflow";
import { uploadProductImageAction } from "@/lib/supabase/actions/admin";

/** The shape both callers already have. Deliberately structural rather than
 *  importing the component's `PendingImage`, so this stays a leaf module. */
export interface UploadableImage {
  key: string;
  file: File;
  /** Already stored. Skipped — this is what stops a retry uploading it twice. */
  imageId: string | null;
}

export interface UploadRun {
  results: Map<string, UploadOutcome>;
  uploaded: number;
  failed: number;
}

/**
 * Sends the files the browser is holding, one request per image.
 *
 * The whole point of this module: a product may carry twelve images of five
 * megabytes, and a single server action request that carried all of them would
 * need a sixty-megabyte body limit — which would then apply to every other
 * action in the application. One file per request keeps each one an order of
 * magnitude under the limit, and the administrator sees a single progress
 * line rather than twelve interactions.
 *
 * Files that already have an image id are not re-sent, so retrying after a
 * partial failure uploads only what failed.
 */
export async function uploadPendingImages({
  productId,
  items,
  onProgress,
}: {
  productId: string;
  items: readonly UploadableImage[];
  onProgress?: (message: string) => void;
}): Promise<UploadRun> {
  const outstanding = outstandingUploads(items);

  const results = await runImageUploadQueue({
    items: outstanding,
    concurrency: IMAGE_UPLOAD_CONCURRENCY,
    onProgress: ({ position, total }) =>
      onProgress?.(`Uploading image ${position} of ${total}…`),
    upload: async (item) => {
      const formData = new FormData();
      formData.set("productId", productId);
      formData.set("file", item.file);
      const result = await uploadProductImageAction(formData);
      return result.ok
        ? { ok: true, imageId: result.data?.imageId }
        : { ok: false, error: result.message };
    },
  });

  let uploaded = 0;
  let failed = 0;
  for (const outcome of results.values()) {
    if (outcome.ok) uploaded += 1;
    else failed += 1;
  }

  return { results, uploaded, failed };
}
