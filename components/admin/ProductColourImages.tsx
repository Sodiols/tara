"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Palette,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  IMAGE_ACCEPT_ATTRIBUTE,
  MAX_IMAGES_PER_PRODUCT,
} from "@/lib/product-images";
import {
  moveByKey,
  resolvePrimaryKey,
  screenImageCandidates,
  type UploadOutcome,
} from "@/lib/product-image-workflow";
import { describeColourProblems } from "@/lib/product-colour-images";
import { cn } from "@/lib/utils";
import { Field, Panel, PanelHeader, adminInputClass } from "./ui";

/**
 * Colours and their photographs, on the create screen.
 *
 * WHY THIS EXISTS
 * ---------------
 * A product photographed in three colourways used to arrive as one
 * undifferentiated pile of images, because `product_images` had nowhere to
 * record which colour a photograph showed. The storefront then showed all of
 * them whichever swatch the customer picked. This is the input side of the fix:
 * the administrator groups the files by colour while picking them, and the
 * grouping survives all the way to `product_images.product_colour_id`.
 *
 * WHY THE FILE STATE IS HELD HERE RATHER THAN IN usePendingImages()
 * ----------------------------------------------------------------
 * `usePendingImages` is a hook, so it cannot be called once per colour group —
 * the number of groups changes as the administrator adds and removes colours.
 * More importantly the twelve-image limit is a PRODUCT limit, not a per-colour
 * one: three independent controllers would each let twelve through and the
 * server would reject the thirteenth after the product row already existed.
 * One controller over all the groups is what lets the count and the limit be
 * stated honestly in the UI.
 *
 * It reuses the same leaf helpers as the flat picker — screenImageCandidates,
 * moveByKey, resolvePrimaryKey — so the two paths cannot drift on what a
 * valid file is or on which image becomes the main one.
 */

export interface ColourDraftImage {
  key: string;
  file: File;
  previewUrl: string;
  /** Set once stored, which is what stops a retry uploading the file twice. */
  imageId: string | null;
  error: string | null;
}

export interface ColourDraft {
  /** Client-side identity. Becomes the map key the created colour ids come back under. */
  key: string;
  name: string;
  hex: string;
  images: ColourDraftImage[];
  /** Which of this colour's images leads its gallery. */
  mainKey: string | null;
}

export interface ColourDraftsController {
  colours: ColourDraft[];
  notice: string;
  totalImages: number;
  addColour: () => void;
  removeColour: (colourKey: string) => void;
  rename: (colourKey: string, name: string) => void;
  recolour: (colourKey: string, hex: string) => void;
  addFiles: (colourKey: string, files: File[]) => void;
  removeImage: (colourKey: string, imageKey: string) => void;
  moveImage: (colourKey: string, imageKey: string, direction: -1 | 1) => void;
  setMain: (colourKey: string, imageKey: string) => void;
  /** Every pending file across every colour, in upload order. */
  allImages: () => (ColourDraftImage & { colourKey: string })[];
  applyResults: (results: Map<string, UploadOutcome>) => ColourDraft[];
  /** Names and swatches only — what createProductColoursAction is given. */
  definitions: () => { key: string; nameEn: string; colourHex: string }[];
}

const DEFAULT_HEX = "#702D42";

// The rule itself lives in lib/product-colour-images.ts with the rest of the
// colour logic, so the create screen and the tests apply the same one.
export { describeColourProblems };

export function useColourDrafts(
  limit: number = MAX_IMAGES_PER_PRODUCT,
): ColourDraftsController {
  const [colours, setColours] = useState<ColourDraft[]>([]);
  const [notice, setNotice] = useState("");

  // Kept in step synchronously: an event handler must never screen a new pick
  // against a stale list, and the unmount cleanup has to see the final one
  // rather than the empty array captured when the effect was created.
  const coloursRef = useRef<ColourDraft[]>([]);
  const counter = useRef(0);

  const commit = useCallback((next: ColourDraft[]) => {
    coloursRef.current = next;
    setColours(next);
  }, []);

  // Object URLs are document-lifetime references to blobs. Twelve five-megabyte
  // previews left unrevoked is sixty megabytes held until the tab closes.
  useEffect(() => {
    return () => {
      for (const colour of coloursRef.current) {
        for (const image of colour.images) URL.revokeObjectURL(image.previewUrl);
      }
    };
  }, []);

  const nextKey = (prefix: string) => {
    counter.current += 1;
    return `${prefix}-${counter.current}`;
  };

  const addColour = useCallback(() => {
    setNotice("");
    commit([
      ...coloursRef.current,
      {
        key: nextKey("colour"),
        name: "",
        hex: DEFAULT_HEX,
        images: [],
        mainKey: null,
      },
    ]);
  }, [commit]);

  const removeColour = useCallback(
    (colourKey: string) => {
      const target = coloursRef.current.find((colour) => colour.key === colourKey);
      for (const image of target?.images ?? []) URL.revokeObjectURL(image.previewUrl);
      setNotice("");
      commit(coloursRef.current.filter((colour) => colour.key !== colourKey));
    },
    [commit],
  );

  const patch = useCallback(
    (colourKey: string, change: (colour: ColourDraft) => ColourDraft) => {
      commit(
        coloursRef.current.map((colour) =>
          colour.key === colourKey ? change(colour) : colour,
        ),
      );
    },
    [commit],
  );

  const rename = useCallback(
    (colourKey: string, name: string) => patch(colourKey, (colour) => ({ ...colour, name })),
    [patch],
  );

  const recolour = useCallback(
    (colourKey: string, hex: string) => patch(colourKey, (colour) => ({ ...colour, hex })),
    [patch],
  );

  const addFiles = useCallback(
    (colourKey: string, files: File[]) => {
      const current = coloursRef.current;
      const existingFiles = current.flatMap((colour) =>
        colour.images.map((image) => image.file),
      );

      // Screened against every colour at once, so the limit is the product
      // limit the server will actually enforce.
      const { accepted, rejected } = screenImageCandidates(existingFiles, files, limit);
      setNotice(rejected.length ? `Skipped ${rejected.join("; ")}.` : "");
      if (accepted.length === 0) return;

      const additions = accepted.map((file) => ({
        key: nextKey(`${colourKey}-image`),
        file,
        previewUrl: URL.createObjectURL(file),
        imageId: null,
        error: null,
      }));

      patch(colourKey, (colour) => ({ ...colour, images: [...colour.images, ...additions] }));
    },
    [limit, patch],
  );

  const removeImage = useCallback(
    (colourKey: string, imageKey: string) => {
      const colour = coloursRef.current.find((entry) => entry.key === colourKey);
      const image = colour?.images.find((entry) => entry.key === imageKey);
      if (image) URL.revokeObjectURL(image.previewUrl);
      setNotice("");
      patch(colourKey, (entry) => ({
        ...entry,
        images: entry.images.filter((candidate) => candidate.key !== imageKey),
        mainKey: entry.mainKey === imageKey ? null : entry.mainKey,
      }));
    },
    [patch],
  );

  const moveImage = useCallback(
    (colourKey: string, imageKey: string, direction: -1 | 1) => {
      patch(colourKey, (colour) => ({
        ...colour,
        images: moveByKey(colour.images, imageKey, direction),
      }));
    },
    [patch],
  );

  const setMain = useCallback(
    (colourKey: string, imageKey: string) => {
      patch(colourKey, (colour) => ({ ...colour, mainKey: imageKey }));
    },
    [patch],
  );

  /*
   * Upload order is the order the storefront will show: colour by colour, and
   * within a colour its main image first. That way the sort_order written by
   * applyProductImageOrderAction already matches what the administrator
   * arranged, and the first image of each colour is the one the bag and the
   * order line will use.
   */
  const allImages = useCallback(() => {
    return coloursRef.current.flatMap((colour) => {
      const mainKey = resolvePrimaryKey(colour.images, colour.mainKey);
      const ordered = [
        ...colour.images.filter((image) => image.key === mainKey),
        ...colour.images.filter((image) => image.key !== mainKey),
      ];
      return ordered.map((image) => ({ ...image, colourKey: colour.key }));
    });
  }, []);

  const applyResults = useCallback(
    (results: Map<string, UploadOutcome>) => {
      const merged = coloursRef.current.map((colour) => ({
        ...colour,
        images: colour.images.map((image) => {
          const outcome = results.get(image.key);
          if (!outcome) return image;
          return outcome.ok
            ? { ...image, imageId: outcome.imageId ?? image.imageId, error: null }
            : { ...image, error: outcome.error ?? "Upload failed." };
        }),
      }));
      commit(merged);
      return merged;
    },
    [commit],
  );

  const definitions = useCallback(
    () =>
      coloursRef.current.map((colour) => ({
        key: colour.key,
        nameEn: colour.name.trim(),
        colourHex: colour.hex,
      })),
    [],
  );

  return {
    colours,
    notice,
    totalImages: colours.reduce((count, colour) => count + colour.images.length, 0),
    addColour,
    removeColour,
    rename,
    recolour,
    addFiles,
    removeImage,
    moveImage,
    setMain,
    allImages,
    applyResults,
    definitions,
  };
}

// --- UI --------------------------------------------------------------------

const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-control border border-border bg-taraWhite text-ink transition-colors hover:border-taraWine hover:text-taraWine disabled:cursor-not-allowed disabled:border-border disabled:text-muted/60";

function ColourImageCard({
  image,
  index,
  isMain,
  colourName,
  disabled,
  canMoveEarlier,
  canMoveLater,
  onMove,
  onMain,
  onRemove,
}: {
  image: ColourDraftImage;
  index: number;
  isMain: boolean;
  colourName: string;
  disabled: boolean;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  onMove: (direction: -1 | 1) => void;
  onMain: () => void;
  onRemove: () => void;
}) {
  // The colour is named in every control, because "Move image 2 earlier" is
  // ambiguous on a screen holding three galleries.
  const label = `${colourName || "this colour"} image ${index + 1}`;

  return (
    <li
      className={cn(
        "overflow-hidden rounded-panel border bg-taraWhite",
        image.error ? "border-[#8C2F2F]/50" : "border-border",
      )}
    >
      <div className="relative aspect-[3/4] bg-taraIvory">
        {/* A blob: URL cannot go through next/image, and these previews never
            leave the browser, so a plain img is correct here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.previewUrl} alt="" className="h-full w-full object-cover" />
        {isMain && (
          <span className="absolute left-2 top-2 rounded-control bg-taraWine px-2 py-[3px] font-sans text-[10px] font-bold uppercase tracking-wide text-taraIvory">
            First
          </span>
        )}
        {image.imageId && (
          <span className="absolute right-2 top-2 rounded-control bg-[#2F5D50] px-2 py-[3px] font-sans text-[10px] font-bold uppercase tracking-wide text-taraWhite">
            Uploaded
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 border-t border-border px-2 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={disabled || !canMoveEarlier}
            onClick={() => onMove(-1)}
            aria-label={`Move ${label} earlier`}
            className={iconButtonClass}
          >
            <ArrowLeft size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={disabled || !canMoveLater}
            onClick={() => onMove(1)}
            aria-label={`Move ${label} later`}
            className={iconButtonClass}
          >
            <ArrowRight size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={disabled || isMain}
            onClick={onMain}
            aria-pressed={isMain}
            aria-label={
              isMain
                ? `${label} is shown first for this colour`
                : `Show ${label} first for this colour`
            }
            className={cn(iconButtonClass, isMain && "border-taraWine text-taraWine")}
          >
            <Star size={15} aria-hidden="true" fill={isMain ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            aria-label={`Remove ${label}`}
            className={cn(iconButtonClass, "ml-auto hover:border-[#8C2F2F] hover:text-[#8C2F2F]")}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        {image.error ? (
          <p className="font-sans text-[11px] leading-4 text-[#8C2F2F]">{image.error}</p>
        ) : (
          <p className="truncate font-sans text-[11px] text-muted" title={image.file.name}>
            {isMain ? "Shown first" : `Image ${index + 1}`}
          </p>
        )}
      </div>
    </li>
  );
}

function ColourGroup({
  colour,
  index,
  disabled,
  remaining,
  onRename,
  onRecolour,
  onFiles,
  onRemoveColour,
  onRemoveImage,
  onMoveImage,
  onMain,
}: {
  colour: ColourDraft;
  index: number;
  disabled: boolean;
  remaining: number;
  onRename: (value: string) => void;
  onRecolour: (value: string) => void;
  onFiles: (files: File[]) => void;
  onRemoveColour: () => void;
  onRemoveImage: (imageKey: string) => void;
  onMoveImage: (imageKey: string, direction: -1 | 1) => void;
  onMain: (imageKey: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = `colour-files-${colour.key}`;
  const nameId = `colour-name-${colour.key}`;
  const mainKey = resolvePrimaryKey(colour.images, colour.mainKey);
  const full = remaining <= 0;

  return (
    <li className="rounded-panel border border-border bg-taraWhite">
      <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3">
        <span
          aria-hidden="true"
          className="mb-2 inline-block h-6 w-6 shrink-0 rounded-full border border-border"
          style={{ backgroundColor: colour.hex }}
        />
        <div className="min-w-[180px] flex-1">
          <Field label={`Colour ${index + 1}`} htmlFor={nameId} required>
            <input
              id={nameId}
              value={colour.name}
              maxLength={60}
              disabled={disabled}
              placeholder="Black"
              onChange={(event) => onRename(event.target.value)}
              className={adminInputClass}
            />
          </Field>
        </div>
        <div>
          <Field label="Swatch" htmlFor={`colour-hex-${colour.key}`}>
            <input
              id={`colour-hex-${colour.key}`}
              type="color"
              value={colour.hex}
              disabled={disabled}
              onChange={(event) => onRecolour(event.target.value)}
              className="h-11 w-16 shrink-0 cursor-pointer rounded-control border border-border bg-taraWhite px-1"
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={onRemoveColour}
          disabled={disabled}
          className="mb-1 inline-flex h-10 items-center gap-2 rounded-control border border-border bg-taraWhite px-3 font-sans text-xs font-semibold uppercase tracking-wide text-muted transition-colors hover:border-[#8C2F2F] hover:text-[#8C2F2F] disabled:cursor-not-allowed"
        >
          <Trash2 size={14} aria-hidden="true" />
          Remove{" "}
          <span className="sr-only">
            {colour.name.trim() || `colour ${index + 1}`} and its photographs
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        {colour.images.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {colour.images.map((image, imageIndex) => (
              <ColourImageCard
                key={image.key}
                image={image}
                index={imageIndex}
                isMain={image.key === mainKey}
                colourName={colour.name.trim()}
                disabled={disabled}
                canMoveEarlier={imageIndex > 0}
                canMoveLater={imageIndex < colour.images.length - 1}
                onMove={(direction) => onMoveImage(image.key, direction)}
                onMain={() => onMain(image.key)}
                onRemove={() => onRemoveImage(image.key)}
              />
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple
            accept={IMAGE_ACCEPT_ATTRIBUTE}
            disabled={disabled || full}
            onChange={(event) => {
              const files = event.target.files;
              if (files?.length) onFiles(Array.from(files));
              // Cleared so the same file can be chosen again after removing it.
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="sr-only"
          />
          <label
            htmlFor={inputId}
            className={cn(
              "inline-flex h-10 cursor-pointer items-center gap-2 rounded-control border border-taraWine bg-taraWhite px-4 font-sans text-xs font-semibold uppercase tracking-wide text-taraWine transition-colors hover:bg-taraWine hover:text-taraIvory",
              (disabled || full) && "pointer-events-none opacity-60",
            )}
          >
            <ImagePlus size={15} aria-hidden="true" />
            Add {colour.name.trim() || "colour"} images
          </label>
          <p className="font-sans text-xs text-muted">
            {colour.images.length === 0
              ? "No photographs yet."
              : `${colour.images.length} photograph${colour.images.length === 1 ? "" : "s"} · the first one is shown when this colour is chosen.`}
          </p>
        </div>
      </div>
    </li>
  );
}

/**
 * The "Colours & Images" section of the create screen.
 *
 * Off by default: most products are photographed once, and a form that opens
 * with three empty colour groups would make the common case the slow one. The
 * toggle is what decides which of the two image workflows the create form runs.
 */
export function ColourImagesSection({
  enabled,
  onEnabledChange,
  drafts,
  disabled,
  flatImagesSlot,
}: {
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  drafts: ColourDraftsController;
  disabled: boolean;
  /** The existing single-gallery picker, used when colour options are off. */
  flatImagesSlot: React.ReactNode;
}) {
  const remaining = MAX_IMAGES_PER_PRODUCT - drafts.totalImages;

  return (
    <Panel>
      <PanelHeader
        title="Colours & images"
        description="Group the photographs by colourway so the storefront can switch between them."
        actions={
          <span className="font-sans text-xs text-muted">
            {enabled
              ? `${drafts.totalImages} / ${MAX_IMAGES_PER_PRODUCT} images`
              : "Optional"}
          </span>
        }
      />

      <div className="flex flex-col gap-5 px-5 py-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-sans text-xs font-semibold uppercase tracking-wider text-muted">
            Does this product come in more than one colour?
          </legend>
          <div className="flex flex-wrap gap-2">
            {[
              { value: false, label: "No — one set of photographs" },
              { value: true, label: "Yes — photographs per colour" },
            ].map((option) => (
              <label
                key={String(option.value)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-control border px-4 py-2.5 font-sans text-sm transition-colors",
                  enabled === option.value
                    ? "border-taraWine bg-taraWine/5 text-ink"
                    : "border-border bg-taraWhite text-muted hover:border-taraWine",
                  disabled && "pointer-events-none opacity-60",
                )}
              >
                <input
                  type="radio"
                  name="hasColourOptions"
                  checked={enabled === option.value}
                  disabled={disabled}
                  onChange={() => onEnabledChange(option.value)}
                  className="h-4 w-4 accent-[#702D42]"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {!enabled ? (
          flatImagesSlot
        ) : (
          <div className="flex flex-col gap-4">
            {drafts.colours.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-panel border border-dashed border-border bg-taraIvory/40 px-5 py-8 text-center">
                <Palette size={22} className="text-taraWine" aria-hidden="true" />
                <p className="max-w-sm font-sans text-xs leading-5 text-muted">
                  Add a colour, name it, then choose the photographs that show that
                  colourway. Customers see only the selected colour on the product page.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {drafts.colours.map((colour, index) => (
                  <ColourGroup
                    key={colour.key}
                    colour={colour}
                    index={index}
                    disabled={disabled}
                    remaining={remaining}
                    onRename={(value) => drafts.rename(colour.key, value)}
                    onRecolour={(value) => drafts.recolour(colour.key, value)}
                    onFiles={(files) => drafts.addFiles(colour.key, files)}
                    onRemoveColour={() => drafts.removeColour(colour.key)}
                    onRemoveImage={(imageKey) => drafts.removeImage(colour.key, imageKey)}
                    onMoveImage={(imageKey, direction) =>
                      drafts.moveImage(colour.key, imageKey, direction)
                    }
                    onMain={(imageKey) => drafts.setMain(colour.key, imageKey)}
                  />
                ))}
              </ul>
            )}

            {drafts.notice && (
              <p role="alert" className="font-sans text-xs leading-5 text-[#8A6A1F]">
                {drafts.notice}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={drafts.addColour}
                disabled={disabled}
                className="inline-flex h-11 items-center gap-2 rounded-control border border-taraWine bg-taraWine px-5 font-sans text-[13px] font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack disabled:cursor-not-allowed disabled:border-border disabled:bg-taraIvory disabled:text-muted"
              >
                <Plus size={15} aria-hidden="true" />
                {drafts.colours.length === 0 ? "Add colour" : "Add another colour"}
              </button>
              <p className="font-sans text-xs text-muted">
                {remaining <= 0
                  ? `That is the maximum of ${MAX_IMAGES_PER_PRODUCT} images across all colours.`
                  : `${remaining} image slot${remaining === 1 ? "" : "s"} left across all colours.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
