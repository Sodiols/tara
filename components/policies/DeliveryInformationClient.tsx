"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function DeliveryInformationClient() {

  const content =
    {
          intro:
            "Every order placed with TARA is carefully packed and dispatched as quickly as possible. Below is everything you need to know about our delivery process.",
          sections: [
            { title: "Delivery within Sylhet", text: "Orders within Sylhet city typically arrive within 2-4 business days. Delivery is completely free on orders above ৳1500." },
            { title: "Delivery Nationwide", text: "Orders outside Sylhet usually take 4-7 business days to arrive. A standard delivery charge applies and will be shown at checkout." },
            { title: "Payment", text: "We accept cash on delivery only. Pay the delivery agent in cash when your order reaches you." },
            { title: "Order Tracking", text: "Once your order is placed, you can check its latest status anytime from our Order Tracking page." },
          ],
        };

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Delivery Information" }]} />
      <h1 className="font-serif text-3xl sm:text-4xl text-ink mt-3 mb-6">{"Delivery Information"}</h1>
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
