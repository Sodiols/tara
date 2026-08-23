"use client";

import Link from "next/link";
import Image from "next/image";
import { Facebook, Instagram } from "lucide-react";
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

  const shopLinks = [
    { label: "Unstitched Three Piece", href: "/unstitched-three-piece" },
    { label: "Ready Three Piece", href: "/ready-three-piece" },
    { label: "New Arrivals", href: "/new-arrivals" },
    { label: "Accessories", href: "/accessories" },
    { label: "Collection", href: "/collection" },
  ];

  const careLinks = [
    { label: "Contact Us", href: "/contact" },
    { label: "Delivery Information", href: "/delivery-information" },
    { label: "Exchange Policy", href: "/exchange-policy" },
    { label: "Size Guide", href: "/size-guide" },
    { label: "Frequently Asked Questions", href: "/faq" },
  ];

  const aboutLinks = [
    { label: "Our Story", href: "/about" },
    { label: "Physical Store", href: "/contact" },
    { label: "Careers", href: "/contact" },
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms and Conditions", href: "/terms-and-conditions" },
  ];

  return (
    <footer className="bg-wine">
      <Container className="py-16 lg:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block" aria-label={"TARA"}>
              <Image
                src="/logo/logo-off-white.png"
                alt={"TARA"}
                width={250}
                height={64}
                quality={90}
                className="h-7 lg:h-9 w-auto"
              />
            </Link>
            <div className="flex items-center gap-3 mt-6">
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
              {"Shop"}
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
              {"Customer Care"}
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
              {"About TARA"}
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
            © {new Date().getFullYear()} {"TARA"}. {"All rights reserved."}
          </p>
          <div className="flex items-center gap-3">
            <span className="border border-taraIvory/25 text-taraIvory/80 px-2 py-1">bKash</span>
            <span className="border border-taraIvory/25 text-taraIvory/80 px-2 py-1">Nagad</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
