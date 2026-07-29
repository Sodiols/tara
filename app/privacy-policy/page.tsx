import type { Metadata } from "next";
import { PrivacyPolicyClient } from "@/components/policies/PrivacyPolicyClient";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read TARA's privacy policy on how we collect, use, and protect your information.",
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyClient />;
}
