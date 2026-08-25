import "server-only";

import { captureException, type ReportContext } from "./observability";

/**
 * Structured server logging.
 *
 * Every log line is one JSON object on stdout/stderr, which is what Vercel,
 * Supabase Logs and every log aggregator expect. `console.log("Order failed:",
 * error.message)` is unsearchable once there are two of them; a line that
 * carries `{ event: "checkout.failed", orderNumber, durationMs }` can be
 * filtered, counted and alerted on.
 *
 * WHAT MUST NEVER BE LOGGED
 * -------------------------
 * Passwords, Supabase keys, access or refresh tokens, tracking tokens, session
 * cookies, full customer addresses, and full phone numbers or email addresses.
 * `redact()` below removes the ones that can be recognised structurally, but it
 * is a safety net, not a licence: do not pass secrets in the first place.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minimumLevel(): number {
  const configured = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (configured && configured in LEVEL_ORDER) return LEVEL_ORDER[configured];
  // Debug lines are noise in production and cost money in log storage.
  return process.env.NODE_ENV === "production" ? LEVEL_ORDER.info : LEVEL_ORDER.debug;
}

export type LogContext = Record<string, unknown>;

const SENSITIVE_KEY = /pass|secret|token|key|authorization|cookie|credential/i;
const EMAIL_KEY = /email/i;
const PHONE_KEY = /phone|mobile/i;
const ADDRESS_KEY = /address/i;

/** Keeps enough of an address to find the customer, not enough to identify them. */
function maskEmail(value: string): string {
  const [name, domain] = value.split("@");
  if (!domain) return "[redacted]";
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(value: string): string {
  return value.length <= 4 ? "[redacted]" : `***${value.slice(-4)}`;
}

export function redact(context: LogContext, depth = 0): LogContext {
  if (depth > 4) return {};
  const output: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEY.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string" && EMAIL_KEY.test(key)) {
      output[key] = maskEmail(value);
      continue;
    }
    if (typeof value === "string" && PHONE_KEY.test(key)) {
      output[key] = maskPhone(value);
      continue;
    }
    if (typeof value === "string" && ADDRESS_KEY.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    if (value instanceof Error) {
      output[key] = { name: value.name, message: value.message };
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = redact(value as LogContext, depth + 1);
      continue;
    }
    output[key] = value;
  }

  return output;
}

function emit(level: LogLevel, event: string, context: LogContext = {}) {
  if (LEVEL_ORDER[level] < minimumLevel()) return;

  const line = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "development",
    ...redact(context),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, context?: LogContext) => emit("debug", event, context),
  info: (event: string, context?: LogContext) => emit("info", event, context),
  warn: (event: string, context?: LogContext) => emit("warn", event, context),
  error: (event: string, context?: LogContext) => emit("error", event, context),
};

/**
 * Turns anything that was thrown or returned as a failure into a readable shape.
 *
 * Not everything that reaches here is an `Error`. Supabase and PostgREST report
 * failures as plain objects — `{ message, details, hint, code }` — and this used
 * to fall through to `String(error)`, which for a plain object is the literal
 * text "[object Object]". The result was a log line that recorded that
 * something had failed and nothing whatsoever about what, which is worse than
 * no log at all: it looks like observability while hiding the one field that
 * would have identified the fault.
 *
 * `code`, `details` and `hint` are kept because PostgREST puts the actionable
 * part there — `PGRST202` means the function does not exist, `42883` means a
 * signature mismatch, and the hint often names the fix outright.
 */
export function describeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.cause === undefined ? {} : { cause: String(error.cause) }),
    };
  }

  if (error && typeof error === "object") {
    const row = error as Record<string, unknown>;
    const text = (key: string) => (typeof row[key] === "string" ? (row[key] as string) : undefined);

    return {
      // A shape with no `message` at all is still worth serialising rather than
      // discarding — bounded, so an enormous object cannot fill the log.
      message: text("message") ?? JSON.stringify(row).slice(0, 500),
      ...(text("code") ? { code: text("code") } : {}),
      ...(text("details") ? { details: text("details") } : {}),
      ...(text("hint") ? { hint: text("hint") } : {}),
    };
  }

  return { message: String(error) };
}

/**
 * The single call for "something went wrong here".
 *
 * Writes one structured error line to the platform log AND reports the
 * exception to error monitoring, so a failure cannot be visible in one place
 * and invisible in the other. Both destinations scrub their own payloads.
 *
 * This replaces the scattered `console.error("Order failed:", error.message)`
 * pattern, which was unsearchable, unaggregated, and occasionally leaked a raw
 * Postgres message into a place a customer could see.
 */
export function logFailure(
  event: string,
  error: unknown,
  context: LogContext = {},
): void {
  logger.error(event, { ...context, error: describeError(error) });

  captureException(error, {
    operation: event,
    extra: context as ReportContext["extra"],
  });
}
