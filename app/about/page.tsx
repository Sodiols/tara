import type { Metadata } from "next";
import { AboutClient } from "@/components/AboutClient";
import { getStoreIdentity } from "@/lib/supabase/queries/settings";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about TARA, a Sylhet-born clothing and accessories brand for the modern Bangladeshi woman.",
};

export default async function AboutPage() {
  // The showroom address is a store setting, so a move or a correction reaches
  // the about page, the contact page, the navigation and the organisation
  // structured data at the same time.
  const { storeAddress } = await getStoreIdentity();
  return <AboutClient storeAddress={storeAddress} />;
}
