/**
 * Open-redirect protection for `?returnTo=` parameters.
 *
 * Kept as a standalone, dependency-free module so it can be unit tested — the
 * auth helpers that use it import `server-only`, which cannot run in a test
 * process.
 *
 * The rule is deliberately allow-list shaped: a value is accepted only if it is
 * a same-origin path. Anything that a browser could interpret as pointing
 * somewhere else is discarded in favour of the fallback.
 *
 * Cases this rejects, each of which has been used as a real bypass:
 *   //evil.com          protocol-relative
 *   /\evil.com          backslash — browsers treat "\" as "/" in a URL
 *   /\/evil.com         mixed
 *   https://evil.com    absolute
 *   javascript:alert(1) scheme in the path position
 *   /\tevil.com         control character smuggled into a Location header
 */
export function safeReturnPath(
  value: string | null | undefined,
  fallback = "/account",
): string {
  if (!value) return fallback;

  const trimmed = value.trim();
  if (!trimmed) return fallback;
  // A pathological length is never legitimate and makes header injection and
  // ReDoS-style probing cheaper.
  if (trimmed.length > 512) return fallback;

  // Control characters (including CR/LF and tab) can split a Location header.
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return fallback;

  // Browsers parsing an http(s) URL treat "\" exactly like "/", so "/\evil.com"
  // is protocol-relative in effect even though it does not literally start with
  // "//". Normalising first means one check covers both spellings.
  const normalized = trimmed.replace(/\\/g, "/");

  if (!normalized.startsWith("/")) return fallback;
  if (normalized.startsWith("//")) return fallback;
  // "/ /evil.com" — whitespace after the leading slash collapses in some parsers.
  if (/^\/\s/.test(normalized)) return fallback;
  // "/https://evil.com" style scheme smuggling.
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized.slice(1))) return fallback;

  return trimmed;
}
