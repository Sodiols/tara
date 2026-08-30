import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { TermsClient } from "@/components/policies/TermsClient";

export const metadata: Metadata = buildMetadata({
  title: "Terms and Conditions",
  description:
    "The terms that apply when you browse, order or return items from TARA.",
  path: "/terms-and-conditions",
});

export default function TermsPage() {
  return <TermsClient />;
}
