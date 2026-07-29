"use client";

import Image from "next/image";
import Link from "next/link";
import { Sparkles, HeartHandshake, Leaf, MapPin } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { img, stockImages } from "@/lib/images";
import { Button } from "@/components/ui/Button";
import { siteConfig } from "@/data/site";

export function AboutClient() {
  const { t, locale } = useLanguage();

  const values = [
    {
      icon: Sparkles,
      title: locale === "bn" ? "নিখুঁত কারুকার্য" : "Thoughtful Craftsmanship",
      text:
        locale === "bn"
          ? "প্রতিটি পিস যত্ন সহকারে বাছাই করা কাপড় এবং সূক্ষ্ম কাজ দিয়ে তৈরি।"
          : "Every piece is created with carefully sourced fabric and fine detailing.",
    },
    {
      icon: HeartHandshake,
      title: locale === "bn" ? "গ্রাহকের প্রতি যত্ন" : "Customer First",
      text:
        locale === "bn"
          ? "আমরা বিশ্বাস করি প্রতিটি গ্রাহক ব্যক্তিগত যত্ন এবং সততার প্রাপ্য।"
          : "We believe every customer deserves honest quality and personal care.",
    },
    {
      icon: Leaf,
      title: locale === "bn" ? "সাশ্রয়ী বিলাসিতা" : "Accessible Elegance",
      text:
        locale === "bn"
          ? "যৌক্তিক মূল্যে প্রিমিয়াম মানের ফ্যাশন উপহার দেওয়াই আমাদের লক্ষ্য।"
          : "Premium quality fashion at a fair price is at the heart of what we do.",
    },
  ];

  return (
    <div>
      <section className="relative h-[420px] sm:h-[480px] lg:h-[540px]">
        <Image
          src={img(stockImages.portraitH, 1600, 900)}
          alt={t("about.heroHeading")}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_20%]"
        />
        <div className="absolute inset-0 bg-ink/45 flex items-center justify-center text-center px-5">
          <div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] text-white mb-3">{t("about.heroHeading")}</h1>
            <p className="text-white/90 text-base max-w-md mx-auto">{t("about.heroText")}</p>
          </div>
        </div>
      </section>

      <section className="max-w-[1000px] mx-auto px-5 md:px-8 lg:px-12 py-12 sm:py-16 lg:py-24">
        <div className="grid sm:grid-cols-2 gap-10 items-center">
          <div className="relative aspect-[4/5]">
            <Image
              src={img(stockImages.portraitI, 700, 875)}
              alt={t("about.introHeading")}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="font-serif text-3xl text-ink mb-4">{t("about.introHeading")}</h2>
            <p className="text-muted leading-relaxed">
              {locale === "bn"
                ? "TARA সিলেটে জন্ম নেওয়া একটি ফ্যাশন ব্র্যান্ড, যা আধুনিক বাংলাদেশি নারীর জন্য আনস্টিচড ও রেডি থ্রি পিস, এবং ফ্যাশন অ্যাক্সেসরিজ নিয়ে কাজ করে। আমরা বিশ্বাস করি ফ্যাশন হওয়া উচিত আরামদায়ক, সাশ্রয়ী এবং প্রকৃত।"
                : "TARA is a Sylhet-born fashion brand crafting undready and ready three piece clothing, along with fashion accessories, for the modern Bangladeshi woman. We believe fashion should feel comfortable, honest, and within reach."}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-beige py-12 sm:py-16 lg:py-24">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 lg:px-12">
          <h2 className="font-serif text-3xl text-ink text-center mb-10">{t("about.valuesHeading")}</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {values.map((v) => (
              <div key={v.title} className="text-center flex flex-col items-center">
                <v.icon size={32} strokeWidth={1.25} className="text-wine mb-4" />
                <h3 className="text-base text-ink font-medium mb-2">{v.title}</h3>
                <p className="text-sm text-muted">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[1000px] mx-auto px-5 md:px-8 lg:px-12 py-12 sm:py-16 lg:py-24">
        <div className="grid sm:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-serif text-3xl text-ink mb-4">{t("about.philosophyHeading")}</h2>
            <p className="text-muted leading-relaxed mb-4">
              {locale === "bn"
                ? "আমাদের প্রতিটি কালেকশন তৈরি হয় স্বাচ্ছন্দ্য, বহুমুখিতা এবং কালজয়ী সৌন্দর্যের কথা মাথায় রেখে। আমরা ট্রেন্ডের পেছনে ছুটি না, বরং এমন পোশাক তৈরি করি যা বছরের পর বছর পরা যায়।"
                : "Every collection is designed with comfort, versatility, and timeless beauty in mind. We do not chase fleeting trends — we create pieces meant to be worn for years."}
            </p>
            <p className="text-muted leading-relaxed">{t("about.customerHeading")}</p>
          </div>
          <div className="relative aspect-[4/5] order-first sm:order-last">
            <Image
              src={img(stockImages.lifestyleC, 700, 875)}
              alt={t("about.philosophyHeading")}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-beige py-12 sm:py-16 lg:py-24">
        <div className="max-w-[700px] mx-auto px-5 md:px-8 lg:px-12 text-center">
          <MapPin size={30} strokeWidth={1.25} className="text-wine mx-auto mb-4" />
          <h2 className="font-serif text-3xl text-ink mb-3">{t("about.storeHeading")}</h2>
          <p className="text-muted mb-8">{siteConfig.address}</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/contact">
              <Button variant="outline">{t("footer.contactUs")}</Button>
            </Link>
            <Link href="/collection">
              <Button>{t("about.ctaButton")}</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-[700px] mx-auto px-5 md:px-8 lg:px-12 py-12 sm:py-16 lg:py-24 text-center">
        <h2 className="font-serif text-3xl text-ink mb-6">{t("about.ctaHeading")}</h2>
        <Link href="/new-arrivals">
          <Button size="lg">{t("about.ctaButton")}</Button>
        </Link>
      </section>
    </div>
  );
}
