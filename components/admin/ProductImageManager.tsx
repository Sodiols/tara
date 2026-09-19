"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Star, X } from "lucide-react";
import {
  IMAGE_ACCEPT_ATTRIBUTE,
  MAX_IMAGES_PER_PRODUCT,
  MAX_IMAGE_BYTES,
} from "@/lib/product-images";
import {
  moveByKey,
  resolvePrimaryKey,
  screenImageCandidates,
  type UploadOutcome,
} from "@/lib/product-image-workflow";
import { cn } from "@/lib/utils";

/**
 * The shared pieces of product image handling.
 *
 * The Product Builder holds picked `File` objects here until the product
 * exists. The product editor (components/admin/product-editor) holds new files
 * the same way until Save changes, and reuses the drop zone and the badge, so
 * both screens share the limits, the thumbnails and the language.
 *
 * Controls are never hover-only. Staff photograph and list stock from a tablet,
 * and a control that only appears on :hover does not exist on a touch screen.
 */

const megabytes = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));

// --- Shared pieces ---------------------------------------------------------

export const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-control border border-border bg-taraWhite text-ink transition-colors hover:border-taraWine hover:text-taraWine disabled:cursor-not-allowed disabled:border-border disabled:text-muted/60";

export function MainBadge() {
  return (
    <span className="absolute left-2 top-2 rounded-control bg-taraWine px-2 py-[3px] font-sans text-[10px] font-bold uppercase tracking-wide text-taraIvory">
      Main
    </span>
  );
}

/**
 * The upload target: a click-to-browse button that is also a drop target.
 *
 * Drag and drop is implemented against the native DataTransfer API rather than
 * with a library — it is a dragover handler and a drop handler, and a
 * twenty-kilobyte dependency to save fifteen lines would be a poor trade in a
 * bundle a staff member loads on a phone connection.
 */
export function ImageDropZone({
  onFiles,
  remaining,
  disabled,
  inputId,
}: {
  onFiles: (files: File[]) => void;
  remaining: number;
  disabled?: boolean;
  inputId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const full = remaining <= 0;

  const take = (list: FileList | null) => {
    if (!list?.length) return;
    onFiles(Array.from(list));
    // Cleared so choosing the same file again after removing it still fires a
    // change event.
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      onDragOver={(event) => {
        if (disabled || full) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        if (disabled || full) return;
        event.preventDefault();
        setDragging(false);
        take(event.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-panel border border-dashed px-5 py-8 text-center transition-colors",
        dragging ? "border-taraWine bg-taraWine/5" : "border-border bg-taraIvory/40",
        (disabled || full) && "opacity-60",
      )}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept={IMAGE_ACCEPT_ATTRIBUTE}
        disabled={disabled || full}
        onChange={(event) => take(event.target.files)}
        className="sr-only"
      />
      <ImagePlus size={22} className="text-taraWine" aria-hidden="true" />
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex h-11 cursor-pointer items-center rounded-control border border-taraWine bg-taraWine px-5 font-sans text-[13px] font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack",
          (disabled || full) && "pointer-events-none",
        )}
      >
        Add product images
      </label>
      <p className="max-w-sm font-sans text-xs leading-5 text-muted">
        {full
          ? `That is the maximum of ${MAX_IMAGES_PER_PRODUCT} images.`
          : `Drag files here or browse. JPEG, PNG, WebP or AVIF, up to ${megabytes} MB each. ${remaining} slot${remaining === 1 ? "" : "s"} left.`}
      </p>
    </div>
  );
}

// --- Create mode -----------------------------------------------------------

export interface PendingImage {
  key: string;
  file: File;
  previewUrl: string;
  /**
   * The `product_images.id` once this file has been stored. Its presence is
   * what stops a retry uploading the same file a second time.
   */
  imageId: string | null;
  error: string | null;
}

export interface PendingImagesController {
  items: PendingImage[];
  /** The key of the image that will become `is_primary`. */
  mainKey: string | null;
  notice: string;
  add: (files: File[]) => void;
  remove: (key: string) => void;
  move: (key: string, direction: -1 | 1) => void;
  setMain: (key: string) => void;
  /**
   * Folds the queue's results back into the list, and returns the merged list.
   * The caller needs it immediately — the state update lands a render later,
   * and the image ids are what the ordering call is made from.
   */
  applyResults: (results: Map<string, UploadOutcome>) => PendingImage[];
  clear: () => void;
}

/**
 * Holds the picked files and owns their object URLs.
 *
 * An object URL is a document-lifetime reference to a blob: forget to revoke
 * one and the file stays in memory until the tab is closed. Twelve five-megabyte
 * previews is sixty megabytes of leak on one page, so every removal revokes,
 * and unmount revokes whatever is left.
 */
export function usePendingImages(limit: number = MAX_IMAGES_PER_PRODUCT): PendingImagesController {
  const [items, setItems] = useState<PendingImage[]>([]);
  const [preferredMain, setPreferredMain] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  // Kept in step with `items` synchronously so an event handler never screens a
  // new pick against a stale list, and so the unmount cleanup sees the final
  // one rather than the empty array captured when the effect was created.
  const itemsRef = useRef<PendingImage[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  const commit = useCallback((next: PendingImage[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const add = useCallback(
    (files: File[]) => {
      const current = itemsRef.current;
      const { accepted, rejected } = screenImageCandidates(
        current.map((item) => item.file),
        files,
        limit,
      );
      setNotice(rejected.length ? `Skipped ${rejected.join("; ")}.` : "");
      if (accepted.length === 0) return;

      const additions = accepted.map((file) => {
        counter.current += 1;
        return {
          key: `${counter.current}-${file.name}-${file.size}`,
          file,
          previewUrl: URL.createObjectURL(file),
          imageId: null,
          error: null,
        };
      });
      commit([...current, ...additions]);
    },
    [commit, limit],
  );

  const remove = useCallback(
    (key: string) => {
      const target = itemsRef.current.find((item) => item.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      setNotice("");
      commit(itemsRef.current.filter((item) => item.key !== key));
    },
    [commit],
  );

  const move = useCallback(
    (key: string, direction: -1 | 1) => {
      commit(moveByKey(itemsRef.current, key, direction));
    },
    [commit],
  );

  const applyResults = useCallback(
    (results: Map<string, UploadOutcome>) => {
      const merged = itemsRef.current.map((item) => {
        const outcome = results.get(item.key);
        if (!outcome) return item;
        return outcome.ok
          ? { ...item, imageId: outcome.imageId ?? item.imageId, error: null }
          : { ...item, error: outcome.error ?? "Upload failed." };
      });
      commit(merged);
      return merged;
    },
    [commit],
  );

  const clear = useCallback(() => {
    for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
    setNotice("");
    setPreferredMain(null);
    commit([]);
  }, [commit]);

  return {
    items,
    mainKey: resolvePrimaryKey(items, preferredMain),
    notice,
    add,
    remove,
    move,
    setMain: setPreferredMain,
    applyResults,
    clear,
  };
}

/**
 * The picked-images grid.
 *
 * `uploading` dims the controls without unmounting them, so the thumbnails stay
 * on screen while the queue runs and the administrator can see which file the
 * progress line is talking about.
 */
export function PendingImageGrid({
  pending,
  disabled = false,
  limit = MAX_IMAGES_PER_PRODUCT,
  inputId = "product-images",
}: {
  pending: PendingImagesController;
  disabled?: boolean;
  limit?: number;
  inputId?: string;
}) {
  const { items, mainKey, notice } = pending;

  return (
    <div className="flex flex-col gap-4">
      <ImageDropZone
        inputId={inputId}
        onFiles={pending.add}
        remaining={limit - items.length}
        disabled={disabled}
      />

      {notice && (
        <p role="alert" className="font-sans text-xs leading-5 text-[#8A6A1F]">
          {notice}
        </p>
      )}

      {items.length > 0 && (
        <>
          <p className="font-sans text-xs text-muted">
            {items.length} of {limit} images selected · the main image is shown first on the
            storefront.
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, index) => {
              const isMain = item.key === mainKey;
              return (
                <li
                  key={item.key}
                  className={cn(
                    "overflow-hidden rounded-panel border bg-taraWhite",
                    item.error ? "border-[#8C2F2F]/50" : "border-border",
                  )}
                >
                  <div className="relative aspect-[3/4] bg-taraIvory">
                    {/*
                      A blob: URL cannot go through next/image, and these
                      previews never leave the browser, so a plain img is
                      correct here.
                    */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {isMain && <MainBadge />}
                    {item.imageId && (
                      <span className="absolute right-2 top-2 rounded-control bg-[#2F5D50] px-2 py-[3px] font-sans text-[10px] font-bold uppercase tracking-wide text-taraWhite">
                        Uploaded
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-border px-2 py-2">
                    {/* Wraps rather than overflowing: four 36px controls do not
                        fit across a half-width card on a phone. */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={disabled || index === 0}
                        onClick={() => pending.move(item.key, -1)}
                        aria-label={`Move image ${index + 1} earlier`}
                        className={iconButtonClass}
                      >
                        <ArrowLeft size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={disabled || index === items.length - 1}
                        onClick={() => pending.move(item.key, 1)}
                        aria-label={`Move image ${index + 1} later`}
                        className={iconButtonClass}
                      >
                        <ArrowRight size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={disabled || isMain}
                        onClick={() => pending.setMain(item.key)}
                        aria-label={
                          isMain ? `Image ${index + 1} is the main image` : `Make image ${index + 1} the main image`
                        }
                        aria-pressed={isMain}
                        className={cn(iconButtonClass, isMain && "border-taraWine text-taraWine")}
                      >
                        <Star
                          size={15}
                          aria-hidden="true"
                          fill={isMain ? "currentColor" : "none"}
                        />
                      </button>
                      {/* Already on the product: deleting it is the
                          editor's job, where the delete is real. */}
                      {!item.imageId && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => pending.remove(item.key)}
                          aria-label={`Remove ${item.file.name}`}
                          className={cn(
                            iconButtonClass,
                            "ml-auto hover:border-[#8C2F2F] hover:text-[#8C2F2F]",
                          )}
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    {item.error ? (
                      <p className="font-sans text-[11px] leading-4 text-[#8C2F2F]">{item.error}</p>
                    ) : (
                      <p className="truncate font-sans text-[11px] text-muted" title={item.file.name}>
                        {isMain ? "Main image" : `Image ${index + 1}`}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
