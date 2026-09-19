"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Star, Trash2, Undo2 } from "lucide-react";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/product-images";
import { screenImageCandidates } from "@/lib/product-image-workflow";
import { MEDIA_ROLES, MEDIA_ROLE_LABELS } from "@/lib/product-trust";
import type { EditorDraft, ImageDraft } from "@/lib/product-editor-draft";
import { cn } from "@/lib/utils";
import { ImageDropZone, MainBadge, iconButtonClass } from "../ProductImageManager";
import { Panel, PanelHeader, adminButtonClass, adminInputClass, adminSelectClass } from "../ui";
import { UnsavedBadge, newDraftKey, type DraftUpdater } from "./shared";

/**
 * The product's photographs, arranged in place.
 *
 * New files are held in the browser and shown with a "New" badge; they are
 * uploaded when Save changes is pressed, together with every other change on
 * the page. Order, the main image, the colour each photograph shows, what it
 * shows and its description are all part of the same draft. A deleted
 * photograph stays on screen, faded, with Undo, until the save.
 */
export function EditorImages({
  draft,
  saved,
  update,
  disabled,
  onObjectUrl,
}: {
  draft: EditorDraft;
  saved: EditorDraft;
  update: DraftUpdater;
  disabled: boolean;
  /** Registers a blob: URL so the editor can release it later. */
  onObjectUrl: (url: string, release?: boolean) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  // Which colour the next files belong to. "" means general photographs.
  const [uploadColourKey, setUploadColourKey] = useState("");

  const colours = draft.colours.filter((colour) => !colour.deleted);
  const live = draft.images.filter((image) => !image.deleted);
  const remaining = Math.max(0, MAX_IMAGES_PER_PRODUCT - live.length);
  const primaryKey = draft.primaryKey && live.some((image) => image.key === draft.primaryKey)
    ? draft.primaryKey
    : (live[0]?.key ?? null);
  const savedByKey = new Map(saved.images.map((image) => [image.key, image]));
  const savedOrder = saved.images.map((image) => image.key);

  const change = (key: string, patch: Partial<ImageDraft>) =>
    update((current) => ({
      ...current,
      images: current.images.map((image) => (image.key === key ? { ...image, ...patch } : image)),
    }));

  const move = (key: string, direction: -1 | 1) =>
    update((current) => {
      // Moves among the photographs that are staying, stepping over deleted ones.
      const images = [...current.images];
      const from = images.findIndex((image) => image.key === key);
      let to = from + direction;
      while (to >= 0 && to < images.length && images[to].deleted) to += direction;
      if (from < 0 || to < 0 || to >= images.length) return current;
      [images[from], images[to]] = [images[to], images[from]];
      return { ...current, images };
    });

  const remove = (image: ImageDraft) => {
    if (!image.id) {
      onObjectUrl(image.url, true);
      update((current) => ({ ...current, images: current.images.filter((entry) => entry.key !== image.key) }));
      return;
    }
    change(image.key, { deleted: true });
  };

  const addFiles = (files: File[]) => {
    const current = draft.images.filter((image) => !image.deleted && image.file).map((image) => image.file!);
    const { accepted, rejected } = screenImageCandidates(current, files, current.length + remaining);
    setNotice(rejected.length ? `Skipped ${rejected.join("; ")}.` : "");
    if (accepted.length === 0) return;
    const additions: ImageDraft[] = accepted.map((file) => {
      const url = URL.createObjectURL(file);
      onObjectUrl(url);
      return {
        key: newDraftKey("image"),
        id: null,
        url,
        file,
        colourKey: uploadColourKey || null,
        role: "",
        alt: "",
        deleted: false,
      };
    });
    update((draftNow) => ({ ...draftNow, images: [...draftNow.images, ...additions] }));
  };

  return (
    <Panel id="images">
      <PanelHeader
        title="Product images"
        description="The main image is used on listings, the bag and the invoice. New photographs upload when you save."
        actions={
          <div className="flex items-center gap-2">
            <span className="font-sans text-xs text-muted">
              {live.length} / {MAX_IMAGES_PER_PRODUCT} images
            </span>
            <button
              type="button"
              onClick={() => setAdding((open) => !open)}
              disabled={disabled || (remaining === 0 && !adding)}
              className={adminButtonClass("secondary", "sm")}
            >
              {adding ? "Close" : "Add images"}
            </button>
          </div>
        }
      />

      {adding && (
        <div className="flex flex-col gap-4 border-b border-border px-5 py-5">
          {colours.length > 0 && (
            <label className="flex max-w-sm flex-col gap-1.5">
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-muted">
                These photographs show
              </span>
              <select
                value={uploadColourKey}
                disabled={disabled}
                onChange={(event) => setUploadColourKey(event.target.value)}
                className={adminSelectClass}
              >
                <option value="">General (every colour)</option>
                {colours.map((colour) => (
                  <option key={colour.key} value={colour.key}>
                    {colour.name.trim() || "New colour"}
                  </option>
                ))}
              </select>
              <span className="font-sans text-xs text-muted">Each image can be moved to another colour below.</span>
            </label>
          )}
          <ImageDropZone
            inputId="product-images-more"
            onFiles={addFiles}
            remaining={remaining}
            disabled={disabled}
          />
          {notice && (
            <p role="alert" className="font-sans text-xs leading-5 text-[#8A6A1F]">
              {notice}
            </p>
          )}
        </div>
      )}

      {draft.images.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">
          No images yet. A product without an image still renders, but it will not sell.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 px-5 py-5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {draft.images.map((image) => {
            const position = live.findIndex((entry) => entry.key === image.key);
            const isMain = image.key === primaryKey && !image.deleted;
            const before = savedByKey.get(image.key);
            const moved =
              before && savedOrder.filter((key) => live.some((entry) => entry.key === key)).indexOf(image.key) !== position;
            const unsaved =
              !image.id ||
              (before &&
                (before.colourKey !== image.colourKey ||
                  before.role !== image.role ||
                  before.alt.trim() !== image.alt.trim() ||
                  moved ||
                  (isMain && saved.primaryKey !== image.key)));
            const label = `image ${position + 1}`;

            return (
              <li
                key={image.key}
                className={cn(
                  "overflow-hidden rounded-panel border bg-taraWhite",
                  image.deleted ? "border-dashed border-border opacity-60" : unsaved ? "border-taraWine/50" : "border-border",
                )}
              >
                <div className="relative aspect-[3/4] bg-taraIvory">
                  {image.file ? (
                    // A blob: preview never leaves the browser and cannot go through next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Image
                      src={image.url}
                      alt={image.alt || "Product image"}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                    />
                  )}
                  {isMain && <MainBadge />}
                  <span className="absolute right-2 top-2">
                    {image.deleted ? (
                      <UnsavedBadge label="Will be deleted" />
                    ) : !image.id ? (
                      <UnsavedBadge label="New" />
                    ) : unsaved ? (
                      <UnsavedBadge />
                    ) : null}
                  </span>
                </div>

                {image.deleted ? (
                  <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-2">
                    <span className="font-sans text-[11px] text-muted">Deleted when you save</span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => change(image.key, { deleted: false })}
                      className={adminButtonClass("ghost", "sm")}
                    >
                      <Undo2 size={14} aria-hidden="true" />
                      Undo
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 border-t border-border px-2 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={disabled || position === 0}
                        onClick={() => move(image.key, -1)}
                        aria-label={`Move ${label} earlier`}
                        className={iconButtonClass}
                      >
                        <ArrowLeft size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={disabled || position === live.length - 1}
                        onClick={() => move(image.key, 1)}
                        aria-label={`Move ${label} later`}
                        className={iconButtonClass}
                      >
                        <ArrowRight size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={disabled || isMain}
                        onClick={() => update((current) => ({ ...current, primaryKey: image.key }))}
                        aria-label={isMain ? `${label} is the main image` : `Make ${label} the main image`}
                        aria-pressed={isMain}
                        className={cn(iconButtonClass, isMain && "border-taraWine text-taraWine")}
                      >
                        <Star size={15} aria-hidden="true" fill={isMain ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => remove(image)}
                        aria-label={image.id ? `Delete ${label}` : `Remove ${label}`}
                        className={cn(iconButtonClass, "ml-auto hover:border-[#8C2F2F] hover:text-[#8C2F2F]")}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                    {colours.length > 0 && (
                      <label className="flex flex-col gap-1">
                        <span className="sr-only">Colour for {label}</span>
                        <select
                          value={image.colourKey ?? ""}
                          disabled={disabled}
                          onChange={(event) => change(image.key, { colourKey: event.target.value || null })}
                          className={cn(adminSelectClass, "h-9 text-xs")}
                        >
                          <option value="">General (every colour)</option>
                          {colours.map((colour) => (
                            <option key={colour.key} value={colour.key}>
                              {colour.name.trim() || "New colour"}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="flex flex-col gap-1">
                      <span className="sr-only">What {label} shows</span>
                      <select
                        value={image.role}
                        disabled={disabled}
                        onChange={(event) => change(image.key, { role: event.target.value })}
                        className={cn(adminSelectClass, "h-9 text-xs")}
                      >
                        <option value="">What it shows — not said</option>
                        {MEDIA_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {MEDIA_ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="sr-only">Description for {label}</span>
                      <input
                        value={image.alt}
                        maxLength={160}
                        placeholder="Describe this image"
                        disabled={disabled}
                        onChange={(event) => change(image.key, { alt: event.target.value })}
                        className={cn(adminInputClass, "h-9 text-xs")}
                      />
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
