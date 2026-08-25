import type { Metadata } from "next";
import Image from "next/image";
import { getStoreIdentity } from "@/lib/supabase/queries/settings";
import { formatBdPhone, toInternationalBdPhone } from "@/lib/phone";

/**
 * Shown while maintenance mode is on.
 *
 * The proxy rewrites every storefront request here with a 503 and a Retry-After
 * header, so the shopper keeps the URL they asked for and a crawler is told the
 * closure is temporary rather than de-indexing the catalogue.
 *
 * Deliberately plain: the brand's own wordmark, the serif heading, one
 * sentence, and the shop's phone number if there is one. No countdown, no
 * newsletter capture, no offers — someone who arrives here wanted to buy
 * something and could not, and the useful thing is a way to reach a person.
 */
export const metadata: Metadata = {
  title: "Back shortly",
  description: "TARA is closed for a short update.",
  robots: { index: false, follow: false },
};

export default async function MaintenancePage() {
  const identity = await getStoreIdentity();

  return (
    // The site chrome is suppressed here, so this page supplies its own <main>
    // landmark — otherwise the layout's "Skip to main content" link points at
    // an element that does not exist.
    <main
      id="main-content"
      className="flex min-h-[70vh] flex-col items-center justify-center px-5 py-20 text-center"
    >
      <Image
        src="/logo/logo-black.png"
        alt={identity.storeName}
        width={250}
        height={64}
        priority
        quality={90}
        className="h-6 w-auto sm:h-7"
      />

      <h1 className="mt-10 font-serif text-3xl font-normal leading-tight text-ink sm:text-4xl">
        {"We are back shortly"}
      </h1>

      <p className="mt-4 max-w-md font-sans text-sm leading-6 text-muted">
        {
          "TARA is closed for a short update. Your bag and your account are safe — please try again in a little while."
        }
      </p>

      {(identity.supportPhone || identity.supportEmail) && (
        <div className="mt-10 border-t border-border pt-8">
          <p className="font-sans text-xs uppercase tracking-[0.08em] text-muted">
            {"Need us in the meantime"}
          </p>
          <div className="mt-3 flex flex-col items-center gap-2 font-sans text-sm text-ink">
            {identity.supportPhone && (
              <a
                href={`tel:${toInternationalBdPhone(identity.supportPhone) ?? identity.supportPhone}`}
                className="underline-offset-4 hover:text-wine hover:underline"
              >
                {formatBdPhone(identity.supportPhone)}
              </a>
            )}
            {identity.supportEmail && (
              <a
                href={`mailto:${identity.supportEmail}`}
                className="break-all underline-offset-4 hover:text-wine hover:underline"
              >
                {identity.supportEmail}
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
