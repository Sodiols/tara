"use client";

import { Gift } from "lucide-react";
import { useLaunchOffer } from "./LaunchOfferProvider";
import { offerBadge, offerIncludesProduct, offerIsLive, offerSentence } from "@/lib/launch-offer";

/**
 * The launch offer, wherever it needs to be mentioned in one line.
 *
 * Used on the product page, in the bag drawer, on the bag page and at checkout.
 * One component so the wording is identical in all four; the alternative is
 * four slightly different sentences about the same promise, which is how a shop
 * ends up appearing to offer two things.
 *
 * Renders NOTHING when there is no live offer, when the offer has expired while
 * this tab was open, or when the product in front of the customer is not part
 * of the campaign. A quiet absence is the correct state — the shop ships with
 * no offer at all.
 *
 * Deliberately plain: a single bordered line in the brand's own ivory and wine,
 * no countdown, no flashing, no "only 3 left". It is information, not pressure.
 */
export function LaunchOfferNote({
  productId,
  className,
}: {
  /** When given, the note appears only if this product takes part. */
  productId?: string;
  className?: string;
}) {
  const offer = useLaunchOffer();
  if (!offer || !offerIsLive(offer)) return null;
  if (productId && !offerIncludesProduct(offer, productId)) return null;

  return (
    <div
      className={`flex items-start gap-2.5 rounded-control border border-wine/25 bg-taraIvory px-3 py-2.5 ${className ?? ""}`}
    >
      <Gift size={16} className="mt-0.5 shrink-0 text-wine" aria-hidden="true" />
      <p className="font-sans text-xs leading-relaxed text-ink">
        <span className="font-semibold">{offer.title.trim() || offerBadge(offer)}</span>
        {" — "}
        <span className="text-muted">{offer.description.trim() || offerSentence(offer)}</span>
      </p>
    </div>
  );
}

/**
 * The same offer as a card badge.
 *
 * Small, quiet, and only on products that are actually in the campaign — a
 * badge on everything is a badge on nothing.
 */
export function LaunchOfferBadge({ productId }: { productId: string }) {
  const offer = useLaunchOffer();
  if (!offer || !offerIsLive(offer)) return null;
  if (!offerIncludesProduct(offer, productId)) return null;

  // The same pill the Sale and New badges use, in TARA Black so the three are
  // distinguishable at a glance on a card that carries more than one.
  return (
    <span className="rounded-full bg-taraBlack px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-taraIvory">
      {offerBadge(offer)}
    </span>
  );
}
