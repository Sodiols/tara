import { notFound } from "next/navigation";
import { getOrder } from "@/lib/supabase/queries/orders";
import { Container } from "@/components/layout/Container";
import { formatPrice } from "@/lib/utils";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";
import { formatOrderAddress } from "@/lib/order-address";
import { deliveryZoneLabel } from "@/lib/delivery";
import { formatSizeLabel } from "@/lib/product-size";
import { ReceiptDownloadButton } from "@/components/orders/ReceiptDownloadButton";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const [result, settings] = await Promise.all([getOrder(orderNumber), getPublicStoreSettings()]);
  if (!result) notFound();

  // Renders whichever shape this order was stored with, so an order placed
  // before the checkout change shows the address it was actually shipped to.
  const shipping = formatOrderAddress(result.order.shipping_address, {
    inside: deliveryZoneLabel("inside_sylhet", settings.delivery),
    outside: deliveryZoneLabel("outside_sylhet", settings.delivery),
  });

  return (
    <Container className="py-10 lg:py-14">
      <h1 className="font-serif text-3xl text-ink">{result.order.order_number}</h1>
      <p className="mt-2 text-sm capitalize text-muted">{result.order.status.replaceAll("_", " ")}</p>
      <ReceiptDownloadButton orderNumber={result.order.order_number} className="mt-5" />
      <div className="mt-8 divide-y divide-border border-y border-border">
        {result.items.map((item) => <div key={item.id} className="py-4 text-sm"><div className="flex justify-between gap-4"><span>{item.product_name_en} · {formatSizeLabel(item.size)} · {item.colour_en} × {item.quantity}</span><strong>{formatPrice(Number(item.line_total))}</strong></div>{result.order.status === "delivered" && <p className="mt-2 text-xs text-muted">Review this item from its product page.</p>}</div>)}
      </div>
      {!shipping.isEmpty && (
        <section className="mt-8">
          <h2 className="font-sans text-sm font-semibold text-ink">{"Delivery address"}</h2>
          <address className="mt-2 text-sm not-italic leading-6 text-muted">
            {shipping.lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
            {shipping.zoneLabel && <span className="block">{shipping.zoneLabel}</span>}
          </address>
        </section>
      )}
      <div className="ml-auto mt-6 max-w-sm space-y-2 text-sm"><p className="flex justify-between"><span>Subtotal</span><span>{formatPrice(Number(result.order.subtotal))}</span></p><p className="flex justify-between"><span>Delivery</span><span>{formatPrice(Number(result.order.delivery_fee))}</span></p><p className="flex justify-between border-t border-border pt-3 text-base font-semibold"><span>Total</span><span>{formatPrice(Number(result.order.total))}</span></p></div>
    </Container>
  );
}
