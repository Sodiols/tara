import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { ContactClient } from "@/components/forms/ContactClient";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";

export const metadata: Metadata = buildMetadata({
  title: "Contact Us",
  description:
    "Contact TARA in Zakiganj, Sylhet — phone, WhatsApp, email, or the enquiry form. We reply during shop hours.",
  path: "/contact",
});

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
