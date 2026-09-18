import type { Metadata } from "next";
import { getLaunchOfferAdminData } from "@/lib/supabase/queries/launch-offer";
import { LaunchOfferForm } from "@/components/admin/LaunchOfferForm";
import { AdminErrorState, PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = {
  title: "Launch offer",
  robots: { index: false, follow: false },
};

/**
 * The launch offer.
 *
 * One offer at a time, off until an administrator configures it. The screen is
 * deliberately not a list of campaigns: the shop runs one at a time, and a list
 * would invite two overlapping offers whose interaction nobody has decided.
 */
export default async function LaunchOfferPage() {
  const data = await getLaunchOfferAdminData();

  if (!data) {
    return (
      <>
        <PageHeader eyebrow="Marketing" title="Launch offer" />
        <AdminErrorState
          title="The launch offer is unavailable"
          description="The launch_offer table could not be read. Check that supabase/migrations/0026_launch_offer_and_first_party_analytics.sql has been applied."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Launch offer"
        description="One offer, shown on the homepage, on participating product pages, in the bag and at checkout. The discount is applied and re-checked by the database when the order is placed."
      />
      <LaunchOfferForm data={data} />
    </>
  );
}
