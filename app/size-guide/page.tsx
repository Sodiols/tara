import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { SizeGuideClient } from "@/components/policies/SizeGuideClient";

export const metadata: Metadata = buildMetadata({
  title: "Size Guide",
  description:
    "Measurements for TARA three piece and two piece sets, with guidance on choosing between sizes.",
  path: "/size-guide",
});

export default function SizeGuidePage() {
  return <SizeGuideClient />;
}
