"use client";

import { useLanguage } from "@/lib/i18n";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function DeliveryInformationClient() {
  const { t, locale } = useLanguage();

  const content =
    locale === "bn"
      ? {
          intro:
            "TARA থেকে অর্ডার করা প্রতিটি পণ্য যত্ন সহকারে প্যাক করে দ্রুততম সময়ে পাঠানো হয়। নিচে আমাদের ডেলিভারি সংক্রান্ত বিস্তারিত তথ্য দেওয়া হলো।",
          sections: [
            { title: "সিলেটের ভেতরে ডেলিভারি", text: "সিলেট শহরের ভেতরে অর্ডার সাধারণত ২-৪ কার্যদিবসের মধ্যে পৌঁছে যায়। ৳১৫০০ টাকার বেশি অর্ডারে ডেলিভারি সম্পূর্ণ ফ্রি।" },
            { title: "সারাদেশে ডেলিভারি", text: "সিলেটের বাইরে অন্যান্য জেলায় ডেলিভারি করতে সাধারণত ৪-৭ কার্যদিবস সময় লাগে। নির্দিষ্ট ডেলিভারি চার্জ চেকআউটের সময় দেখানো হবে।" },
            { title: "এক্সপ্রেস ডেলিভারি", text: "জরুরি প্রয়োজনে এক্সপ্রেস ডেলিভারি অপশনও পাওয়া যায়, যা অতিরিক্ত চার্জের বিনিময়ে দ্রুত ডেলিভারি নিশ্চিত করে।" },
            { title: "অর্ডার ট্র্যাকিং", text: "অর্ডার করার পর আপনি আমাদের অর্ডার ট্র্যাকিং পেজ থেকে আপনার অর্ডারের সর্বশেষ অবস্থা জানতে পারবেন।" },
          ],
        }
      : {
          intro:
            "Every order placed with TARA is carefully packed and dispatched as quickly as possible. Below is everything you need to know about our delivery process.",
          sections: [
            { title: "Delivery within Sylhet", text: "Orders within Sylhet city typically arrive within 2-4 business days. Delivery is completely free on orders above ৳1500." },
            { title: "Delivery Nationwide", text: "Orders outside Sylhet usually take 4-7 business days to arrive. A standard delivery charge applies and will be shown at checkout." },
            { title: "Express Delivery", text: "An express delivery option is available for urgent orders at an additional charge, ensuring a faster turnaround." },
            { title: "Order Tracking", text: "Once your order is placed, you can check its latest status anytime from our Order Tracking page." },
          ],
        };

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: t("policies.deliveryHeading") }]} />
      <h1 className="font-serif text-3xl sm:text-4xl text-ink mt-3 mb-6">{t("policies.deliveryHeading")}</h1>
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
