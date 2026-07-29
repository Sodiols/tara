"use client";

import { Star } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { Review } from "@/types";

interface ReviewsSectionProps {
  reviews: Review[];
  rating: number;
  reviewCount: number;
}

export function ReviewsSection({ reviews, rating, reviewCount }: ReviewsSectionProps) {
  const { t, pick, locale } = useLanguage();

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={18}
              className={i < Math.round(rating) ? "fill-wine text-wine" : "text-border"}
            />
          ))}
        </div>
        <span className="text-sm text-muted">
          {rating.toFixed(1)} ({reviewCount})
        </span>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-muted">{t("product.noReviews")}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-border pb-6">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-ink font-medium">{review.author}</span>
                <span className="text-xs text-muted">
                  {new Date(review.date).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-0.5 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={13} className={i < review.rating ? "fill-wine text-wine" : "text-border"} />
                ))}
              </div>
              <p className="text-sm text-muted">{pick(review.comment)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
