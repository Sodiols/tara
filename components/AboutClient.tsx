"use client";

import Image from "next/image";
import Link from "next/link";
import { Sparkles, HeartHandshake, Leaf, MapPin } from "lucide-react";
import { img, stockImages } from "@/lib/images";
import { Button } from "@/components/ui/Button";
import { siteConfig } from "@/data/site";

export function AboutClient() {

  const values = [
    {
      icon: Sparkles,
      title: "Thoughtful Craftsmanship",
      text:
        "Every piece is created with carefully sourced fabric and fine detailing.",
    },
    {
      icon: HeartHandshake,
      title: "Customer First",
      text:
        "We believe every customer deserves honest quality and personal care.",
    },
    {
      icon: Leaf,
      title: "Accessible Elegance",
      text:
        "Premium quality fashion at a fair price is at the heart of what we do.",
    },
  ];

  return (
    <div>
      <section className="relative h-[420px] sm:h-[480px] lg:h-[540px]">
        <Image
          src={img(stockImages.portraitH, 1600, 900)}
          alt={"The Story of TARA"}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_20%]"
        />
        <div className="absolute inset-0 bg-ink/45 flex items-center justify-center text-center px-5">
          <div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] text-white mb-3">{"The Story of TARA"}</h1>
            <p className="text-white/90 text-base max-w-md mx-auto">{"A Sylhet-born brand for the modern Bangladeshi woman."}</p>
          </div>
        </div>
      </section>

      <section className="max-w-[1000px] mx-auto px-5 md:px-8 lg:px-12 py-12 sm:py-16 lg:py-24">
        <div className="grid sm:grid-cols-2 gap-10 items-center">
          <div className="relative aspect-[4/5]">
            <Image
              src={img(stockImages.portraitI, 700, 875)}
              alt={"Who We Are"}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="font-serif text-3xl text-ink mb-4">{"Who We Are"}</h2>
            <p className="text-muted leading-relaxed">
              {"TARA is a Sylhet-born fashion brand crafting unstitched and ready three piece clothing, along with fashion accessories, for the modern Bangladeshi woman. We believe fashion should feel comfortable, honest, and within reach."}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-beige py-12 sm:py-16 lg:py-24">
        <div className="max-w-[1200px] mx-auto px-5 md:px-8 lg:px-12">
          <h2 className="font-serif text-3xl text-ink text-center mb-10">{"What We Believe"}</h2>
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
            <h2 className="font-serif text-3xl text-ink mb-4">{"Our Fashion Philosophy"}</h2>
            <p className="text-muted leading-relaxed mb-4">
              {"Every collection is designed with comfort, versatility, and timeless beauty in mind. We do not chase fleeting trends — we create pieces meant to be worn for years."}
            </p>
            <p className="text-muted leading-relaxed">{"Made With You in Mind"}</p>
          </div>
          <div className="relative aspect-[4/5] order-first sm:order-last">
            <Image
              src={img(stockImages.lifestyleC, 700, 875)}
              alt={"Our Fashion Philosophy"}
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
          <h2 className="font-serif text-3xl text-ink mb-3">{"Visit Us in Sylhet"}</h2>
          <p className="text-muted mb-8">{siteConfig.address}</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/contact">
              <Button variant="outline">{"Contact Us"}</Button>
            </Link>
            <Link href="/collection">
              <Button>{"Shop Now"}</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-[700px] mx-auto px-5 md:px-8 lg:px-12 py-12 sm:py-16 lg:py-24 text-center">
        <h2 className="font-serif text-3xl text-ink mb-6">{"Explore Our Collections"}</h2>
        <Link href="/new-arrivals">
          <Button size="lg">{"Shop Now"}</Button>
        </Link>
      </section>
    </div>
  );
}
