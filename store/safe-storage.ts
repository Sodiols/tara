import type { StateStorage } from "zustand/middleware";

/**
 * Browser storage that cannot take the site down.
 *
 * `localStorage` and `sessionStorage` are not always there and not always
 * usable:
 *
 *   * during server rendering there is no `window` at all;
 *   * Safari in private mode has historically thrown on write once a small
 *     quota is exhausted;
 *   * a browser configured to block site data throws on *access* to the
 *     property, not just on use — so even a `typeof window` guard is not enough
 *     without a try/catch;
 *   * an embedded or cross-origin context can throw a SecurityError.
 *
 * Zustand's `persist` middleware calls straight through to whatever storage it
 * is handed, so any of those throws propagates out of a plain `setState` and
 * takes down the render that triggered it. For the cart that means adding an
 * item crashes the page.
 *
 * This falls back to an in-memory store: persistence quietly stops working for
 * that visitor, which is the correct degradation — they can still shop, their
 * bag still works for the session, and nothing throws.
 */
function createMemoryStorage(): StateStorage {
  const map = new Map<string, string>();
  return {
    getItem: (name) => map.get(name) ?? null,
    setItem: (name, value) => {
      map.set(name, value);
    },
    removeItem: (name) => {
      map.delete(name);
    },
  };
}

const memoryStorage = createMemoryStorage();

/**
 * @param kind which browser store to use. `local` persists across tabs and
 *        restarts (the cart, a deliberate saved list); `session` lasts only for
 *        the tab (a Buy Now selection, which is an intent for right now).
 */
export function safeBrowserStorage(kind: "local" | "session"): StateStorage {
  return {
    getItem: (name) => {
      try {
        if (typeof window === "undefined") return memoryStorage.getItem(name);
        const store = kind === "local" ? window.localStorage : window.sessionStorage;
        return store.getItem(name);
      } catch {
        return memoryStorage.getItem(name);
      }
    },
    setItem: (name, value) => {
      try {
        if (typeof window === "undefined") return memoryStorage.setItem(name, value);
        const store = kind === "local" ? window.localStorage : window.sessionStorage;
        store.setItem(name, value);
      } catch {
        memoryStorage.setItem(name, value);
      }
    },
    removeItem: (name) => {
      try {
        if (typeof window === "undefined") return memoryStorage.removeItem(name);
        const store = kind === "local" ? window.localStorage : window.sessionStorage;
        store.removeItem(name);
      } catch {
        memoryStorage.removeItem(name);
      }
    },
  };
}
