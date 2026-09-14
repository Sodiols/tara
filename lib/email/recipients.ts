/**
 * The internal order-notification inbox, as a list.
 *
 * `store_settings.order_notification_email` holds one address or several,
 * separated by commas, semicolons or whitespace. It is still one outbox row per
 * order and one provider send with every address on it, so each inbox gets the
 * email exactly once and the row's idempotency key still covers the whole send.
 *
 * Duplicates are removed case-insensitively ("Owner@tarabd.co" and
 * "owner@tarabd.co" are the same inbox) and anything that is not an address is
 * dropped rather than failing the send for everyone else on the list.
 */

export const MAX_NOTIFICATION_RECIPIENTS = 10;

const EMAIL_SHAPE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function isRecipientAddress(value: string): boolean {
  return value.length <= 200 && EMAIL_SHAPE.test(value);
}

export function parseRecipientList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const part of value.split(/[\s,;]+/)) {
    const address = part.trim().toLowerCase();
    if (!address || !isRecipientAddress(address) || seen.has(address)) continue;
    seen.add(address);
    recipients.push(address);
    if (recipients.length === MAX_NOTIFICATION_RECIPIENTS) break;
  }
  return recipients;
}
