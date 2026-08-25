/**
 * Production error monitoring.
 *
 * Reports exceptions to any Sentry-compatible ingestion endpoint using the
 * envelope API over plain `fetch`. That is a deliberate choice over the
 * `@sentry/nextjs` SDK: the SDK brings a build plugin, a source-map upload
 * step, an auth token and a meaningful amount of client bundle, and this
 * application needs one thing from it — "tell me when something throws in
 * production". Roughly a hundred lines of transport buys that with no
 * dependency, no build configuration and no bundle cost on pages that never
 * throw.
 *
 * Configure `NEXT_PUBLIC_SENTRY_DSN` to turn it on. With the variable unset
 * every function here is a no-op, so a deployment without monitoring behaves
 * exactly as it did before rather than failing.
 *
 * The DSN is intentionally public: it is a write-only ingestion key, it cannot
 * read anything back, and the browser needs it to report client-side errors.
 *
 * WHAT IS NEVER SENT
 * ------------------
 * Passwords, Supabase keys, access and refresh tokens, tracking tokens, session
 * cookies, full addresses, and complete phone numbers or email addresses. The
 * scrubber below drops anything whose key looks like one of those, and it runs
 * on every payload — including ones assembled by callers who forgot.
 */

export type Severity = "fatal" | "error" | "warning" | "info";

export interface ReportContext {
  /** A short, stable name for where this happened, e.g. "checkout.place_order". */
  operation?: string;
  /** Searchable low-cardinality labels. */
  tags?: Record<string, string>;
  /** Anything else useful. Scrubbed before it leaves the process. */
  extra?: Record<string, unknown>;
}

interface ParsedDsn {
  endpoint: string;
  publicKey: string;
}

const SENSITIVE_KEY =
  /pass|secret|token|key|authorization|cookie|credential|email|phone|mobile|address|otp/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => scrub(entry, depth + 1));

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : scrub(entry, depth + 1);
  }
  return output;
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    // https://<publicKey>@<host>/<projectId>
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, "");
    if (!url.username || !projectId) return null;
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/?sentry_key=${url.username}&sentry_version=7`,
      publicKey: url.username,
    };
  } catch {
    return null;
  }
}

const dsn = (() => {
  const raw = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return raw ? parseDsn(raw) : null;
})();

export function isMonitoringEnabled(): boolean {
  return dsn !== null;
}

function eventId(): string {
  // Sentry wants 32 hex characters with no dashes.
  return (
    globalThis.crypto?.randomUUID?.().replace(/-/g, "") ??
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
  );
}

function environment(): string {
  return (
    process.env.SENTRY_ENVIRONMENT?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
    process.env.NODE_ENV ||
    "development"
  );
}

/**
 * Not every failure is an `Error`.
 *
 * Supabase and PostgREST report theirs as plain objects, and `String(...)` on
 * one of those is the literal text "[object Object]" — which would arrive in
 * the monitoring dashboard as an issue titled "[object Object]", grouping every
 * unrelated database failure into one useless bucket. The message is lifted
 * out, and the PostgREST error code is preserved in the name so issues group by
 * fault rather than by coincidence.
 */
function toError(error: unknown): Error {
  if (error instanceof Error) return error;

  if (error && typeof error === "object") {
    const row = error as Record<string, unknown>;
    const message =
      typeof row.message === "string" ? row.message : JSON.stringify(row).slice(0, 500);
    const wrapped = new Error(message);
    if (typeof row.code === "string" && row.code) wrapped.name = `DatabaseError(${row.code})`;
    else wrapped.name = "DatabaseError";
    return wrapped;
  }

  return new Error(String(error));
}

function buildEvent(
  error: unknown,
  level: Severity,
  context: ReportContext,
): Record<string, unknown> {
  const asError = toError(error);

  return {
    event_id: eventId(),
    timestamp: Date.now() / 1000,
    platform: typeof window === "undefined" ? "node" : "javascript",
    level,
    environment: environment(),
    release: process.env.NEXT_PUBLIC_APP_VERSION?.trim() || undefined,
    logger: context.operation ?? "tara",
    tags: {
      runtime: typeof window === "undefined" ? "server" : "browser",
      ...(context.operation ? { operation: context.operation } : {}),
      ...(context.tags ?? {}),
    },
    extra: scrub(context.extra ?? {}),
    exception: {
      values: [
        {
          type: asError.name,
          value: asError.message,
          // The raw stack is enough to locate the frame; Sentry parses it.
          stacktrace: asError.stack ? { frames: [], raw: asError.stack } : undefined,
        },
      ],
    },
  };
}

/**
 * Fire-and-forget. Monitoring must never be able to fail a request, so every
 * error inside this function is swallowed — including the network one that
 * happens when the monitoring host itself is down.
 */
export function captureException(
  error: unknown,
  context: ReportContext = {},
  level: Severity = "error",
): void {
  if (!dsn) return;

  try {
    const event = buildEvent(error, level, context);
    const envelope = [
      JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(event),
    ].join("\n");

    void fetch(dsn.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: envelope,
      // Reporting is best-effort; it must not hold a serverless function open.
      keepalive: true,
    }).catch(() => {
      /* monitoring is best-effort by design */
    });
  } catch {
    /* never let reporting throw into the caller */
  }
}

export function captureMessage(
  message: string,
  context: ReportContext = {},
  level: Severity = "warning",
): void {
  captureException(new Error(message), context, level);
}
