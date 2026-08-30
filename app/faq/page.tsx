import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { FaqClient } from "@/components/FaqClient";
import { faqItems } from "@/data/faq";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";
import { jsonLdScriptProps } from "@/lib/json-ld";

export const metadata: Metadata = buildMetadata({
  title: "Frequently Asked Questions",
  description:
    "Answers to common questions about TARA orders, delivery across Bangladesh, exchanges and cash on delivery.",
  path: "/faq",
});

export default async function FaqPage() {
  // The delivery answers quote real numbers, so they are generated from the
  // live settings rather than written into the page — otherwise raising the
  // free-delivery threshold would leave the FAQ promising the old one.
  const settings = await getPublicStoreSettings();
  const items = faqItems(settings.delivery, settings.storeAddress);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <script {...jsonLdScriptProps(faqSchema)} />
      <FaqClient items={items} />
    </>
  );
}
