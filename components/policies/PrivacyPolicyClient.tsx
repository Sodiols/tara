"use client";

import { useLanguage } from "@/lib/i18n";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function PrivacyPolicyClient() {
  const { t, locale } = useLanguage();

  const content =
    locale === "bn"
      ? {
          intro: "TARA আপনার ব্যক্তিগত তথ্যের গোপনীয়তা রক্ষা করাকে অত্যন্ত গুরুত্ব সহকারে দেখে। এই নীতিমালায় আমরা কীভাবে আপনার তথ্য সংগ্রহ, ব্যবহার এবং সংরক্ষণ করি তা ব্যাখ্যা করা হয়েছে।",
          sections: [
            { title: "আমরা যে তথ্য সংগ্রহ করি", text: "অর্ডার প্রক্রিয়াকরণের জন্য আমরা আপনার নাম, ফোন নম্বর, ইমেইল এবং ডেলিভারি ঠিকানা সংগ্রহ করি।" },
            { title: "তথ্যের ব্যবহার", text: "আপনার তথ্য শুধুমাত্র অর্ডার প্রক্রিয়াকরণ, ডেলিভারি এবং গ্রাহক সেবার জন্য ব্যবহার করা হয়।" },
            { title: "তথ্যের সুরক্ষা", text: "আমরা আপনার তথ্য সুরক্ষিত রাখতে উপযুক্ত প্রযুক্তিগত ব্যবস্থা গ্রহণ করি এবং তৃতীয় পক্ষের সাথে অপ্রয়োজনীয়ভাবে শেয়ার করি না।" },
            { title: "কুকিজ", text: "আমাদের ওয়েবসাইট আপনার শপিং অভিজ্ঞতা উন্নত করতে কুকিজ ব্যবহার করে, যেমন ভাষা পছন্দ এবং শপিং ব্যাগ সংরক্ষণ।" },
          ],
        }
      : {
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
      <Breadcrumb items={[{ label: t("policies.privacyHeading") }]} />
      <h1 className="font-serif text-3xl sm:text-4xl text-ink mt-3 mb-6">{t("policies.privacyHeading")}</h1>
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
