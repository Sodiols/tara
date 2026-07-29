import { createClient } from "@/lib/supabase/server";
import { TaxonomyAdmin } from "@/components/admin/TaxonomyAdmin";
export default async function CategoriesPage() { const supabase = await createClient(); const { data } = await supabase!.from("categories").select("id,slug,name_en,name_bn,sort_order").order("sort_order"); return <TaxonomyAdmin kind="categories" items={data ?? []} />; }
