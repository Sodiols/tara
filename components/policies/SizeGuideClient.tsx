"use client";

import { useLanguage } from "@/lib/i18n";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { SizeGuideTable } from "@/components/product/SizeGuideTable";

export function SizeGuideClient() {
  const { t, locale } = useLanguage();

  return (
    <div className="max-w-[800px] mx-auto px-5 md:px-8 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: t("policies.sizeGuideHeading") }]} />
      <h1 className="font-serif text-3xl sm:text-4xl text-ink mt-3 mb-6">{t("policies.sizeGuideHeading")}</h1>
      <p className="text-muted leading-relaxed mb-8">
        {locale === "bn"
          ? "আপনার জন্য সঠিক সাইজ বেছে নিতে নিচের মাপ অনুযায়ী তালিকাটি দেখুন। সবচেয়ে ভালো ফলাফলের জন্য একটি নরম মাপার ফিতা ব্যবহার করুন।"
          : "Use the measurements below to find your perfect fit. For the best results, measure yourself using a soft measuring tape."}
      </p>
      <SizeGuideTable />
      <div className="mt-8 text-sm text-muted leading-relaxed">
        <p>
          {locale === "bn"
            ? "সঠিক মাপ নেওয়ার জন্য: বুকের সবচেয়ে প্রশস্ত অংশ, কোমরের সবচেয়ে সরু অংশ এবং নিতম্বের সবচেয়ে প্রশস্ত অংশ পরিমাপ করুন। যদি আপনার মাপ দুটি সাইজের মাঝামাঝি হয়, বড় সাইজটি বেছে নেওয়ার পরামর্শ দেওয়া হয়।"
            : "To measure accurately: measure around the fullest part of your chest, the narrowest part of your waist, and the fullest part of your hips. If your measurement falls between two sizes, we recommend choosing the larger size."}
        </p>
      </div>
    </div>
  );
}
