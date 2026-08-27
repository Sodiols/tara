import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrderForPrint } from "@/lib/supabase/queries/admin";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";
import { formatOrderAddress } from "@/lib/order-address";
import { deliveryZoneLabel } from "@/lib/delivery";
import { formatSizeLabel } from "@/lib/product-size";
import { formatDate } from "@/lib/format";
import { formatBdPhone } from "@/lib/phone";
import { PrintToolbar } from "@/components/admin/PrintDocument";
import type { Json } from "@/types/database";

export const metadata: Metadata = {
  title: "Packing slip",
  robots: { index: false, follow: false },
};

/**
 * Both address shapes render here.
 *
 * `formatOrderAddress()` understands the legacy division/district snapshot and
 * the current address/city/zone one, so an order placed before the checkout
 * change still shows the address the courier was actually given. The three
 * admin screens used to each carry their own copy of this logic, which is how
 * the invoice and the packing slip came to format the same address two
 * different ways.
 */

export default async function PackingSlipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, settings] = await Promise.all([
    getOrderForPrint(id),
    getPublicStoreSettings(),
  ]);
  if (!detail) notFound();

  const { order, items } = detail;
  const shipping = formatOrderAddress(order.shipping_address, {
    inside: deliveryZoneLabel("inside_sylhet", settings.delivery),
    outside: deliveryZoneLabel("outside_sylhet", settings.delivery),
  });
  const address = shipping.lines;
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="mx-auto max-w-3xl bg-white text-taraBlack print:max-w-none">
      <PrintToolbar backHref={`/admin/orders/${order.id}`} label="packing slip" />

      <article className="rounded-panel border border-border p-8 print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
          <div>
            <Image
              src="/logo/logo-black.png"
              alt="TARA"
              width={250}
              height={64}
              className="h-9 w-auto object-contain"
            />
            <p className="mt-2 font-sans text-[11px] font-bold uppercase tracking-widest text-muted">
              Packing slip
            </p>
          </div>
          <div className="text-right">
            <p className="font-serif text-2xl leading-none">{order.order_number}</p>
            <p className="mt-1 font-sans text-xs text-muted">{formatDate(order.created_at)}</p>
            <p className="mt-2 inline-flex rounded-control border border-taraBlack px-2 py-[3px] font-sans text-[11px] font-bold uppercase tracking-wide">
              Collect cash on delivery
            </p>
          </div>
        </header>

        <div className="grid gap-6 border-b border-border py-6 sm:grid-cols-2">
          <div>
            <h2 className="font-sans text-[11px] font-bold uppercase tracking-widest text-muted">
              Deliver to
            </h2>
            <p className="mt-2 font-sans text-base font-semibold">{order.customer_name}</p>
            <p className="font-sans text-base">{formatBdPhone(order.customer_phone)}</p>
            <address className="mt-2 font-sans text-sm not-italic leading-6">
              {address.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          </div>
          <div className="sm:text-right">
            <h2 className="font-sans text-[11px] font-bold uppercase tracking-widest text-muted">
              From
            </h2>
            <p className="mt-2 font-sans text-sm leading-6">
              {settings.storeName || "TARA"}
              <br />
              {settings.storeAddress || "Zakiganj, Sylhet, Bangladesh"}
              {settings.supportPhone && (
                <>
                  <br />
                  {formatBdPhone(settings.supportPhone)}
                </>
              )}
            </p>
          </div>
        </div>

        <table className="w-full border-collapse text-left font-sans text-sm">
          <thead>
            <tr>
              <th className="border-b border-border py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                Product
              </th>
              <th className="border-b border-border py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                Size
              </th>
              <th className="border-b border-border py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                Colour
              </th>
              <th className="border-b border-border py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                SKU
              </th>
              <th className="border-b border-border py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted">
                Qty
              </th>
              <th className="w-16 border-b border-border py-3 text-center text-[11px] font-bold uppercase tracking-wider text-muted">
                ✓
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="border-b border-border/60 py-3 font-medium">
                  {item.product_name_en}
                </td>
                <td className="border-b border-border/60 py-3">{formatSizeLabel(item.size)}</td>
                <td className="border-b border-border/60 py-3">{item.colour_en}</td>
                <td className="border-b border-border/60 py-3 font-mono text-xs">{item.sku}</td>
                <td className="border-b border-border/60 py-3 text-right text-base font-semibold">
                  {item.quantity}
                </td>
                <td className="border-b border-border/60 py-3 text-center">
                  <span
                    aria-hidden="true"
                    className="inline-block h-4 w-4 border border-taraBlack"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="py-3 text-right font-semibold">
                Total units
              </td>
              <td className="py-3 text-right text-base font-bold">{totalUnits}</td>
              <td />
            </tr>
          </tfoot>
        </table>

        {order.customer_note && (
          <div className="mt-6 border border-border p-4">
            <p className="font-sans text-[11px] font-bold uppercase tracking-widest text-muted">
              Customer delivery note
            </p>
            <p className="mt-1 whitespace-pre-wrap font-sans text-sm leading-6">
              {order.customer_note}
            </p>
          </div>
        )}

        {/*
          Internal staff notes are intentionally absent. A packing slip travels
          with the parcel and is read by the courier and the customer, so it
          carries fulfilment information only.
        */}

        <footer className="mt-8 flex justify-between border-t border-border pt-4 font-sans text-xs text-muted">
          <span>Packed by ______________________</span>
          <span>Date ______________</span>
        </footer>
      </article>
    </div>
  );
}
