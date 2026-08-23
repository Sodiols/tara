"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ClipboardList,
  FileClock,
  FolderTree,
  Gauge,
  LayoutGrid,
  LogOut,
  Mail,
  Menu,
  Package,
  Percent,
  Send,
  Settings,
  ShieldCheck,
  Star,
  Store,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/supabase/actions/auth";
import { roleLabel, type AppRole, type Permission } from "@/lib/permissions";
import { lockBodyScroll } from "@/lib/scroll-lock";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Gauge;
  permission?: Permission;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: Gauge },
      { href: "/admin/analytics", label: "Analytics", icon: LayoutGrid, permission: "analytics.view" },
    ],
  },
  {
    label: "Selling",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ClipboardList, permission: "orders.view" },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes, permission: "inventory.adjust" },
      { href: "/admin/products", label: "Products", icon: Package, permission: "catalogue.manage" },
      { href: "/admin/categories", label: "Categories", icon: FolderTree, permission: "catalogue.manage" },
      { href: "/admin/collections", label: "Collections", icon: Store, permission: "catalogue.manage" },
      { href: "/admin/coupons", label: "Coupons", icon: Percent, permission: "coupons.manage" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers.view" },
      { href: "/admin/reviews", label: "Reviews", icon: Star, permission: "reviews.moderate" },
      { href: "/admin/messages", label: "Messages", icon: Mail, permission: "messages.manage" },
      { href: "/admin/newsletter", label: "Newsletter", icon: Send, permission: "newsletter.manage" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/settings", label: "Store settings", icon: Settings, permission: "settings.manage" },
      { href: "/admin/staff", label: "Staff and roles", icon: ShieldCheck, permission: "staff.manage" },
      { href: "/admin/audit-log", label: "Audit log", icon: FileClock, permission: "audit.view" },
    ],
  },
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  role,
  name,
  email,
  permissions,
  children,
}: {
  role: AppRole;
  name: string;
  email: string;
  permissions: readonly Permission[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const release = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      release();
    };
  }, [drawerOpen]);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || permissions.includes(item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  // `onNavigate` is supplied only by the mobile drawer: following a link there
  // must close the overlay, or the new page renders behind it.
  const renderNav = (onNavigate?: () => void) => (
    <nav aria-label="Admin sections" className="flex flex-col gap-6 px-3 py-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-control px-3 py-2 font-sans text-sm transition-colors",
                      active
                        ? "bg-taraWine text-taraIvory"
                        : "text-ink hover:bg-taraIvory",
                    )}
                  >
                    <Icon size={16} aria-hidden="true" className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const identity = (
    <div className="border-t border-border px-5 py-4">
      <p className="truncate font-sans text-sm font-semibold text-ink">{name}</p>
      <p className="truncate font-sans text-xs text-muted">{email}</p>
      <p className="mt-2 inline-flex rounded-control border border-taraWine/30 bg-taraWine/8 px-2 py-[3px] font-sans text-[11px] font-semibold uppercase tracking-wide text-taraWine">
        {roleLabel(role)}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <Link
          href="/"
          className="font-sans text-xs uppercase tracking-wide text-muted underline-offset-4 hover:text-taraWine hover:underline"
        >
          View storefront
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2 font-sans text-xs uppercase tracking-wide text-muted transition-colors hover:text-taraWine"
          >
            <LogOut size={14} aria-hidden="true" />
            Log out
          </button>
        </form>
      </div>
    </div>
  );

  const brand = (
    <div className="flex items-center gap-3 border-b border-border px-5 py-4">
      <Image
        src="/logo/logo-black.png"
        alt="TARA"
        width={250}
        height={64}
        priority
        className="h-7 w-auto object-contain"
      />
      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
        Operations
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-taraIvory/40">
      <div className="mx-auto flex w-full max-w-[1600px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col justify-between overflow-y-auto border-r border-border bg-taraWhite lg:flex">
          <div>
            {brand}
            {renderNav()}
          </div>
          {identity}
        </aside>

        <div className="min-w-0 flex-1">
          {/* Mobile bar */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-taraWhite px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open admin menu"
              aria-expanded={drawerOpen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-border text-ink"
            >
              <Menu size={18} aria-hidden="true" />
            </button>
            <Image
              src="/logo/logo-black.png"
              alt="TARA"
              width={250}
              height={64}
              className="h-6 w-auto object-contain"
            />
            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              {roleLabel(role)}
            </span>
          </div>

          <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close admin menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-taraBlack/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="animate-slideInLeft absolute inset-y-0 left-0 flex w-[86%] max-w-[300px] flex-col justify-between overflow-y-auto bg-taraWhite shadow-xl"
          >
            <div>
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <Image
                  src="/logo/logo-black.png"
                  alt="TARA"
                  width={250}
                  height={64}
                  className="h-7 w-auto object-contain"
                />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close admin menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-border text-ink"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
              {renderNav(() => setDrawerOpen(false))}
            </div>
            {identity}
          </div>
        </div>
      )}
    </div>
  );
}
