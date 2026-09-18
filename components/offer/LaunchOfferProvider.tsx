"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LaunchOffer } from "@/lib/launch-offer";

/**
 * The live offer, read once on the server and shared with every client
 * component that needs it.
 *
 * WHY A CONTEXT RATHER THAN PROPS. A product card carries a badge, and cards
 * are rendered by six different listings, a carousel, search, Quick View and
 * the recently-viewed rail. Threading the offer through all of them would mean
 * touching every one of those components to add a prop that is the same value
 * everywhere. WHY NOT A FETCH: because then every card would ask the database
 * whether there is an offer, which is a query per card on a page of twenty-four.
 *
 * The value comes from the root layout's single cached read, so it costs one
 * query per render pass for the whole page, and null — no offer — is the
 * default in every direction.
 */
const LaunchOfferContext = createContext<LaunchOffer | null>(null);

export function LaunchOfferProvider({
  offer,
  children,
}: {
  offer: LaunchOffer | null;
  children: ReactNode;
}) {
  return <LaunchOfferContext.Provider value={offer}>{children}</LaunchOfferContext.Provider>;
}

/** The live offer, or null. Null is the normal state: there is usually none. */
export function useLaunchOffer(): LaunchOffer | null {
  return useContext(LaunchOfferContext);
}
