import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { AboutClient } from "@/components/AboutClient";
import { getStoreIdentity } from "@/lib/supabase/queries/settings";

export const metadata: Metadata = buildMetadata({
  title: "About Us",
  description:
    "TARA is a women's clothing brand from Zakiganj, Sylhet, making three piece, two piece, hijab and accessories for everyday wear across Bangladesh.",
  path: "/about",
});

export default async function AboutPage() {
  // The showroom address is a store setting, so a move or a correction reaches
  // the about page, the contact page, the navigation and the organisation
  // structured data at the same time.
  const { storeAddress } = await getStoreIdentity();
  return <AboutClient storeAddress={storeAddress} />;
}
