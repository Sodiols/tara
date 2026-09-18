import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { ExchangePolicyClient } from "@/components/policies/ExchangePolicyClient";
import { getPolicySettings } from "@/lib/supabase/queries/settings";

export const metadata: Metadata = buildMetadata({
  title: "Exchange Policy",
  description:
    "How exchanges work at TARA: what can be exchanged, the time limit, and the condition items must be returned in.",
  path: "/exchange-policy",
});

export default async function ExchangePolicyPage() {
  const policies = await getPolicySettings();
  return <ExchangePolicyClient exchangeWindowDays={policies.exchangeWindowDays} />;
}
