"use client";

import { useLanguage } from "@/lib/i18n";

const messages = ["announcement.message"];

export function AnnouncementBar() {
  const { t } = useLanguage();
  return (
    <div className="bg-wine text-taraIvory text-center text-[11px] sm:text-xs tracking-wide py-2.5 px-4">
      <p>{t(messages[0])}</p>
    </div>
  );
}
