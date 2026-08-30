import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { PrivacyPolicyClient } from "@/components/policies/PrivacyPolicyClient";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "How TARA collects, uses and protects the personal information you give us when you shop or create an account.",
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyClient />;
}
