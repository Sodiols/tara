import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/ProductForm";

export default async function NewProductPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: collections }] = await Promise.all([
    supabase!.from("categories").select("id,name_en").order("sort_order"),
    supabase!.from("collections").select("id,name_en").order("sort_order"),
  ]);
  return <><h2 className="mb-6 font-serif text-2xl">New product</h2><ProductForm categories={categories ?? []} collections={collections ?? []} /></>;
}
