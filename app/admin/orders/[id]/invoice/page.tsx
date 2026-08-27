import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrderForPrint } from "@/lib/supabase/queries/admin";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";
import { formatOrderAddress } from "@/lib/order-address";
import { deliveryZoneLabel } from "@/lib/delivery";
import { formatSizeLabel } from "@/lib/product-size";
import { formatDate, formatTaka } from "@/lib/format";
import { formatBdPhone } from "@/lib/phone";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-status";
import { PrintToolbar } from "@/components/admin/PrintDocument";
import type { Json } from "@/types/database";

export const metadata: Metadata = {
  title: "Invoice",
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

export default async function InvoicePage({
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

  return (
    <div className="mx-auto max-w-3xl bg-white text-taraBlack print:max-w-none">
      <PrintToolbar backHref={`/admin/orders/${order.id}`} label="invoice" />

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
            <p className="mt-3 font-sans text-xs leading-5 text-muted">
              {settings.storeAddress || "Zakiganj, Sylhet, Bangladesh"}
              {settings.supportPhone && (
                <>
                  <br />
                  {formatBdPhone(settings.supportPhone)}
                </>
              )}
              {settings.supportEmail && (
                <>
                  <br />
                  {settings.supportEmail}
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <h1 className="font-serif text-2xl leading-none">Invoice</h1>
            <p className="mt-2 font-sans text-sm font-semibold">{order.order_number}</p>
            <p className="font-sans text-xs text-muted">{formatDate(order.created_at)}</p>
          </div>
        </header>

        <div className="grid gap-6 border-b border-border py-6 sm:grid-cols-2">
          <div>
            <h2 className="font-sans text-[11px] font-bold uppercase tracking-widest text-muted">
              Billed to
            </h2>
            <p className="mt-2 font-sans text-sm font-semibold">{order.customer_name}</p>
            <p className="font-sans text-sm">{formatBdPhone(order.customer_phone)}</p>
            {order.customer_email && (
              <p className="break-all font-sans text-sm">{order.customer_email}</p>
            )}
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
              Order details
            </h2>
            <dl className="mt-2 font-sans text-sm leading-6">
              <div className="flex justify-between sm:justify-end sm:gap-6">
                <dt className="text-muted">Payment method</dt>
                <dd>Cash on delivery</dd>
              </div>
              <div className="flex justify-between sm:justify-end sm:gap-6">
                <dt className="text-muted">Payment status</dt>
                <dd>{PAYMENT_STATUS_LABELS[order.payment_status]}</dd>
              </div>
              <div className="flex justify-between sm:justify-end sm:gap-6">
                <dt className="text-muted">Order status</dt>
                <dd>{ORDER_STATUS_LABELS[order.status]}</dd>
              </div>
            </dl>
          </div>
        </div>

        <table className="w-full border-collapse py-6 text-left font-sans text-sm">
          <thead>
            <tr>
              <th className="border-b border-border py-3 text-[11px] font-bold uppercase tracking-wider text-muted">
                Item
              </th>
              <th className="border-b border-border py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted">
                Unit
              </th>
              <th className="border-b border-border py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted">
                Qty
              </th>
              <th className="border-b border-border py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="border-b border-border/60 py-3">
                  <span className="block font-medium">{item.product_name_en}</span>
                  <span className="block text-xs text-muted">
                    {formatSizeLabel(item.size)} · {item.colour_en} · {item.sku}
                  </span>
                </td>
                <td className="border-b border-border/60 py-3 text-right">
                  {formatTaka(item.unit_price)}
                </td>
                <td className="border-b border-border/60 py-3 text-right">{item.quantity}</td>
                <td className="border-b border-border/60 py-3 text-right font-medium">
                  {formatTaka(item.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-6 w-full max-w-xs font-sans text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted">Subtotal</span>
            <span>{formatTaka(order.subtotal)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted">Delivery</span>
            <span>{formatTaka(order.delivery_fee)}</span>
          </div>
          {Number(order.discount_amount) > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-muted">Discount</span>
              <span>−{formatTaka(order.discount_amount)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-border pt-2">
            <span className="font-semibold">Total</span>
            <span className="font-serif text-lg">{formatTaka(order.total)}</span>
          </div>
        </div>

        <footer className="mt-8 border-t border-border pt-4 text-center font-sans text-xs leading-5 text-muted">
          <p>Thank you for shopping with TARA.</p>
          <p>All amounts are in Bangladeshi Taka (BDT).</p>
        </footer>
      </article>
    </div>
  );
}
