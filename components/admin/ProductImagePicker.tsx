"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  IMAGE_ACCEPT_ATTRIBUTE,
  MAX_IMAGES_PER_PRODUCT,
  MAX_IMAGE_BYTES,
  isAllowedImageType,
} from "@/lib/product-images";
import { Field } from "./ui";

interface Picked {
  file: File;
  previewUrl: string;
  key: string;
}

/**
 * Image picker for the create-product form.
 *
 * A product does not exist until it is saved, and the storage path is keyed on
 * the product id — so images chosen here ride along with the form and are
 * uploaded by the server action immediately after the row is inserted.
 *
 * The native file input cannot have individual entries removed, so the selected
 * files are held in state and written back to the input through a DataTransfer
 * list. That keeps the normal form submission intact — no manual FormData
 * assembly, and the input still works if JavaScript re-renders the form.
 *
 * Everything validated here is validated again on the server. This exists to
 * give immediate feedback, not to be the gate.
 */
export function ProductImagePicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [notice, setNotice] = useState<string>("");

  // Mirrors `picked` so the unmount cleanup sees the final list rather than the
  // empty array captured when the effect was first created.
  const pickedRef = useRef<Picked[]>([]);

  // Object URLs leak until they are revoked, so anything still previewing when
  // the form goes away is released here.
  useEffect(() => {
    return () => {
      for (const item of pickedRef.current) URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  const writeBackToInput = (next: Picked[]) => {
    const transfer = new DataTransfer();
    for (const item of next) transfer.items.add(item.file);
    if (inputRef.current) inputRef.current.files = transfer.files;
    pickedRef.current = next;
    setPicked(next);
  };

  const handleSelect = (fileList: FileList | null) => {
    if (!fileList?.length) return;

    const rejected: string[] = [];
    const accepted: Picked[] = [];

    for (const file of Array.from(fileList)) {
      if (picked.length + accepted.length >= MAX_IMAGES_PER_PRODUCT) {
        rejected.push(`${file.name} (limit is ${MAX_IMAGES_PER_PRODUCT} images)`);
        continue;
      }
      if (!isAllowedImageType(file.type)) {
        rejected.push(`${file.name} (not a JPEG, PNG, WebP or AVIF)`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        rejected.push(`${file.name} (larger than 5 MB)`);
        continue;
      }
      // Same file chosen twice in two separate picks.
      const duplicate = [...picked, ...accepted].some(
        (item) => item.file.name === file.name && item.file.size === file.size,
      );
      if (duplicate) continue;

      accepted.push({
        file,
        previewUrl: URL.createObjectURL(file),
        key: `${file.name}-${file.size}-${file.lastModified}`,
      });
    }

    setNotice(rejected.length ? `Skipped: ${rejected.join(", ")}.` : "");
    // Always rewritten, even when nothing was accepted: the browser has already
    // replaced the input's own list with this pick, so leaving it alone would
    // submit files that were just rejected.
    writeBackToInput([...picked, ...accepted]);
  };

  const remove = (key: string) => {
    const target = picked.find((item) => item.key === key);
    if (target) URL.revokeObjectURL(target.previewUrl);
    setNotice("");
    writeBackToInput(picked.filter((item) => item.key !== key));
  };

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Product images"
        htmlFor="product-images"
        hint={`JPEG, PNG, WebP or AVIF · up to 5 MB each · up to ${MAX_IMAGES_PER_PRODUCT} images. The first image becomes the main one.`}
      >
        <input
          ref={inputRef}
          id="product-images"
          name="images"
          type="file"
          multiple
          accept={IMAGE_ACCEPT_ATTRIBUTE}
          // The picker only ever adds. A second pick would otherwise replace
          // the input's list, so handleSelect merges and writes the full set
          // back.
          onChange={(event) => handleSelect(event.target.files)}
          className="block w-full rounded-control border border-border bg-taraWhite px-3 py-[10px] font-sans text-sm text-ink file:mr-3 file:rounded-control file:border-0 file:bg-taraIvory file:px-3 file:py-1.5 file:font-sans file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-taraWine"
        />
      </Field>

      {notice && (
        <p role="alert" className="font-sans text-xs leading-5 text-[#8A6A1F]">
          {notice}
        </p>
      )}

      {picked.length > 0 && (
        <>
          <p className="font-sans text-xs text-muted">
            {picked.length} image{picked.length === 1 ? "" : "s"} ready to upload.
          </p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {picked.map((item, index) => (
              <li
                key={item.key}
                className="relative overflow-hidden rounded-panel border border-border bg-taraIvory"
              >
                <div className="relative aspect-[3/4]">
                  {/*
                    A blob: URL cannot go through next/image, and these previews
                    never leave the browser, so a plain img is correct here.
                  */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {index === 0 && (
                    <span className="absolute left-1.5 top-1.5 rounded-control bg-taraWine px-1.5 py-[2px] font-sans text-[10px] font-bold uppercase tracking-wide text-taraIvory">
                      Main
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.key)}
                  aria-label={`Remove ${item.file.name}`}
                  className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-taraWhite text-ink transition-colors hover:border-[#8C2F2F] hover:text-[#8C2F2F]"
                >
                  <X size={13} aria-hidden="true" />
                </button>
                <p className="truncate px-2 py-1.5 font-sans text-[11px] text-muted">
                  {item.file.name}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
