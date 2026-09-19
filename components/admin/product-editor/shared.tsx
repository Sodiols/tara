import type { EditorDraft } from "@/lib/product-editor-draft";

/** Every change on the edit screen goes through one of these into the draft. */
export type DraftUpdater = (change: (draft: EditorDraft) => EditorDraft) => void;

let counter = 0;

/** A key for something that does not exist yet. Never a UUID, so it cannot be mistaken for a row id. */
export function newDraftKey(kind: string): string {
  counter += 1;
  return `new-${kind}-${Date.now().toString(36)}-${counter}`;
}

/** Marks a row that differs from what is saved. */
export function UnsavedBadge({ label = "Unsaved" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-control border border-taraWine/40 bg-taraWine/5 px-1.5 py-[1px] font-sans text-[10px] font-bold uppercase tracking-wide text-taraWine">
      {label}
    </span>
  );
}
