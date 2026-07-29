import { getAddresses } from "@/lib/supabase/queries/account";
import { AddressesClient } from "@/components/forms/AddressesClient";
import { Container } from "@/components/layout/Container";

export default async function AddressesPage() {
  const addresses = await getAddresses();
  return <Container className="py-10 lg:py-14"><AddressesClient addresses={addresses} /></Container>;
}
