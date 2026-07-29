"use client";

import { useLanguage } from "@/lib/i18n";
import { collectionLinks, collectionMenuHeading } from "@/data/navigation";
import { CollectionDropdownItem } from "./CollectionDropdownItem";

interface CollectionDropdownProps {
  id: string;
  onSelect: () => void;
}

export function CollectionDropdown({ id, onSelect }: CollectionDropdownProps) {
  const { pick } = useLanguage();
  const mainLinks = collectionLinks.slice(0, -1);
  const allCollectionsLink = collectionLinks[collectionLinks.length - 1];

  return (
    // Wrapper starts flush against the trigger (top-full, no margin) and carries
    // the visual gap as top padding instead, so the padding area is still part
    // of this element's hit box — an invisible "hover bridge" over the gap that
    // stops mouseleave firing while the cursor crosses from the nav link down
    // into the panel below.
    // Right-aligned (not left-aligned) to the trigger: Collection sits close to
    // the centred logo, and a 340px panel growing rightward from the trigger's
    // left edge would run under the logo. Growing leftward keeps it clear.
    <div className="absolute right-0 top-full w-[340px] pt-5">
      <div
        id={id}
        role="menu"
        aria-label={pick(collectionMenuHeading)}
        className="rounded-[6px] border border-border bg-white p-3 shadow-[0_12px_28px_-8px_rgba(23,23,23,0.16)]"
      >
        <p
          role="presentation"
          className="px-5 pb-2 pt-1 font-sans font-semibold text-[11px] uppercase tracking-[0.08em] text-muted"
        >
          {pick(collectionMenuHeading)}
        </p>
        <div className="flex flex-col">
          {mainLinks.map((item) => (
            <CollectionDropdownItem key={item.href} item={item} onSelect={onSelect} />
          ))}
        </div>
        <div className="my-2 border-t border-border" role="presentation" />
        <CollectionDropdownItem item={allCollectionsLink} onSelect={onSelect} emphasis />
      </div>
    </div>
  );
}
