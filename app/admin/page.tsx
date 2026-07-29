import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const [products, orders, messages, reviews] = await Promise.all([
    supabase!.from("products").select("id", { count: "exact", head: true }),
    supabase!.from("orders").select("id", { count: "exact", head: true }),
    supabase!.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase!.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const cards = [["Products", products.count], ["Orders", orders.count], ["New messages", messages.count], ["Pending reviews", reviews.count]];
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, count]) => <div key={String(label)} className="rounded-panel border border-border p-5"><p className="text-sm text-muted">{label}</p><strong className="mt-2 block font-serif text-3xl text-ink">{count ?? 0}</strong></div>)}</div>;
}
