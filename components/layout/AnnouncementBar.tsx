"use client";

/**
 * The one line of promotional copy above the header.
 *
 * The message is generated from the live delivery settings by
 * `freeDeliveryHeadline()` and passed in from the server, so it can never
 * contradict what checkout actually charges. It used to be a hardcoded
 * "Free delivery in Sylhet on orders above ৳1500", which would have kept
 * promising ৳1500 after an administrator changed the threshold — and kept
 * promising free delivery at all after the offer was switched off.
 */
export function AnnouncementBar({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="bg-wine text-taraIvory text-center text-[11px] sm:text-xs tracking-wide py-2.5 px-4">
      <p>{message}</p>
    </div>
  );
}
