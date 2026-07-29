import type { Database } from "@/types/database";
import { saveTaxonomyAction } from "@/lib/supabase/actions/admin";

type Item = Pick<Database["public"]["Tables"]["categories"]["Row"], "id" | "slug" | "name_en" | "name_bn" | "sort_order">;
export function TaxonomyAdmin({ kind, items }: { kind: "categories" | "collections"; items: Item[] }) {
  async function save(formData: FormData) { "use server"; await saveTaxonomyAction(kind, formData); }
  return <div className="grid gap-8 lg:grid-cols-2"><div><h2 className="mb-4 font-serif text-2xl capitalize">{kind}</h2><div className="divide-y divide-border border-y border-border">{items.map((item) => <div key={item.id} className="flex justify-between py-3 text-sm"><span>{item.name_en}<small className="ml-2 text-muted">{item.name_bn}</small></span><code>{item.slug}</code></div>)}</div></div><form action={save} className="space-y-4 rounded-panel border border-border p-5"><h3 className="font-medium">Add or update</h3>{["slug", "nameEn", "nameBn", "sortOrder"].map((name) => <label key={name} className="block text-sm capitalize">{name.replace(/[A-Z]/g, (m) => ` ${m.toLowerCase()}`)}<input name={name} type={name === "sortOrder" ? "number" : "text"} className="mt-1 h-11 w-full rounded-control border border-border px-3" required={name !== "sortOrder"} /></label>)}<button className="h-11 rounded-control bg-wine px-5 text-sm text-white">Save</button></form></div>;
}
