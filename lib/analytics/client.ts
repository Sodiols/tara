"use client";

import {
  ANALYTICS_ENDPOINT,
  MAX_EVENTS_PER_BATCH,
  SESSION_IDLE_MS,
  type AnalyticsEventInput,
  type AttributionInput,
} from "./events";
import { referrerHost, utmFromSearch } from "./attribution";
import { sendPageViewToPixels, sendToPixels } from "./pixels";

/**
 * The storefront's own analytics, in the browser.
 *
 * WHAT IT IS ALLOWED TO COST
 * --------------------------
 * Nothing that a customer can feel. Every rule below exists to keep it that
 * way:
 *
 *   * `track()` does no work beyond pushing onto an array and handing the event
 *     to the configured tags. No request is made from it.
 *   * Events are batched and flushed on a timer, when the batch fills, or when
 *     the page is being hidden — whichever comes first.
 *   * The flush uses `sendBeacon` when the page is going away (the browser
 *     delivers it after the page is gone) and a `keepalive` fetch otherwise.
 *     Nothing is ever awaited by anything a customer is waiting for.
 *   * Nothing here throws. Blocked storage, a blocked endpoint, a failed
 *     request and an absent `crypto.randomUUID` are all handled by doing less,
 *     never by breaking the page.
 *
 * IDENTITY
 * --------
 * A random id in `localStorage` for the browser, and a random id in
 * `sessionStorage` for the visit, expiring after 30 minutes of inactivity.
 * Both are meaningless outside this shop, and neither is derived from anything
 * about the person or the device — there is no fingerprinting here of any kind.
 */

const VISITOR_KEY = "tara-visitor-id";
const SESSION_KEY = "tara-session";
const SESSION_TOUCH_KEY = "tara-session-touch";
const FIRST_TOUCH_KEY = "tara-first-touch";

const FLUSH_DELAY_MS = 1200;

/** Reads a key without letting a browser that refuses storage break anything. */
function readStore(kind: "local" | "session", key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    const store = kind === "local" ? window.localStorage : window.sessionStorage;
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(kind: "local" | "session", key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    const store = kind === "local" ? window.localStorage : window.sessionStorage;
    store.setItem(key, value);
  } catch {
    // Private mode, blocked site data, a full quota. The visit is still counted
    // for as long as this page lives; it simply does not persist.
  }
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    // Falls through.
  }
  // A last resort for an old or locked-down engine. The server only requires a
  // UUID shape, and this is one.
  const hex = "0123456789abcdef";
  let out = "";
  for (let index = 0; index < 36; index += 1) {
    if (index === 8 || index === 13 || index === 18 || index === 23) out += "-";
    else if (index === 14) out += "4";
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The browser's id, minted once and kept.
 *
 * A stored value is only accepted if it still looks like a UUID: localStorage
 * is a shared, user-writable namespace, and a value edited by hand would
 * otherwise be posted on every request and rejected on every one.
 */
function visitorId(): string {
  const stored = readStore("local", VISITOR_KEY);
  if (stored && UUID_SHAPE.test(stored)) return stored;
  const minted = randomId();
  writeStore("local", VISITOR_KEY, minted);
  return minted;
}

interface StoredSession {
  id: string;
  lastSeen: number;
}

function parseSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Partial<StoredSession>;
    if (typeof value.id !== "string" || !UUID_SHAPE.test(value.id)) return null;
    if (typeof value.lastSeen !== "number") return null;
    return { id: value.id, lastSeen: value.lastSeen };
  } catch {
    return null;
  }
}

let startedThisSession = false;

/**
 * The current visit's id, and whether this call started it.
 *
 * A new session begins when there is none, or when the last event was more than
 * thirty minutes ago. `started` is what makes `session_started` fire exactly
 * once per visit rather than on every page.
 */
function currentSession(): { id: string; started: boolean } {
  const now = Date.now();
  const existing = parseSession(readStore("session", SESSION_KEY));

  if (existing && now - existing.lastSeen < SESSION_IDLE_MS) {
    writeStore("session", SESSION_KEY, JSON.stringify({ id: existing.id, lastSeen: now }));
    return { id: existing.id, started: false };
  }

  const minted = randomId();
  writeStore("session", SESSION_KEY, JSON.stringify({ id: minted, lastSeen: now }));
  return { id: minted, started: true };
}

function parseAttribution(raw: string | null): AttributionInput | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as AttributionInput;
  } catch {
    return null;
  }
}

function hasCampaign(attribution: AttributionInput): boolean {
  return Boolean(
    attribution.utmSource ||
      attribution.utmMedium ||
      attribution.utmCampaign ||
      attribution.utmContent ||
      attribution.utmTerm ||
      attribution.referrerHost,
  );
}

/**
 * What this visit is attributed to.
 *
 * CAPTURED ONCE, ON THE PAGE THE VISITOR LANDED ON, and then read back from
 * sessionStorage for every page after it. That is what makes an Instagram link
 * still be an Instagram link at the checkout: the parameters are gone from the
 * address bar three pages later, and re-reading the URL would call the order
 * direct.
 *
 * A later page that DOES carry campaign parameters — the same visitor clicking
 * a second ad in the same session — replaces the session's touch, because the
 * most recent campaign is the one that brought them back. First touch is
 * written once in localStorage and never touched again.
 */
function sessionAttribution(freshSession: boolean): AttributionInput {
  const stored = parseAttribution(readStore("session", SESSION_TOUCH_KEY));
  const fromUrl: AttributionInput = {
    ...utmFromSearch(window.location.search),
    referrerHost: referrerHost(document.referrer, window.location.hostname),
    landingPath: window.location.pathname.slice(0, 300),
  };

  const useUrl = freshSession || !stored || hasCampaign(fromUrl);
  const attribution = useUrl ? fromUrl : stored;

  if (useUrl) writeStore("session", SESSION_TOUCH_KEY, JSON.stringify(fromUrl));
  if (!readStore("local", FIRST_TOUCH_KEY)) {
    writeStore("local", FIRST_TOUCH_KEY, JSON.stringify(fromUrl));
  }

  return attribution;
}

// --- The queue -------------------------------------------------------------

let queue: AnalyticsEventInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;

function post(body: string, beacon: boolean): void {
  try {
    if (beacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      // A Blob with the right type, because sendBeacon sends a bare string as
      // text/plain and the route only accepts JSON.
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ANALYTICS_ENDPOINT, blob)) return;
    }
    void fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      // Lets the request outlive the page, and keeps it off the critical path.
      keepalive: true,
    }).catch(() => {
      // A dropped measurement is not worth telling anybody about.
    });
  } catch {
    // Same.
  }
}

function flush(beacon = false): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;

  const events = queue.slice(0, MAX_EVENTS_PER_BATCH);
  queue = queue.slice(MAX_EVENTS_PER_BATCH);

  const session = currentSession();
  const body = JSON.stringify({
    visitorId: visitorId(),
    sessionId: session.id,
    attribution: sessionAttribution(false),
    events,
  });

  post(body, beacon);

  // A batch bigger than one request's worth keeps going.
  if (queue.length > 0) scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DELAY_MS);
}

/**
 * Sends whatever is queued before the page goes away.
 *
 * `visibilitychange` rather than `unload`: on a phone, closing the tab or
 * switching apps often never fires unload at all, which is exactly when a
 * customer leaves. Attached once.
 */
function attachLifecycleListeners(): void {
  if (listenersAttached || typeof document === "undefined") return;
  listenersAttached = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
}

// --- The public surface ----------------------------------------------------

/**
 * Records one event.
 *
 * Returns immediately: the event is queued for TARA's own store and handed to
 * whichever third-party tags are configured. Safe to call from a render-time
 * effect, from an event handler, and from a component that may be rendered on
 * the server (it does nothing there).
 */
export function track(event: AnalyticsEventInput): void {
  if (typeof window === "undefined") return;
  try {
    attachLifecycleListeners();
    queue.push({
      ...event,
      path: event.path ?? window.location.pathname,
    });
    sendToPixels(event);
    if (queue.length >= MAX_EVENTS_PER_BATCH) flush();
    else scheduleFlush();
  } catch {
    // Measurement never interrupts shopping.
  }
}

/**
 * Starts the visit if it is not already started, and records the page.
 *
 * Called by the tracker component on mount and on every route change. The
 * `session_started` event is emitted only by the call that actually began a
 * session, which is what keeps the session count honest across a client-side
 * navigation.
 */
export function trackPageView(path: string, options?: { pixels?: boolean }): void {
  if (typeof window === "undefined") return;
  try {
    const session = currentSession();
    if (session.started || !startedThisSession) {
      // Refreshes the stored touch from this URL when the visit is new.
      sessionAttribution(session.started);
      if (session.started) track({ name: "session_started", path });
      startedThisSession = true;
    }
    track({ name: "page_view", path });
    // The tag snippets count the page they load on themselves, so the FIRST
    // page of a visit is deliberately not reported here — otherwise every
    // landing page would be two page views in GA4 and one in TARA's own store,
    // and the two would never agree again.
    if (options?.pixels !== false) sendPageViewToPixels(path);
  } catch {
    // Same.
  }
}

/** The ids the confirmation screen needs to attribute an order. */
export function currentIdentifiers(): { visitorId: string; sessionId: string } | null {
  if (typeof window === "undefined") return null;
  try {
    return { visitorId: visitorId(), sessionId: currentSession().id };
  } catch {
    return null;
  }
}

/** Sends anything queued right now. Used before a full page navigation. */
export function flushAnalytics(): void {
  flush(true);
}
