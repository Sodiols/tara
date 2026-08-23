"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function PrivacyPolicyClient() {

  const content =
    {
          intro: "TARA takes the privacy of your personal information seriously. This policy explains how we collect, use, and protect your data.",
          sections: [
            { title: "Information We Collect", text: "We collect your name, phone number, email, and delivery address in order to process your orders." },
            { title: "How We Use Your Information", text: "Your information is used solely for order processing, delivery, and customer service purposes." },
            { title: "Data Protection", text: "We take appropriate technical measures to keep your data secure and do not share it with third parties unnecessarily." },
            { title: "Cookies", text: "Our website uses cookies to enhance your shopping experience, such as remembering your language preference and shopping bag." },
          ],
        };

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Privacy Policy" }]} />
      <h1 className="font-serif text-3xl sm:text-4xl text-ink mt-3 mb-6">{"Privacy Policy"}</h1>
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
