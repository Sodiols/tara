import type { Metadata } from "next";
import { requireStaff } from "@/lib/supabase/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/supabase/queries/admin";

// Every admin screen renders live operational data for one specific staff
// member, so nothing here may be statically generated or shared by a cache.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "TARA Operations",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirects a signed-out visitor to login and a signed-in customer to the
  // storefront. The database enforces the same boundary independently, so a
  // request that bypassed this still cannot read or write anything.
  const staff = await requireStaff();
  // Three head-only counts for the sidebar badges, scoped to what this role may
  // see. Rendered by the layout rather than fetched by the client, so the
  // badges arrive with the page and never flash in afterwards.
  const counts = await getAdminNavCounts(staff.permissions);

  return (
    <AdminShell
      role={staff.role}
      name={staff.name}
      email={staff.email}
      permissions={staff.permissions}
      counts={counts}
    >
      {children}
    </AdminShell>
  );
}
