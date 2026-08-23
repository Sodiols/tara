"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbProps {
  items: { label: string; href?: string }[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li className="flex items-center gap-1.5">
          <Link href="/" className="hover:text-ink transition-colors">
            {"Home"}
          </Link>
          <ChevronRight size={12} aria-hidden="true" />
        </li>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {item.href ? (
              <Link href={item.href} className="hover:text-ink transition-colors">
                {item.label}
              </Link>
            ) : (
              // Only the final crumb is the current page; an unlinked
              // middle crumb (a category with no route of its own) must not
              // claim to be.
              <span className="text-ink" aria-current={i === items.length - 1 ? "page" : undefined}>
                {item.label}
              </span>
            )}
            {i < items.length - 1 && <ChevronRight size={12} aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}
