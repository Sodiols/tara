import { requireStaff } from "@/lib/supabase/auth";
import { Container } from "@/components/layout/Container";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <Container className="py-8 lg:py-12"><div className="mb-8 flex items-end justify-between"><div><p className="text-xs uppercase tracking-widest text-wine">TARA Operations</p><h1 className="font-serif text-3xl text-ink">Admin</h1></div></div><AdminNav /><div className="pt-8">{children}</div></Container>;
}
