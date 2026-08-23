/**
 * The bag and the wishlist are persisted to localStorage on the shopper's own
 * device, so a release cannot assume the stored shape matches the current one.
 *
 * Before the store went English-only, `name` was saved as `{ en, bn }`. Anyone
 * who filled their bag or wishlist on the old build still carries that object
 * around. Rendering it directly would print "[object Object]" in the bag
 * drawer, the wishlist grid and the checkout summary — so both stores run this
 * through a versioned zustand `migrate` on first load after the upgrade.
 */
export function flattenName(name: unknown): string {
  if (typeof name === "string") return name;
  if (name && typeof name === "object") {
    const legacy = name as { en?: unknown; bn?: unknown };
    if (typeof legacy.en === "string" && legacy.en) return legacy.en;
    if (typeof legacy.bn === "string" && legacy.bn) return legacy.bn;
  }
  return "";
}
