"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BadgeCheck, Star } from "lucide-react";
import type { Review } from "@/types";
import { getReviewEligibilityAction, submitReviewAction, type ReviewEligibility } from "@/lib/supabase/actions/reviews";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

interface ReviewsSectionProps {
  productId: string;
  productSlug: string;
  reviews: Review[];
  rating: number;
  reviewCount: number;
}

type ReviewPanel = ReviewEligibility | { authenticated: true; eligible: true; submitted: true };

export function ReviewsSection({ productId, productSlug, reviews, rating, reviewCount }: ReviewsSectionProps) {
  const [panel, setPanel] = useState<ReviewPanel | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const openReview = () => {
    setMessage("");
    setFieldErrors({});
    startTransition(async () => setPanel(await getReviewEligibilityAction(productId)));
  };

  const submit = (formData: FormData) => {
    setMessage("");
    setFieldErrors({});
    startTransition(async () => {
      const result = await submitReviewAction({
        productId,
        rating: selectedRating,
        title: formData.get("title"),
        commentEn: formData.get("commentEn"),
      });
      if (result.ok) {
        setPanel({ authenticated: true, eligible: true, submitted: true });
        return;
      }
      setFieldErrors(result.fieldErrors ?? {});
      setMessage(result.message);
    });
  };

  const signInHref = `/login?returnTo=${encodeURIComponent(`/product/${productSlug}#reviews`)}`;

  return (
    <section aria-labelledby="reviews-title">
      <div className="mb-7 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="reviews-title" className="font-serif text-2xl font-normal leading-[1.1] text-ink sm:text-3xl">Customer Reviews</h2>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center gap-1" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
              {Array.from({ length: 5 }).map((_, index) => <Star key={index} size={17} aria-hidden="true" className={index < Math.round(rating) ? "fill-wine text-wine" : "text-border"} />)}
            </div>
            <span className="text-sm text-muted">{rating.toFixed(1)} ({reviewCount})</span>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={openReview} loading={isPending && panel === null}>Write a Review</Button>
      </div>

      {reviews.length === 0 ? <p className="text-sm text-muted">No reviews yet.</p> : (
        <div className="flex flex-col gap-6">
          {reviews.map((review) => (
            <article key={review.id} className="border-b border-border pb-6">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{review.author}</span>
                  {review.verifiedPurchase && <span className="inline-flex items-center gap-1 rounded-full bg-beige px-2 py-1 text-[11px] font-medium text-wine"><BadgeCheck size={13} aria-hidden="true" /> Verified Purchase</span>}
                </div>
                <time dateTime={review.date} className="text-xs text-muted">{new Date(review.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time>
              </div>
              <div className="mb-2 flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, index) => <Star key={index} size={13} aria-hidden="true" className={index < review.rating ? "fill-wine text-wine" : "text-border"} />)}
              </div>
              {review.title && <h3 className="mb-1 font-serif text-lg text-ink">{review.title}</h3>}
              <p className="text-sm leading-6 text-muted">{review.comment}</p>
            </article>
          ))}
        </div>
      )}

      <Modal isOpen={panel !== null} onClose={() => { if (!isPending) setPanel(null); }} title="Write a Review" maxWidthClass="max-w-lg">
        {panel && !panel.authenticated && <div className="space-y-5"><p className="text-sm leading-6 text-muted">Please sign in to review a product you purchased.</p><Link href={signInHref} className="inline-flex h-12 items-center justify-center rounded-control bg-wine px-7 text-[13px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-taraBlack">Sign In</Link></div>}
        {panel?.authenticated && !panel.eligible && <p className="text-sm leading-6 text-muted">{panel.reason === "already_reviewed" ? "You have already reviewed this purchase." : "Reviews are available to customers who purchased and received this product."}</p>}
        {panel?.authenticated && panel.eligible && "submitted" in panel && panel.submitted && <div role="status" className="rounded-panel bg-beige p-5 text-sm leading-6 text-ink">Thank you. Your review has been submitted for approval.</div>}
        {panel?.authenticated && panel.eligible && !("submitted" in panel) && (
          <form action={submit} className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">Rating <span className="text-wine">*</span></legend>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setSelectedRating(value)} aria-label={`${value} star${value === 1 ? "" : "s"}`} aria-pressed={selectedRating === value} className="rounded-control p-1 text-border transition-colors hover:text-wine focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine"><Star size={28} aria-hidden="true" className={value <= selectedRating ? "fill-wine text-wine" : "text-border"} /></button>)}
              </div>
              {fieldErrors.rating?.[0] && <p className="mt-1 text-xs text-wine">{fieldErrors.rating[0]}</p>}
            </fieldset>
            <Input name="title" label="Title (optional)" maxLength={120} error={fieldErrors.title?.[0]} placeholder="A short summary" />
            <Textarea name="commentEn" label="Your review" required minLength={10} maxLength={2000} rows={5} error={fieldErrors.commentEn?.[0]} placeholder="Tell us what you thought about this product" />
            {message && <p role="alert" className="text-sm text-wine">{message}</p>}
            <Button type="submit" fullWidth loading={isPending} disabled={selectedRating === 0}>Submit Review</Button>
          </form>
        )}
      </Modal>
    </section>
  );
}
