"use client";

import { Plus, Trash2 } from "lucide-react";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/product-images";
import { cn } from "@/lib/utils";
import { ColourGroup, type ColourDraftsController } from "../ProductColourImages";
import { PendingImageGrid, type PendingImagesController } from "../ProductImageManager";
import { Field, adminButtonClass, adminInputClass } from "../ui";

/**
 * Colours and media — step 2 of the builder.
 *
 * Every product gets its colours defined here, because variants are built from
 * them in step 3 and a colour typed twice is how one product ends up with
 * "Black" and "black". What the administrator chooses is only how the
 * PHOTOGRAPHS are organised:
 *
 *   One gallery            all photographs are general and shown for every
 *                          colour. Right for a product photographed once.
 *   Photos for each colour each colour owns its photographs, and the product
 *   page switches between them when a customer picks a swatch.
 *
 * Switching between the two keeps every file already picked in both — nothing
 * is thrown away by trying the other option — but only the chosen workflow's
 * files are uploaded, and the screen says so.
 */
export function ColoursAndMedia({
  photographsPerColour,
  onModeChange,
  drafts,
  pending,
  createdColourKeys,
  disabled,
}: {
  photographsPerColour: boolean;
  onModeChange: (perColour: boolean) => void;
  drafts: ColourDraftsController;
  pending: PendingImagesController;
  /** Colours that exist in the database already, which cannot be removed here. */
  createdColourKeys: ReadonlySet<string>;
  disabled: boolean;
}) {
  const remaining = MAX_IMAGES_PER_PRODUCT - drafts.totalImages;
  const setAside = photographsPerColour ? pending.items.length : drafts.totalImages;

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-sans text-[12px] font-semibold uppercase tracking-wide text-ink">
          How are the photographs organised?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            {
              value: false,
              title: "One gallery",
              text: "The same photographs for every colour.",
            },
            {
              value: true,
              title: "Photos for each colour",
              text: "The product page switches photographs with the swatch.",
            },
          ].map((option) => (
            <label
              key={String(option.value)}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-control border px-4 py-3 transition-colors",
                photographsPerColour === option.value
                  ? "border-taraWine bg-taraWine/5"
                  : "border-border bg-taraWhite hover:border-taraWine",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <input
                type="radio"
                name="builderPhotographMode"
                checked={photographsPerColour === option.value}
                disabled={disabled}
                onChange={() => onModeChange(option.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-[#702D42]"
              />
              <span>
                <span className="block font-sans text-sm font-semibold text-ink">{option.title}</span>
                <span className="block font-sans text-xs leading-5 text-muted">{option.text}</span>
              </span>
            </label>
          ))}
        </div>
        {setAside > 0 && (
          <p className="text-xs leading-5 text-[#8A6A1F]">
            {setAside} photograph{setAside === 1 ? " is" : "s are"} kept from the other option but
            will not be uploaded unless you switch back.
          </p>
        )}
      </fieldset>

      {!photographsPerColour ? (
        <>
          <div className="flex flex-col gap-3">
            <h3 className="font-sans text-[12px] font-semibold uppercase tracking-wide text-ink">
              Colours
            </h3>
            <ul className="flex flex-col gap-2">
              {drafts.colours.map((colour, index) => {
                const locked = createdColourKeys.has(colour.key);
                const nameId = `colour-name-${colour.key}`;
                return (
                  <li key={colour.key} className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[180px] flex-1">
                      <Field label={`Colour ${index + 1}`} htmlFor={nameId} required>
                        <input
                          id={nameId}
                          value={colour.name}
                          maxLength={60}
                          disabled={disabled}
                          placeholder={index === 0 ? "e.g. Black" : "Another colour"}
                          onChange={(event) => drafts.rename(colour.key, event.target.value)}
                          className={adminInputClass}
                        />
                      </Field>
                    </div>
                    <Field label="Swatch" htmlFor={`colour-hex-${colour.key}`}>
                      <input
                        id={`colour-hex-${colour.key}`}
                        type="color"
                        value={colour.hex}
                        disabled={disabled}
                        onChange={(event) => drafts.recolour(colour.key, event.target.value)}
                        className="h-11 w-16 cursor-pointer rounded-control border border-border bg-taraWhite px-1"
                      />
                    </Field>
                    {!locked && drafts.colours.length > 1 && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => drafts.removeColour(colour.key)}
                        className={adminButtonClass("ghost", "md")}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">Remove</span>
                        <span className="sr-only"> {colour.name.trim() || `colour ${index + 1}`}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div>
              <button
                type="button"
                disabled={disabled}
                onClick={drafts.addColour}
                className={adminButtonClass("secondary", "md")}
              >
                <Plus size={14} aria-hidden="true" />
                Add colour
              </button>
            </div>
            <p className="text-xs leading-5 text-muted">
              A product that comes in one colour still needs that colour named — it is what the
              variant and the order will say.
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-5">
            <h3 className="font-sans text-[12px] font-semibold uppercase tracking-wide text-ink">
              Photographs
            </h3>
            <p className="text-xs leading-5 text-muted">
              The main photograph (★) is the product&rsquo;s cover — on product cards, in search and
              when the page is shared. The rest follow in the order shown.
            </p>
            <PendingImageGrid pending={pending} disabled={disabled} inputId="builder-images" />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-xs leading-5 text-muted">
            Each colour&rsquo;s first photograph is what customers see when they pick it. The first
            photograph of the <strong className="text-ink">first colour</strong> is the product&rsquo;s
            cover; you can point the cover anywhere later in the editor.
          </p>
          <ul className="flex flex-col gap-4">
            {drafts.colours.map((colour, index) => (
              <ColourGroup
                key={colour.key}
                colour={colour}
                index={index}
                disabled={disabled}
                locked={createdColourKeys.has(colour.key) || drafts.colours.length === 1}
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
              className={adminButtonClass("secondary", "md")}
            >
              <Plus size={14} aria-hidden="true" />
              Add colour
            </button>
            <p className="font-sans text-xs text-muted">
              {remaining <= 0
                ? `That is the maximum of ${MAX_IMAGES_PER_PRODUCT} photographs across all colours.`
                : `${remaining} photograph slot${remaining === 1 ? "" : "s"} left across all colours.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
