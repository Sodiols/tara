import type { Metadata } from "next";
import { TermsClient } from "@/components/policies/TermsClient";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Read the terms and conditions for shopping with TARA.",
};

export default function TermsPage() {
  return <TermsClient />;
}
