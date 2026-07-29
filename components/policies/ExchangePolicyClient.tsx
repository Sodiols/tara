"use client";

import { useLanguage } from "@/lib/i18n";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function ExchangePolicyClient() {
  const { t, locale } = useLanguage();

  const content =
    locale === "bn"
      ? {
          intro: "আমরা চাই আপনি আপনার কেনাকাটা নিয়ে সম্পূর্ণ সন্তুষ্ট থাকুন। তাই TARA একটি সহজ এক্সচেঞ্জ পলিসি প্রদান করে।",
          sections: [
            { title: "এক্সচেঞ্জের সময়সীমা", text: "ডেলিভারির তারিখ থেকে ৭ দিনের মধ্যে এক্সচেঞ্জের জন্য অনুরোধ করা যাবে।" },
            { title: "শর্তাবলী", text: "পণ্যটি অব্যবহৃত, ধোয়া হয়নি এমন এবং মূল ট্যাগসহ থাকতে হবে। উপহার হিসেবে পাওয়া পণ্যও এক্সচেঞ্জযোগ্য।" },
            { title: "যেভাবে এক্সচেঞ্জ করবেন", text: "আপনার অর্ডার নম্বরসহ আমাদের কাস্টমার সাপোর্টে যোগাযোগ করুন। আমরা এক্সচেঞ্জ প্রক্রিয়ার প্রতিটি ধাপে আপনাকে সাহায্য করব।" },
            { title: "রিফান্ড", text: "বর্তমানে আমরা সরাসরি রিফান্ডের পরিবর্তে এক্সচেঞ্জ বা স্টোর ক্রেডিট অফার করি।" },
          ],
        }
      : {
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
      <Breadcrumb items={[{ label: t("policies.exchangeHeading") }]} />
      <h1 className="font-serif text-3xl sm:text-4xl text-ink mt-3 mb-6">{t("policies.exchangeHeading")}</h1>
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
