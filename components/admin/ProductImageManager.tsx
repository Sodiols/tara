"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  X,
} from "lucide-react";
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
import {
  deleteProductImageAction,
  moveProductImageAction,
  setPrimaryImageAction,
  updateProductImageAltAction,
} from "@/lib/supabase/actions/admin";
import type { Tables } from "@/types/database";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toastStore";
import { ActionButton } from "./AdminForm";
import { Panel, PanelHeader, adminInputClass } from "./ui";
import { uploadPendingImages } from "./upload-pending-images";

/**
 * One image manager, two modes.
 *
 * CREATE MODE works on `File` objects the browser is holding, because the
 * product does not exist yet and a storage path cannot be built without its id.
 * EDIT MODE works on rows that are already in `product_images`.
 *
 * They used to be two unrelated pieces of UI, which is why creating a product
 * felt like being asked for the same images twice: a file input on the create
 * form, then a second, larger file input waiting on the editor immediately
 * afterwards. They now share the thumbnail card, the drop zone, the limits and
 * the language, so the second one reads as optional extra management rather
 * than an unfinished step.
 *
 * Controls are never hover-only. Staff photograph and list stock from a tablet,
 * and a control that only appears on :hover does not exist on a touch screen.
 */

const megabytes = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));

// --- Shared pieces ---------------------------------------------------------

const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-control border border-border bg-taraWhite text-ink transition-colors hover:border-taraWine hover:text-taraWine disabled:cursor-not-allowed disabled:border-border disabled:text-muted/60";

function MainBadge() {
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
function ImageDropZone({
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

// --- Edit mode -------------------------------------------------------------

type ProductImage = Tables<"product_images">;

/**
 * Alt text for one stored image, saved on blur.
 *
 * Not asked for during creation on purpose: making everyday product entry fast
 * matters more than a description that can be written any time, and an empty
 * `alt_en` is already handled everywhere it is rendered.
 */
function AltTextField({
  image,
  productId,
  index,
}: {
  image: ProductImage;
  productId: string;
  index: number;
}) {
  const [value, setValue] = useState(image.alt_en ?? "");
  const [saving, setSaving] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const save = async () => {
    if (value.trim() === (image.alt_en ?? "").trim()) return;
    setSaving(true);
    const result = await updateProductImageAltAction(image.id, productId, value);
    setSaving(false);
    if (!result.ok) addToast(result.message, "error");
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="sr-only">Description for image {index + 1}</span>
      <input
        value={value}
        maxLength={160}
        placeholder="Describe this image"
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        className={cn(adminInputClass, "h-9 text-xs")}
      />
      {saving && (
        <span className="font-sans text-[10px] uppercase tracking-wide text-muted">Saving…</span>
      )}
    </label>
  );
}

/**
 * Image management for a product that already exists.
 *
 * The images the product HAS come first, and the uploader stays behind a button
 * — on the editor it is an optional extra, not the next step in a workflow.
 * Adding several at once goes through the same one-request-per-file queue the
 * create screen uses.
 */
export function ProductImageLibrary({
  productId,
  images,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const addToast = useToastStore((state) => state.addToast);
  const remaining = Math.max(0, MAX_IMAGES_PER_PRODUCT - images.length);
  const pending = usePendingImages(remaining);

  const upload = async () => {
    if (uploading || pending.items.length === 0) return;
    setUploading(true);
    const outcome = await uploadPendingImages({
      productId,
      items: pending.items,
      onProgress: setProgress,
    });
    pending.applyResults(outcome.results);
    setUploading(false);
    setProgress("");

    if (outcome.failed === 0) {
      addToast(
        `${outcome.uploaded} image${outcome.uploaded === 1 ? "" : "s"} added.`,
        "success",
      );
      pending.clear();
      setAdding(false);
    } else {
      addToast(
        `${outcome.uploaded} of ${pending.items.length} images added. Retry the rest below.`,
        "error",
      );
    }
    router.refresh();
  };

  return (
    <Panel id="images">
      <PanelHeader
        title="Product images"
        description="The main image is used on listings, the bag and the invoice."
        actions={
          <div className="flex items-center gap-2">
            <span className="font-sans text-xs text-muted">
              {images.length} / {MAX_IMAGES_PER_PRODUCT} images
            </span>
            <button
              type="button"
              onClick={() => setAdding((open) => !open)}
              disabled={remaining === 0 && !adding}
              className="inline-flex h-10 items-center gap-2 rounded-control border border-border bg-taraWhite px-4 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine disabled:cursor-not-allowed disabled:text-muted"
            >
              {adding ? "Close" : "Add images"}
            </button>
          </div>
        }
      />

      {images.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">
          No images yet. A product without an image still renders, but it will not sell.
        </p>
      ) : (
        <ul className="grid gap-4 px-5 py-5 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="overflow-hidden rounded-panel border border-border bg-taraWhite"
            >
              <div className="relative aspect-[3/4] bg-taraIvory">
                <Image
                  src={image.image_url}
                  alt={image.alt_en || "Product image"}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                />
                {image.is_primary && <MainBadge />}
              </div>
              <div className="flex flex-col gap-2 border-t border-border px-2 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <ActionButton
                    variant="secondary"
                    className="h-9 w-9 px-0"
                    title="Move earlier"
                    disabled={index === 0}
                    action={async () => moveProductImageAction(image.id, productId, "up")}
                  >
                    <ArrowLeft size={15} aria-hidden="true" />
                    <span className="sr-only">Move image {index + 1} earlier</span>
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    className="h-9 w-9 px-0"
                    title="Move later"
                    disabled={index === images.length - 1}
                    action={async () => moveProductImageAction(image.id, productId, "down")}
                  >
                    <ArrowRight size={15} aria-hidden="true" />
                    <span className="sr-only">Move image {index + 1} later</span>
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    className={cn(
                      "h-9 w-9 px-0",
                      image.is_primary && "border-taraWine text-taraWine",
                    )}
                    title={image.is_primary ? "This is the main image" : "Set as main image"}
                    disabled={image.is_primary}
                    action={async () => setPrimaryImageAction(image.id, productId)}
                  >
                    <Star
                      size={15}
                      aria-hidden="true"
                      fill={image.is_primary ? "currentColor" : "none"}
                    />
                    <span className="sr-only">
                      {image.is_primary ? "Main image" : `Make image ${index + 1} the main image`}
                    </span>
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    className="ml-auto h-9 w-9 px-0 text-[#8C2F2F] hover:border-[#8C2F2F]"
                    title="Delete image"
                    confirm={`Delete image ${index + 1}? This removes the file permanently.`}
                    action={async () => deleteProductImageAction(image.id, productId)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    <span className="sr-only">Delete image {index + 1}</span>
                  </ActionButton>
                </div>
                <AltTextField image={image} productId={productId} index={index} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="border-t border-border px-5 py-5">
          {remaining === 0 ? (
            <p className="text-sm text-muted">
              This product already has the maximum of {MAX_IMAGES_PER_PRODUCT} images. Delete one
              to make room.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <PendingImageGrid
                pending={pending}
                limit={remaining}
                disabled={uploading}
                inputId="product-images-more"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={upload}
                  disabled={uploading || pending.items.length === 0}
                  aria-busy={uploading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-taraWine bg-taraWine px-5 font-sans text-[13px] font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack disabled:cursor-not-allowed disabled:border-border disabled:bg-taraIvory disabled:text-muted"
                >
                  {uploading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  {uploading
                    ? "Uploading…"
                    : `Upload ${pending.items.length || ""} image${pending.items.length === 1 ? "" : "s"}`.trim()}
                </button>
                {progress && (
                  <p role="status" className="font-sans text-xs text-muted">
                    {progress}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
