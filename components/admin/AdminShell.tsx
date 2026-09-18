"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Archive,
  BarChart3,
  Boxes,
  ClipboardList,
  ExternalLink,
  FileClock,
  FolderTree,
  Gauge,
  LayoutGrid,
  LogOut,
  Mail,
  Megaphone,
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
import type { AdminNavCounts } from "@/lib/supabase/queries/admin";

type CountKey = keyof AdminNavCounts;

interface NavItem {
  href: string;
  label: string;
  icon: typeof Gauge;
  permission?: Permission;
  /** Which sidebar count to show beside this item, when it is above zero. */
  count?: CountKey;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * The back office, grouped by the job being done rather than by table.
 *
 * Sales is what came in, Catalogue is what is for sale, Marketing is what is
 * being promoted, Customer Care is who is waiting for an answer, Insights is
 * how it is going, and Administration is how the shop itself is configured.
 * A new member of staff should be able to guess the group before they look.
 *
 * HIDING A LINK IS NOT THE AUTHORISATION. Every page under /admin checks its
 * own permission on the server (through requirePermission, or through the query
 * it calls), and every mutation is re-checked inside a SECURITY DEFINER
 * function. This list only decides what is worth showing.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Home",
    items: [{ href: "/admin", label: "Dashboard", icon: Gauge }],
  },
  {
    label: "Sales",
    items: [
      {
        href: "/admin/orders",
        label: "Orders",
        icon: ClipboardList,
        permission: "orders.view",
        count: "pendingOrders",
      },
      { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers.view" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, permission: "catalogue.manage" },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes, permission: "inventory.adjust" },
      { href: "/admin/categories", label: "Categories", icon: FolderTree, permission: "catalogue.manage" },
      { href: "/admin/collections", label: "Collections", icon: Store, permission: "catalogue.manage" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/admin/coupons", label: "Coupons", icon: Percent, permission: "coupons.manage" },
      { href: "/admin/launch-offer", label: "Launch offer", icon: Megaphone, permission: "catalogue.manage" },
      {
        href: "/admin/marketing",
        label: "Marketing analytics",
        icon: BarChart3,
        permission: "analytics.view",
      },
      { href: "/admin/newsletter", label: "Newsletter", icon: Send, permission: "newsletter.manage" },
    ],
  },
  {
    label: "Customer care",
    items: [
      {
        href: "/admin/reviews",
        label: "Reviews",
        icon: Star,
        permission: "reviews.moderate",
        count: "pendingReviews",
      },
      {
        href: "/admin/messages",
        label: "Messages",
        icon: Mail,
        permission: "messages.manage",
        count: "unreadMessages",
      },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: LayoutGrid, permission: "analytics.view" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/settings", label: "Store settings", icon: Settings, permission: "settings.manage" },
      { href: "/admin/staff", label: "Staff and roles", icon: ShieldCheck, permission: "staff.manage" },
      { href: "/admin/audit-log", label: "Audit log", icon: FileClock, permission: "audit.view" },
      { href: "/admin/archive", label: "Archive & Trash", icon: Archive, permission: "archive.manage" },
    ],
  },
];

/** What each count means, for the screen-reader text beside the number. */
const COUNT_LABELS: Record<CountKey, string> = {
  pendingOrders: "pending",
  unreadMessages: "unread",
  pendingReviews: "awaiting moderation",
};

function isActiveRoute(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  role,
  name,
  email,
  permissions,
  counts,
  children,
}: {
  role: AppRole;
  name: string;
  email: string;
  permissions: readonly Permission[];
  counts?: AdminNavCounts;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The path the drawer was opened on. When the route changes — a link, the
  // back button, a redirect after saving — the drawer is simply no longer
  // "open for this page", so it closes without an effect having to chase it.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const drawerVisible = drawerOpen && openedOn === pathname;

  const openDrawer = () => {
    setOpenedOn(pathname);
    setDrawerOpen(true);
  };
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    if (!drawerVisible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const release = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      release();
    };
  }, [drawerVisible]);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || permissions.includes(item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  // `onNavigate` is supplied only by the mobile drawer: following a link there
  // must close the overlay, or the new page renders behind it.
  const renderNav = (onNavigate?: () => void) => (
    <nav aria-label="Admin sections" className="flex flex-col gap-5 px-3 py-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActiveRoute(pathname, item.href);
              const Icon = item.icon;
              const count = item.count && counts ? counts[item.count] : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      // 40px rows: comfortable to tap, dense enough that all
                      // seven groups fit a laptop screen without scrolling.
                      "relative flex min-h-10 items-center gap-3 rounded-control px-3 py-2 font-sans text-sm transition-colors",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-taraWine",
                      active
                        ? "bg-taraWine font-semibold text-taraIvory"
                        : "text-ink hover:bg-taraIvory",
                    )}
                  >
                    <Icon size={16} aria-hidden="true" className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {count > 0 && item.count && (
                      <span
                        className={cn(
                          "ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 font-sans text-[11px] font-bold leading-none",
                          active ? "bg-taraIvory text-taraWine" : "bg-taraWine text-taraIvory",
                        )}
                      >
                        {count > 99 ? "99+" : count}
                        <span className="sr-only"> {COUNT_LABELS[item.count]}</span>
                      </span>
                    )}
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
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-sans text-sm font-semibold text-ink">{name}</p>
          <p className="truncate font-sans text-xs text-muted">{email}</p>
        </div>
        <span className="shrink-0 rounded-control border border-taraWine/30 bg-taraWine/8 px-2 py-[3px] font-sans text-[10px] font-bold uppercase tracking-wide text-taraWine">
          {roleLabel(role)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href="/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-control border border-border font-sans text-[11px] font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
        >
          <ExternalLink size={13} aria-hidden="true" />
          Storefront
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-control border border-border font-sans text-[11px] font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine"
          >
            <LogOut size={13} aria-hidden="true" />
            Log out
          </button>
        </form>
      </div>
    </div>
  );

  const brand = (
    <Link
      href="/admin"
      className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4"
      aria-label="TARA Operations — dashboard"
    >
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
    </Link>
  );

  return (
    <div className="min-h-screen bg-taraIvory/40">
      <div className="mx-auto flex w-full max-w-[1680px]">
        {/*
          Desktop sidebar. Three rows — brand, navigation, identity — where only
          the navigation scrolls. On a short laptop screen the list scrolls
          inside the sidebar and "Log out" stays where it always is, rather than
          the whole sidebar scrolling the identity block off the bottom.
        */}
        <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col border-r border-border bg-taraWhite lg:flex">
          {brand}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{renderNav()}</div>
          <div className="shrink-0">{identity}</div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Mobile bar */}
          <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-taraWhite px-4 py-2.5 lg:hidden">
            <button
              type="button"
              onClick={openDrawer}
              aria-label="Open admin menu"
              aria-expanded={drawerVisible}
              aria-controls="admin-drawer"
              className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-border text-ink"
            >
              <Menu size={18} aria-hidden="true" />
            </button>
            <Link href="/admin" aria-label="Dashboard">
              <Image
                src="/logo/logo-black.png"
                alt="TARA"
                width={250}
                height={64}
                className="h-6 w-auto object-contain"
              />
            </Link>
            <span className="max-w-[88px] truncate text-right font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              {roleLabel(role)}
            </span>
          </div>

          <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerVisible && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close admin menu"
            onClick={closeDrawer}
            className="absolute inset-0 bg-taraBlack/40"
          />
          <div
            id="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="animate-slideInLeft absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col bg-taraWhite shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
              <Image
                src="/logo/logo-black.png"
                alt="TARA"
                width={250}
                height={64}
                className="h-7 w-auto object-contain"
              />
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close admin menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-border text-ink"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {renderNav(closeDrawer)}
            </div>
            <div className="shrink-0">{identity}</div>
          </div>
        </div>
      )}
    </div>
  );
}
