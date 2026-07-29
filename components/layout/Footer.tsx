"use client";

import Link from "next/link";
import Image from "next/image";
import { Facebook, Instagram, MapPin } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { siteConfig } from "@/data/site";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { Container } from "./Container";

function TiktokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 2h-3v13.2a2.8 2.8 0 1 1-2-2.68V9.4a5.8 5.8 0 1 0 5 5.75V8.2a7.4 7.4 0 0 0 4.5 1.5V6.7a4.5 4.5 0 0 1-4.5-4.5V2Z" />
    </svg>
  );
}

export function Footer() {
  const { t } = useLanguage();

  const shopLinks = [
    { label: t("nav.unstitched"), href: "/unstitched-three-piece" },
    { label: t("nav.ready"), href: "/ready-three-piece" },
    { label: t("newArrivals.eyebrow"), href: "/new-arrivals" },
    { label: t("nav.accessories"), href: "/accessories" },
    { label: t("nav.collection"), href: "/collection" },
  ];

  const careLinks = [
    { label: t("footer.contactUs"), href: "/contact" },
    { label: t("footer.deliveryInfo"), href: "/delivery-information" },
    { label: t("footer.exchangePolicy"), href: "/exchange-policy" },
    { label: t("footer.sizeGuide"), href: "/size-guide" },
    { label: t("footer.faq"), href: "/faq" },
  ];

  const aboutLinks = [
    { label: t("footer.ourStory"), href: "/about" },
    { label: t("footer.physicalStore"), href: "/contact" },
    { label: t("footer.careers"), href: "/contact" },
    { label: t("footer.privacyPolicy"), href: "/privacy-policy" },
    { label: t("footer.termsConditions"), href: "/terms-and-conditions" },
  ];

  return (
    <footer className="bg-wine">
      <Container className="py-16 lg:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block" aria-label={t("common.brand")}>
              <Image
                src="/logo/logo-off-white.png"
                alt={t("common.brand")}
                width={250}
                height={200}
                className="h-11 lg:h-14 w-auto"
              />
            </Link>
            <p className="font-sans font-normal text-sm text-taraIvory/70 mt-4 flex items-start gap-2 max-w-[220px]">
              <MapPin size={16} className="shrink-0 mt-0.5" />
              {t("footer.storeLocation")}
            </p>
            <div className="flex items-center gap-3 mt-5">
              <a href={siteConfig.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-taraIvory hover:text-white transition-colors">
                <Facebook size={18} />
              </a>
              <a href={siteConfig.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-taraIvory hover:text-white transition-colors">
                <Instagram size={18} />
              </a>
              <a href={siteConfig.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-taraIvory hover:text-white transition-colors">
                <TiktokIcon size={18} />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-taraIvory mb-4">
              {t("footer.shop")}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {shopLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="font-sans font-normal text-sm text-taraIvory/75 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-taraIvory mb-4">
              {t("footer.customerCare")}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {careLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="font-sans font-normal text-sm text-taraIvory/75 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-sans font-semibold text-xs uppercase tracking-[0.05em] text-taraIvory mb-4">
              {t("footer.aboutTara")}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {aboutLinks.map((l, i) => (
                <li key={`${l.href}-${i}`}>
                  <Link
                    href={l.href}
                    className="font-sans font-normal text-sm text-taraIvory/75 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-taraIvory/15 pt-10 mb-10">
          <NewsletterForm variant="dark" />
        </div>

        <div className="border-t border-taraIvory/15 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans font-normal text-xs text-taraIvory/70">
          <p>
            © {new Date().getFullYear()} {t("common.brand")}. {t("footer.copyright")}
          </p>
          <div className="flex items-center gap-3">
            <span className="border border-taraIvory/25 text-taraIvory/80 px-2 py-1">bKash</span>
            <span className="border border-taraIvory/25 text-taraIvory/80 px-2 py-1">Nagad</span>
            <span className="border border-taraIvory/25 text-taraIvory/80 px-2 py-1">COD</span>
            <span className="border border-taraIvory/25 text-taraIvory/80 px-2 py-1">Visa</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
