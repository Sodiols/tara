"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CollectionNavItem } from "./CollectionNavItem";

const navItems = [
  { key: "nav.unstitched", href: "/unstitched-three-piece" },
  { key: "nav.ready", href: "/ready-three-piece" },
  { key: "nav.collection", href: "/collection" },
  { key: "nav.about", href: "/about" },
];

export function DesktopNavigation() {
  const { t } = useLanguage();
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden lg:flex items-center gap-8">
      {navItems.map((item) => {
        if (item.key === "nav.collection") {
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
            {t(item.key)}
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
