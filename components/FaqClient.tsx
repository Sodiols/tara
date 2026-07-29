"use client";

import { useLanguage } from "@/lib/i18n";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AccordionItem } from "@/components/product/ProductAccordion";
import { faqItems } from "@/data/faq";

export function FaqClient() {
  const { t, pick } = useLanguage();

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: t("faq.heading") }]} />
      <h1 className="font-serif text-3xl sm:text-4xl text-ink mt-3 mb-8">{t("faq.heading")}</h1>
      <div>
        {faqItems.map((item, i) => (
          <AccordionItem key={i} title={pick(item.question)} defaultOpen={i === 0}>
            <p>{pick(item.answer)}</p>
          </AccordionItem>
        ))}
      </div>
    </div>
  );
}
