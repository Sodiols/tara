import type { Metadata } from "next";
import { SizeGuideClient } from "@/components/policies/SizeGuideClient";

export const metadata: Metadata = {
  title: "Size Guide",
  description: "Find your perfect fit with TARA's detailed size guide for ready-made three piece sets.",
};

export default function SizeGuidePage() {
  return <SizeGuideClient />;
}
