"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AccordionItem } from "@/components/product/ProductAccordion";
import type { FaqItem } from "@/data/faq";

export function FaqClient({ items }: { items: FaqItem[] }) {
  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Frequently Asked Questions" }]} />
      <h1 className="font-serif text-3xl sm:text-4xl text-ink mt-3 mb-8">
        {"Frequently Asked Questions"}
      </h1>
      <div>
        {items.map((item, index) => (
          <AccordionItem key={item.question} title={item.question} defaultOpen={index === 0}>
            <p>{item.answer}</p>
          </AccordionItem>
        ))}
      </div>
    </div>
  );
}
