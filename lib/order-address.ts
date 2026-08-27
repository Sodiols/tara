import { isDeliveryZone, type DeliveryZone } from "./delivery";

/**
 * Rendering an order's shipping address, in either shape it can be stored in.
 *
 * `orders.shipping_address` is a jsonb snapshot taken at the moment the order
 * was placed, so the column holds whatever the checkout of that era wrote. There
 * are now two shapes in the table and both have to render:
 *
 *   LEGACY   { fullAddress, division, district, upazila?, area?, postalCode? }
 *   CURRENT  { address, apartment?, city, postalCode?, deliveryZone, country }
 *
 * A single formatter is the point. The three admin screens each had their own
 * copy of this logic, which is how the invoice and the packing slip came to
 * format the same address two slightly different ways — and it is how a new
 * shape ends up rendering as a blank block on one screen and not another.
 *
 * Nothing here throws and nothing here invents. A field that is absent is
 * omitted; an address that is entirely unrecognisable produces no lines rather
 * than a row of "undefined".
 */

export interface FormattedOrderAddress {
  /** Address lines, in postal order, with empty optional lines omitted. */
  lines: string[];
  /** "Inside Sylhet" / "Outside Sylhet", when the order recorded a zone. */
  zoneLabel: string | null;
  /** The stored zone, for anything that needs to branch rather than display. */
  zone: DeliveryZone | null;
  /** True when nothing usable could be read out of the record. */
  isEmpty: boolean;
}

function text(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function join(parts: (string | null)[]): string | null {
  const kept = parts.filter((part): part is string => Boolean(part));
  return kept.length ? kept.join(", ") : null;
}

/**
 * Formats a shipping address snapshot for display.
 *
 * @param raw the `shipping_address` jsonb column, in any of its shapes
 * @param zoneNames how to label each zone, so the label follows the configured
 *        free-delivery division rather than being hardcoded to Sylhet
 */
export function formatOrderAddress(
  raw: unknown,
  zoneNames?: { inside: string; outside: string },
): FormattedOrderAddress {
  const empty: FormattedOrderAddress = {
    lines: [],
    zoneLabel: null,
    zone: null,
    isEmpty: true,
  };

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const source = raw as Record<string, unknown>;

  const zone = isDeliveryZone(source.deliveryZone) ? source.deliveryZone : null;
  const labels = zoneNames ?? { inside: "Inside Sylhet", outside: "Outside Sylhet" };
  const zoneLabel = zone ? (zone === "inside_sylhet" ? labels.inside : labels.outside) : null;

  const lines: (string | null)[] = [
    // Current shape writes `address`; legacy wrote `fullAddress`. Whichever is
    // present is the street line.
    text(source, "address") ?? text(source, "fullAddress"),
    text(source, "apartment"),
    // Legacy-only levels. Kept so an order placed before this release renders
    // exactly as it always did, rather than losing two lines of the address the
    // courier was actually given.
    join([text(source, "area"), text(source, "upazila")]),
    // `city` is current; district/division is the legacy pair.
    text(source, "city") ?? join([text(source, "district"), text(source, "division")]),
    text(source, "postalCode") ?? text(source, "postal_code"),
    // Always Bangladesh, but only stated when the record says so, so a legacy
    // order is not annotated with a field it never had.
    text(source, "country"),
  ];

  const rendered = lines.filter((line): line is string => Boolean(line));

  return {
    lines: rendered,
    zoneLabel,
    zone,
    isEmpty: rendered.length === 0,
  };
}

/** The same address on one line, for a table cell or an email. */
export function formatOrderAddressInline(
  raw: unknown,
  zoneNames?: { inside: string; outside: string },
): string {
  return formatOrderAddress(raw, zoneNames).lines.join(", ");
}
