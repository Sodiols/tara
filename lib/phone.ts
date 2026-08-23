/**
 * Bangladesh mobile number handling.
 *
 * Mirrors `public.normalize_bd_phone()` in
 * supabase/migrations/0002_production_hardening.sql so the client, the server
 * action and the database all agree on what "the same number" means — which
 * matters because COD abuse throttling is keyed on the normalised form.
 *
 * Accepted input:  01712345678, 8801712345678, +8801712345678,
 *                  +880 1712-345678, 01712 345 678
 * Canonical form:  01712345678
 */

const LOCAL_PATTERN = /^01[3-9]\d{8}$/;

export function normalizeBdPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/\D/g, "");

  if (/^88(01[3-9]\d{8})$/.test(digits)) {
    digits = digits.slice(2);
  } else if (/^1[3-9]\d{8}$/.test(digits)) {
    digits = `0${digits}`;
  }

  return LOCAL_PATTERN.test(digits) ? digits : null;
}

export function isValidBdPhone(input: string | null | undefined): boolean {
  return normalizeBdPhone(input) !== null;
}

/** Display form used across the storefront and invoices: 01712-345678. */
export function formatBdPhone(input: string | null | undefined): string {
  const normalized = normalizeBdPhone(input);
  if (!normalized) return input?.trim() ?? "";
  return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
}

/** International form for `tel:` and WhatsApp links. */
export function toInternationalBdPhone(input: string | null | undefined): string | null {
  const normalized = normalizeBdPhone(input);
  return normalized ? `+88${normalized}` : null;
}

/** Digits-only international form, which is what wa.me expects. */
export function toWhatsAppNumber(input: string | null | undefined): string | null {
  const normalized = normalizeBdPhone(input);
  return normalized ? `88${normalized}` : null;
}
