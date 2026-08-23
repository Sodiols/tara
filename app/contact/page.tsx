import type { Metadata } from "next";
import { ContactClient } from "@/components/forms/ContactClient";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";
import { siteConfig } from "@/data/site";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with TARA — call, message us on WhatsApp, email, or send an enquiry through the form.",
  alternates: { canonical: `${siteConfig.url}/contact` },
};

export default async function ContactPage() {
  // Contact details come from the live store settings rather than a constant,
  // so the shop owner can correct them from the admin panel and so no invented
  // placeholder number can ever reach a customer.
  const settings = await getPublicStoreSettings();

  return (
    <ContactClient
      contact={{
        phone: settings.supportPhone,
        whatsapp: settings.whatsappNumber,
        email: settings.supportEmail,
        address: settings.storeAddress,
        facebook: settings.facebookUrl,
        instagram: settings.instagramUrl,
      }}
    />
  );
}
