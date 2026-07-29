import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductInventory } from "@/components/admin/ProductInventory";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: product }, { data: categories }, { data: collections }, { data: variants }, { data: images }] = await Promise.all([
    supabase!.from("products").select("*").eq("id", id).maybeSingle(),
    supabase!.from("categories").select("id,name_en").order("sort_order"),
    supabase!.from("collections").select("id,name_en").order("sort_order"),
    supabase!.from("product_variants").select("*").eq("product_id", id).order("created_at"),
    supabase!.from("product_images").select("*").eq("product_id", id).order("sort_order"),
  ]);
  if (!product) notFound();
  return <><h2 className="mb-6 font-serif text-2xl">Edit product</h2><ProductForm product={product} categories={categories ?? []} collections={collections ?? []} /><ProductInventory productId={product.id} variants={variants ?? []} images={images ?? []} /></>;
}
