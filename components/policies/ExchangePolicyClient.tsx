"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function ExchangePolicyClient() {

  const content =
    {
          intro: "We want you to be completely satisfied with your purchase, which is why TARA offers a simple exchange policy.",
          sections: [
            { title: "Exchange Window", text: "You can request an exchange within 7 days of the delivery date." },
            { title: "Conditions", text: "The item must be unused, unwashed, and have its original tags attached. Gifted items are also eligible for exchange." },
            { title: "How to Exchange", text: "Contact our customer support team with your order number, and we will guide you through every step of the exchange process." },
            { title: "Refunds", text: "At this time, we offer exchanges or store credit rather than direct refunds." },
          ],
        };

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Exchange Policy" }]} />
      <h1 className="font-serif text-3xl sm:text-4xl text-ink mt-3 mb-6">{"Exchange Policy"}</h1>
      <p className="text-muted leading-relaxed mb-8">{content.intro}</p>
      <div className="flex flex-col gap-6">
        {content.sections.map((s) => (
          <div key={s.title}>
            <h2 className="text-base text-ink font-medium mb-2">{s.title}</h2>
            <p className="text-sm text-muted leading-relaxed">{s.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
