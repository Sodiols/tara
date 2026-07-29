"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import type { Database } from "@/types/database";
import {
  addProductImageAction,
  deleteProductImageAction,
  saveVariantAction,
  setPrimaryImageAction,
} from "@/lib/supabase/actions/admin";
import { useToastStore } from "@/store/toastStore";

type Variant = Database["public"]["Tables"]["product_variants"]["Row"];
type ProductImage = Database["public"]["Tables"]["product_images"]["Row"];

const inputClass = "h-10 w-full rounded-control border border-border px-2 font-sans text-sm";
const blankVariant = {
  id: "",
  sku: "",
  size: "",
  colourEn: "",
  colourBn: "",
  colourHex: "#6F263D",
  stockQuantity: "0",
  lowStockThreshold: "3",
};

export function ProductInventory({
  productId,
  variants,
  images,
}: {
  productId: string;
  variants: Variant[];
  images: ProductImage[];
}) {
  const { addToast } = useToastStore();
  const [variantPending, startVariantTransition] = useTransition();
  const [imagePending, startImageTransition] = useTransition();
  const [variantForm, setVariantForm] = useState(blankVariant);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function editVariant(variant: Variant) {
    setVariantForm({
      id: variant.id,
      sku: variant.sku,
      size: variant.size,
      colourEn: variant.colour_en,
      colourBn: variant.colour_bn,
      colourHex: variant.colour_hex,
      stockQuantity: String(variant.stock_quantity),
      lowStockThreshold: String(variant.low_stock_threshold),
    });
  }

  function submitVariant(event: React.FormEvent) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("productId", productId);
    if (variantForm.id) formData.set("id", variantForm.id);
    formData.set("sku", variantForm.sku);
    formData.set("size", variantForm.size);
    formData.set("colourEn", variantForm.colourEn);
    formData.set("colourBn", variantForm.colourBn);
    formData.set("colourHex", variantForm.colourHex);
    formData.set("stockQuantity", variantForm.stockQuantity);
    formData.set("lowStockThreshold", variantForm.lowStockThreshold);
    startVariantTransition(async () => {
      const result = await saveVariantAction(formData);
      addToast(result.message ?? (result.ok ? "Saved." : "Failed."), result.ok ? "success" : "error");
      if (result.ok) setVariantForm(blankVariant);
    });
  }

  function submitImage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("productId", productId);
    startImageTransition(async () => {
      const result = await addProductImageAction(formData);
      addToast(result.message ?? (result.ok ? "Saved." : "Failed."), result.ok ? "success" : "error");
      if (result.ok) form.reset();
    });
  }

  function removeImage(imageId: string) {
    if (!confirm("Delete this image?")) return;
    startImageTransition(async () => {
      const result = await deleteProductImageAction(imageId, productId);
      addToast(result.message ?? "", result.ok ? "success" : "error");
    });
  }

  function makePrimary(imageId: string) {
    startImageTransition(async () => {
      const result = await setPrimaryImageAction(imageId, productId);
      addToast(result.message ?? "", result.ok ? "success" : "error");
    });
  }

  return (
    <div className="mt-12 grid gap-10 lg:grid-cols-2">
      <section>
        <h2 className="mb-4 font-serif text-2xl text-ink">Variants and stock</h2>
        <div className="mb-5 divide-y divide-border border-y border-border">
          {variants.map((variant) => (
            <div key={variant.id} className="flex items-center justify-between py-3 font-sans text-sm">
              <span className="text-ink">
                {variant.sku} · {variant.size} · {variant.colour_en}
              </span>
              <div className="flex items-center gap-3">
                <strong className={variant.stock_quantity <= variant.low_stock_threshold ? "text-wine" : "text-ink"}>
                  {variant.stock_quantity} in stock
                </strong>
                <button
                  type="button"
                  onClick={() => editVariant(variant)}
                  className="text-xs text-wine underline underline-offset-2"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
          {variants.length === 0 && <p className="py-3 font-sans text-sm text-muted">No variants yet.</p>}
        </div>
        <form onSubmit={submitVariant} className="grid grid-cols-2 gap-3">
          {variantForm.id && (
            <p className="col-span-2 font-sans text-xs text-muted">
              Editing {variantForm.sku || "variant"} ·{" "}
              <button type="button" onClick={() => setVariantForm(blankVariant)} className="underline">
                cancel
              </button>
            </p>
          )}
          <label className="font-sans text-xs text-ink">
            SKU
            <input
              value={variantForm.sku}
              onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
              className={inputClass}
              required
            />
          </label>
          <label className="font-sans text-xs text-ink">
            Size
            <input
              value={variantForm.size}
              onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })}
              className={inputClass}
              required
            />
          </label>
          <label className="font-sans text-xs text-ink">
            Colour EN
            <input
              value={variantForm.colourEn}
              onChange={(e) => setVariantForm({ ...variantForm, colourEn: e.target.value })}
              className={inputClass}
              required
            />
          </label>
          <label className="font-sans text-xs text-ink">
            Colour BN
            <input
              value={variantForm.colourBn}
              onChange={(e) => setVariantForm({ ...variantForm, colourBn: e.target.value })}
              className={inputClass}
              required
            />
          </label>
          <label className="font-sans text-xs text-ink">
            Hex
            <input
              value={variantForm.colourHex}
              onChange={(e) => setVariantForm({ ...variantForm, colourHex: e.target.value })}
              className={inputClass}
              required
            />
          </label>
          <label className="font-sans text-xs text-ink">
            Stock
            <input
              type="number"
              min={0}
              value={variantForm.stockQuantity}
              onChange={(e) => setVariantForm({ ...variantForm, stockQuantity: e.target.value })}
              className={inputClass}
              required
            />
          </label>
          <label className="font-sans text-xs text-ink">
            Low stock threshold
            <input
              type="number"
              min={0}
              value={variantForm.lowStockThreshold}
              onChange={(e) => setVariantForm({ ...variantForm, lowStockThreshold: e.target.value })}
              className={inputClass}
              required
            />
          </label>
          <button
            type="submit"
            disabled={variantPending}
            className="col-span-2 h-10 self-end rounded-control bg-wine px-4 font-sans font-semibold text-sm text-white disabled:opacity-60"
          >
            {variantPending ? "Saving…" : variantForm.id ? "Update variant" : "Add variant"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-2xl text-ink">Product images</h2>
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image) => (
            <div key={image.id} className="relative overflow-hidden rounded-control border border-border">
              <div className="relative aspect-square bg-beige">
                <Image src={image.image_url} alt={image.alt_en || ""} fill sizes="150px" className="object-cover" />
              </div>
              {image.is_primary && (
                <span className="absolute left-1.5 top-1.5 rounded-control bg-wine px-1.5 py-0.5 font-sans text-[10px] text-white">
                  Primary
                </span>
              )}
              <div className="flex items-center justify-between gap-1 p-1.5 font-sans text-[11px]">
                {!image.is_primary && (
                  <button type="button" onClick={() => makePrimary(image.id)} className="text-wine underline">
                    Make primary
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  className="ml-auto text-muted hover:text-wine"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {images.length === 0 && <p className="col-span-full font-sans text-sm text-muted">No images yet.</p>}
        </div>
        <form onSubmit={submitImage} className="space-y-3">
          <label className="block font-sans text-xs text-ink">
            Image file (JPEG, PNG, WebP, or AVIF — max 5MB)
            <input
              ref={fileInputRef}
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className={inputClass}
              required
            />
          </label>
          <label className="block font-sans text-xs text-ink">
            Alt text EN
            <input name="altEn" className={inputClass} />
          </label>
          <label className="block font-sans text-xs text-ink">
            Alt text BN
            <input name="altBn" className={inputClass} />
          </label>
          <button
            type="submit"
            disabled={imagePending}
            className="h-10 rounded-control bg-wine px-4 font-sans font-semibold text-sm text-white disabled:opacity-60"
          >
            {imagePending ? "Uploading…" : "Upload image"}
          </button>
        </form>
      </section>
    </div>
  );
}
