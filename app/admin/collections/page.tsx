import { createClient } from "@/lib/supabase/server";
import { TaxonomyAdmin } from "@/components/admin/TaxonomyAdmin";
export default async function CollectionsPage() { const supabase = await createClient(); const { data } = await supabase!.from("collections").select("id,slug,name_en,name_bn,sort_order").order("sort_order"); return <TaxonomyAdmin kind="collections" items={data ?? []} />; }
