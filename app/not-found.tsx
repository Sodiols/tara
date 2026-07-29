"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="max-w-lg mx-auto px-5 py-24 sm:py-32 text-center">
      <p className="font-serif text-7xl text-wine mb-4">404</p>
      <h1 className="font-serif text-3xl text-ink mb-3">{t("notFound.heading")}</h1>
      <p className="text-sm text-muted mb-8">{t("notFound.text")}</p>
      <Link href="/">
        <Button>{t("notFound.cta")}</Button>
      </Link>
    </div>
  );
}
