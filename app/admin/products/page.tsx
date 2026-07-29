import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { archiveProductAction } from "@/lib/supabase/actions/admin";
import { formatPrice } from "@/lib/utils";

export default async function AdminProductsPage() {
  const supabase = await createClient();
  const { data } = await supabase!.from("products").select("*").order("updated_at", { ascending: false });
  return <><div className="mb-6 flex items-center justify-between"><h2 className="font-serif text-2xl">Products</h2><Link href="/admin/products/new" className="rounded-control bg-wine px-4 py-2 text-sm text-white">New product</Link></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border text-muted"><th className="py-3">Product</th><th>Code</th><th>Price</th><th>Status</th><th /></tr></thead><tbody>{(data ?? []).map((product) => <tr key={product.id} className="border-b border-border"><td className="py-4">{product.name_en}</td><td>{product.product_code}</td><td>{formatPrice(Number(product.base_price))}</td><td className="capitalize">{product.status}</td><td className="text-right"><Link href={`/admin/products/${product.id}`} className="mr-4 text-wine">Edit</Link><form action={async () => { "use server"; await archiveProductAction(product.id); }} className="inline"><button className="text-muted">Archive</button></form></td></tr>)}</tbody></table></div></>;
}
