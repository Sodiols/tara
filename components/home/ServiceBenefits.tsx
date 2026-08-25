import { Truck, Banknote, RotateCcw, Headset } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { formatTaka } from "@/lib/format";
import type { DeliverySettings } from "@/lib/delivery";

/**
 * The four promises under the homepage.
 *
 * A server component: it has no state and no interactivity, so it costs nothing
 * in the browser bundle, and the delivery line is generated from the live
 * settings rather than hardcoded — it used to say "On orders above ৳1500 in
 * Sylhet" regardless of what the shop actually charged.
 *
 * The second tile used to read "Secure Payment — 100% secure payment methods",
 * which is a claim about a payment gateway TARA does not have. What the store
 * actually offers is stated instead.
 */
export function ServiceBenefits({ delivery }: { delivery: DeliverySettings }) {
  const benefits = [
    {
      icon: Truck,
      title: delivery.freeDeliveryEnabled ? "Free Delivery" : "Nationwide Delivery",
      text: delivery.freeDeliveryEnabled
        ? `On orders from ${formatTaka(delivery.freeDeliveryThreshold)} in ${delivery.freeDeliveryDivision}`
        : "To all 64 districts of Bangladesh",
    },
    {
      icon: Banknote,
      title: "Cash on Delivery",
      text: "Pay in cash when your order arrives",
    },
    {
      icon: RotateCcw,
      title: "Easy Exchange",
      text: "Hassle-free returns within 7 days",
    },
    {
      icon: Headset,
      title: "Customer Support",
      text: "We're here to help you 24/7",
    },
  ];

  return (
    <section className="border-t border-b border-border bg-cream">
      <Container className="py-10 lg:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6 md:divide-x md:divide-border">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="flex items-start gap-3 md:px-6 md:first:pl-0">
              <benefit.icon
                size={26}
                strokeWidth={1.25}
                className="text-wine shrink-0"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm text-ink font-medium leading-snug">{benefit.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{benefit.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
