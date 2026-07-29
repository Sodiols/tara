import type { Database } from "@/types/database";
import { saveProductAction } from "@/lib/supabase/actions/admin";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Category = Pick<Database["public"]["Tables"]["categories"]["Row"], "id" | "name_en">;
type Collection = Pick<Database["public"]["Tables"]["collections"]["Row"], "id" | "name_en">;

export function ProductForm({ product, categories, collections }: { product?: Product; categories: Category[]; collections: Collection[] }) {
  async function save(formData: FormData) { "use server"; await saveProductAction(formData); }
  const input = "h-11 w-full rounded-control border border-border px-3 text-sm outline-none focus:border-wine";
  return (
    <form action={save} className="grid max-w-3xl gap-5 sm:grid-cols-2">
      {product && <input type="hidden" name="id" value={product.id} />}
      <label className="text-sm">Slug<input name="slug" defaultValue={product?.slug} className={input} required /></label>
      <label className="text-sm">Product code<input name="productCode" defaultValue={product?.product_code} className={input} required /></label>
      <label className="text-sm">English name<input name="nameEn" defaultValue={product?.name_en} className={input} required /></label>
      <label className="text-sm">Bangla name<input name="nameBn" defaultValue={product?.name_bn} className={input} required /></label>
      <label className="text-sm sm:col-span-2">English description<textarea name="descriptionEn" defaultValue={product?.description_en} className="min-h-28 w-full rounded-control border border-border p-3 text-sm" required /></label>
      <label className="text-sm sm:col-span-2">Bangla description<textarea name="descriptionBn" defaultValue={product?.description_bn} className="min-h-28 w-full rounded-control border border-border p-3 text-sm" required /></label>
      <label className="text-sm">Category<select name="categoryId" defaultValue={product?.category_id} className={input}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name_en}</option>)}</select></label>
      <label className="text-sm">Collection<select name="collectionId" defaultValue={product?.collection_id ?? ""} className={input}><option value="">None</option>{collections.map((item) => <option key={item.id} value={item.id}>{item.name_en}</option>)}</select></label>
      <label className="text-sm">Price<input name="basePrice" type="number" min="0" step="0.01" defaultValue={product?.base_price} className={input} required /></label>
      <label className="text-sm">Compare-at price<input name="compareAtPrice" type="number" min="0" step="0.01" defaultValue={product?.compare_at_price ?? ""} className={input} /></label>
      <label className="text-sm">English fabric<input name="fabricEn" defaultValue={product?.fabric_en} className={input} required /></label>
      <label className="text-sm">Bangla fabric<input name="fabricBn" defaultValue={product?.fabric_bn} className={input} required /></label>
      <label className="text-sm">Status<select name="status" defaultValue={product?.status ?? "draft"} className={input}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
      <div className="flex items-end"><button className="h-11 rounded-control bg-wine px-6 text-sm font-semibold text-white">Save product</button></div>
    </form>
  );
}
