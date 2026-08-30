"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CollectionNavItem } from "./CollectionNavItem";

/**
 * Shared by the desktop bar and the mobile drawer, so the two cannot list
 * different categories.
 *
 * The labels are the customer-facing wording; the routes keep their original
 * slugs, which are what the database, the sitemap and every shared link use.
 */
const navItems = [
  { label: "Unready Three Piece", href: "/unstitched-three-piece" },
  { label: "Three Piece", href: "/three-piece" },
  { label: "Two Piece", href: "/ready-three-piece" },
  { label: "Hijab", href: "/hijab" },
  { label: "Collection", href: "/collection" },
  { label: "About Us", href: "/about" },
];

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    // gap-6 until xl: the five labels, the logo and the icons all have to fit
    // across a 1024px laptop without the links shrinking. They used to shrink --
    // "Unready Three Piece" rendered in 67px of a 160px label, wrapped over
    // three lines -- because a flex item shrinks below its content by default.
    // shrink-0 and whitespace-nowrap on each link make that impossible.
    <nav
      aria-label="Primary"
      className="hidden shrink-0 items-center gap-6 lg:flex xl:gap-8"
    >
      {navItems.map((item) => {
        if (item.label === "Collection") {
          return <CollectionNavItem key={item.href} />;
        }

        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative shrink-0 whitespace-nowrap font-sans font-medium text-[13px] leading-4 tracking-[0.06em] uppercase text-ink py-2",
              active && "text-wine"
            )}
          >
            {item.label}
            <span
              className={cn(
                "absolute left-0 -bottom-0.5 h-px w-full bg-wine origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100",
                active && "scale-x-100"
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}

export { navItems };
