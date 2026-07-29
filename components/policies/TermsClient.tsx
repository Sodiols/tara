"use client";

import { useLanguage } from "@/lib/i18n";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function TermsClient() {
  const { t, locale } = useLanguage();

  const content =
    locale === "bn"
      ? {
          intro: "TARA (www.tarabd.co) ব্যবহার করার মাধ্যমে আপনি নিচের শর্তাবলীতে সম্মত হচ্ছেন বলে ধরে নেওয়া হয়।",
          sections: [
            { title: "অর্ডার নিশ্চিতকরণ", text: "একটি অর্ডার তখনই নিশ্চিত হবে যখন আমাদের টিম ফোন বা মেসেজের মাধ্যমে তা যাচাই করবে।" },
            { title: "মূল্য নির্ধারণ", text: "ওয়েবসাইটে প্রদর্শিত মূল্য যেকোনো সময় পরিবর্তন হতে পারে, তবে ইতিমধ্যে নিশ্চিত হওয়া অর্ডারের মূল্য পরিবর্তন হবে না।" },
            { title: "পণ্যের সঠিকতা", text: "আমরা পণ্যের ছবি ও বিবরণ যথাসম্ভব সঠিকভাবে উপস্থাপনের চেষ্টা করি, তবে স্ক্রিনের কারণে রঙে সামান্য পার্থক্য হতে পারে।" },
            { title: "বুদ্ধিবৃত্তিক সম্পত্তি", text: "এই ওয়েবসাইটের সকল কনটেন্ট, ছবি ও লোগো TARA-এর সম্পত্তি এবং অনুমতি ছাড়া ব্যবহার করা যাবে না।" },
          ],
        }
      : {
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
      <Breadcrumb items={[{ label: t("policies.termsHeading") }]} />
      <h1 className="font-serif text-3xl sm:text-4xl text-ink mt-3 mb-6">{t("policies.termsHeading")}</h1>
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
