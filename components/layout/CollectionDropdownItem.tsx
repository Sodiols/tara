"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavChildLink } from "@/data/navigation";

interface CollectionDropdownItemProps {
  item: NavChildLink;
  onSelect: () => void;
  emphasis?: boolean;
}

export function CollectionDropdownItem({ item, onSelect, emphasis }: CollectionDropdownItemProps) {
  const pathname = usePathname();
  const active = pathname === item.href;

  if (emphasis) {
    return (
      <Link
        href={item.href}
        onClick={onSelect}
        className="flex h-11 items-center px-5 font-sans text-sm font-medium text-wine hover:bg-wine hover:text-taraIvory transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine"
      >
        {item.label}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onSelect}
      className={cn(
        "flex h-11 items-center px-5 font-sans text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine",
        active ? "bg-cream text-wine" : "text-ink hover:bg-cream hover:text-wine"
      )}
    >
      {item.label}
    </Link>
  );
}
