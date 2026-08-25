import type { Metadata } from "next";
import Link from "next/link";
import { unsubscribeNewsletterAction } from "@/lib/supabase/actions/public";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

/**
 * One-click unsubscribe, reached from the link in a TARA email.
 *
 * The token in the URL is the only thing that identifies the subscriber. That
 * matters: the previous mechanism was an RPC that took an email address and was
 * granted to anon, so anyone who knew — or guessed — somebody's address could
 * remove them from the list, and the function reported success either way so
 * the victim got no signal. Knowing an address is now not enough; you need the
 * 192-bit token, which only ever travels inside mail sent to that address.
 *
 * The page never reveals whose address the token belongs to.
 */
export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Unsubscribe from TARA emails.",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await unsubscribeNewsletterAction(token ?? "");

  return (
    <Container className="py-20 sm:py-24">
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-serif text-3xl font-normal text-ink sm:text-4xl">
          {result.ok ? "You have been unsubscribed" : "That link did not work"}
        </h1>
        <p className="mt-4 font-sans text-sm leading-6 text-muted">{result.message}</p>
        <div className="mt-10">
          <Link href="/">
            <Button variant="secondary">{"Continue Shopping"}</Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}
