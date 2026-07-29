"use client";

import { Truck, ShieldCheck, RotateCcw, Headset } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Container } from "@/components/layout/Container";

export function ServiceBenefits() {
  const { t } = useLanguage();

  const benefits = [
    { icon: Truck, title: t("benefits.freeDelivery"), text: t("benefits.freeDeliveryText") },
    { icon: ShieldCheck, title: t("benefits.securePayment"), text: t("benefits.securePaymentText") },
    { icon: RotateCcw, title: t("benefits.easyExchange"), text: t("benefits.easyExchangeText") },
    { icon: Headset, title: t("benefits.customerSupport"), text: t("benefits.customerSupportText") },
  ];

  return (
    <section className="border-t border-b border-border bg-cream">
      <Container className="py-10 lg:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6 md:divide-x md:divide-border">
          {benefits.map((b) => (
            <div key={b.title} className="flex items-start gap-3 md:px-6 md:first:pl-0">
              <b.icon size={26} strokeWidth={1.25} className="text-wine shrink-0" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm text-ink font-medium leading-snug">{b.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{b.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
