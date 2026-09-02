/**
 * Reading browser storage without letting it take a page down.
 *
 * WHAT WENT WRONG
 * ---------------
 * `SearchOverlay` opened with
 *
 *     const stored = window.localStorage.getItem(RECENT_KEY);
 *     setRecent(stored ? JSON.parse(stored) : []);
 *
 * which is three separate ways to throw inside a render-triggering effect:
 *
 *   1. `window.localStorage` throws on *access* in a browser configured to
 *      block site data, and in some embedded and cross-origin contexts. A
 *      `typeof window` guard does not help; only a try/catch does.
 *   2. `JSON.parse` throws a SyntaxError on anything that is not JSON, and
 *      localStorage is a shared, user-writable namespace — a browser extension,
 *      another tool on the same origin, a half-finished write from a tab that
 *      was closed mid-flight, or simply a person typing into devtools.
 *   3. Valid JSON is not the expected shape. `JSON.parse('{"a":1}')` succeeds,
 *      and the very next line calls `.map()` on it.
 *
 * Any of the three threw out of the effect and took the search overlay with it,
 * for a feature — a list of six recent search terms — that nobody would miss.
 *
 * THE RULE
 * --------
 * Stored data is untrusted input. It is parsed defensively, validated against
 * an expected shape, and on any failure the caller gets the fallback and the
 * bad key is cleared so the same value cannot fail twice. Nothing here throws.
 */

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Reads and validates a JSON value from localStorage.
 *
 * @param isValid narrows the parsed value. Called with `unknown` on purpose:
 *        the point is that nothing about the stored shape is assumed.
 */
export function readStoredJson<T>(
  key: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
): T {
  const store = storage();
  if (!store) return fallback;

  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValid(parsed)) return parsed;
  } catch {
    // Falls through to the cleanup below.
  }

  // Corrupt or foreign data is removed rather than left to fail on every
  // subsequent read. Best effort: a store that throws on read may throw here
  // too, and there is nothing useful to do about that.
  try {
    store.removeItem(key);
  } catch {
    // Ignored deliberately.
  }
  return fallback;
}

/** Writes JSON to localStorage, doing nothing at all if that is not possible. */
export function writeStoredJson(key: string, value: unknown): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // A full quota or a blocked store is not a reason to interrupt the person
    // using the site; the feature simply does not persist for them.
  }
}

/** Guard for a list of non-empty strings — recent searches, saved slugs. */
export function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
