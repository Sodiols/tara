"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CollectionNavItem } from "./CollectionNavItem";

const navItems = [
  { label: "Unstitched Three Piece", href: "/unstitched-three-piece" },
  { label: "Ready Three Piece", href: "/ready-three-piece" },
  { label: "Collection", href: "/collection" },
  { label: "About Us", href: "/about" },
];

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden lg:flex items-center gap-8">
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
              "group relative font-sans font-medium text-[13px] leading-4 tracking-[0.06em] uppercase text-ink py-2",
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
