"use client";

import { saveProductAction } from "@/lib/supabase/actions/admin";
import type { Tables } from "@/types/database";
import { ActionForm, SubmitButton } from "./AdminForm";
import { ProductFields } from "./ProductFields";

type Product = Tables<"products">;
type Option = { id: string; name_en: string };

/**
 * The product editor.
 *
 * Editing only. Creating a product is its own screen (`ProductCreateForm`),
 * because creation is two stages — the row, then the images the browser is
 * already holding — and a plain form post cannot express that.
 *
 * The fields themselves are shared between the two, so nothing can be editable
 * on one screen and missing on the other.
 */
export function ProductForm({
  product,
  categories,
  collections,
}: {
  product: Product;
  categories: Option[];
  collections: Option[];
}) {
  return (
    <ActionForm action={saveProductAction} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={product.id} />

      <ProductFields product={product} categories={categories} collections={collections} />

      <div className="flex flex-wrap gap-3">
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </ActionForm>
  );
}
