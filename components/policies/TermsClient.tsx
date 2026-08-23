"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function TermsClient() {

  const content =
    {
          intro: "By using TARA (www.tarabd.co), you are agreeing to the following terms and conditions.",
          sections: [
            { title: "Order Confirmation", text: "An order is only confirmed once our team verifies it by phone or message." },
            { title: "Pricing", text: "Prices shown on the website may change at any time, though already confirmed orders will not be affected." },
            { title: "Product Accuracy", text: "We try to represent product images and descriptions as accurately as possible, though slight colour variation may occur due to screen settings." },
            { title: "Intellectual Property", text: "All content, images, and the logo on this website belong to TARA and may not be used without permission." },
          ],
        };

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Terms and Conditions" }]} />
      <h1 className="font-serif text-3xl sm:text-4xl text-ink mt-3 mb-6">{"Terms and Conditions"}</h1>
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
