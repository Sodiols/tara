import type { Metadata } from "next";
import { ExchangePolicyClient } from "@/components/policies/ExchangePolicyClient";

export const metadata: Metadata = {
  title: "Exchange Policy",
  description: "Learn about TARA's easy exchange policy for undready and ready-made products.",
};

export default function ExchangePolicyPage() {
  return <ExchangePolicyClient />;
}
