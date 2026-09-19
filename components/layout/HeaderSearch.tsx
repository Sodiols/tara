"use client";

import { Search as SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The search field in the header.
 *
 * It looks like a field so visitors see at once where to search, and pressing
 * it opens the full search panel — the input, recent searches, suggested
 * keywords and popular categories — which is where the typing happens.
 */
export function HeaderSearch({ className, onOpen }: { className?: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search"
      aria-haspopup="dialog"
      className={cn(
        "group flex h-10 w-full items-center rounded-full border-[1.5px] border-ink bg-white pl-3.5 pr-1 text-left transition-colors hover:border-wine sm:h-11 sm:pl-5",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate text-sm text-muted sm:text-[15px]">
        <span className="sm:hidden">Search</span>
        <span className="hidden sm:inline">Search for anything</span>
      </span>
      <span
        aria-hidden="true"
        className="ml-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wine text-white transition-colors group-hover:bg-ink sm:ml-2 sm:h-9 sm:w-9"
      >
        <SearchIcon size={16} strokeWidth={2.5} />
      </span>
    </button>
  );
}
