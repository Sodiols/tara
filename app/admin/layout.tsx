import type { Metadata } from "next";
import { requireStaff } from "@/lib/supabase/auth";
import { AdminShell } from "@/components/admin/AdminShell";

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

  return (
    <AdminShell
      role={staff.role}
      name={staff.name}
      email={staff.email}
      permissions={staff.permissions}
    >
      {children}
    </AdminShell>
  );
}
