import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { formatTaka } from "@/lib/format";
import type { DeliverySettings } from "@/lib/delivery";

/**
 * The delivery policy page.
 *
 * A server component with no state, and every figure comes from the live store
 * settings. The charges used to be written into the copy, so this page could
 * quote one price while checkout charged another — which is the worst place on
 * the site for that to happen, because this is where a customer comes to check.
 */
export function DeliveryInformationClient({ delivery }: { delivery: DeliverySettings }) {
  const insideTitle = `Delivery within ${delivery.freeDeliveryDivision}`;
  const insideText = delivery.freeDeliveryEnabled
    ? `Orders within ${delivery.freeDeliveryDivision} typically arrive within 2-4 business days. Delivery is ${formatTaka(delivery.insideFee)}, and free on orders of ${formatTaka(delivery.freeDeliveryThreshold)} or more.`
    : `Orders within ${delivery.freeDeliveryDivision} typically arrive within 2-4 business days. Delivery is ${formatTaka(delivery.insideFee)}.`;

  const sections = [
    { title: insideTitle, text: insideText },
    {
      title: "Delivery Nationwide",
      text: `We deliver to all 64 districts of Bangladesh. Orders outside ${delivery.freeDeliveryDivision} usually take 4-7 business days and cost ${formatTaka(delivery.outsideFee)}, whatever the order total. The exact charge is always shown at checkout before you place your order.`,
    },
    {
      title: "Payment",
      text: "We accept cash on delivery only. Pay the delivery agent in cash when your order reaches you — there is nothing to pay upfront, and we never ask for payment before delivery.",
    },
    {
      title: "Order Tracking",
      text: "When you place an order you are given an order number and a tracking token. Keep both: together they let you check the order's latest status at any time from our Order Tracking page, and the token is what keeps your order private.",
    },
  ];

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Delivery Information" }]} />
      <h1 className="font-serif text-3xl sm:text-4xl text-ink mt-3 mb-6">
        {"Delivery Information"}
      </h1>
      <p className="text-muted leading-relaxed mb-8">
        {
          "Every order placed with TARA is carefully packed and dispatched as quickly as possible. Below is everything you need to know about our delivery process."
        }
      </p>
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-base text-ink font-medium mb-2">{section.title}</h2>
            <p className="text-sm text-muted leading-relaxed">{section.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
