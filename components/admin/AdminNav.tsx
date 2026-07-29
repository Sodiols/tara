import Link from "next/link";

const links = ["products", "categories", "collections", "orders", "coupons", "reviews", "customers", "messages", "newsletter"];
export function AdminNav() {
  return <nav className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-4 text-sm">{links.map((item) => <Link key={item} href={`/admin/${item}`} className="capitalize text-muted hover:text-wine">{item}</Link>)}</nav>;
}
