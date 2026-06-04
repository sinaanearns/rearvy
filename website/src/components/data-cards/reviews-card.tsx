"use client";

import { BadgeCheck, Star } from "lucide-react";

import {
  DataCardFrame,
  DataCardMessage,
  DataMetricTile,
} from "./data-card-frame";

interface ReviewsCardProps {
  data: {
    reviews?: Array<{
      productTitle: string;
      rating: number;
      title?: string;
      body?: string;
      authorName?: string;
      verifiedPurchase?: boolean;
      date?: string;
    }>;
    totalReviews?: number;
    averageRating?: number;
    distribution?: {
      "5star": number;
      "4star": number;
      "3star": number;
      "2star": number;
      "1star": number;
    };
    topPraise?: Array<{
      rating: number;
      title?: string;
      excerpt?: string;
      author?: string;
    }>;
    topComplaints?: Array<{
      rating: number;
      title?: string;
      excerpt?: string;
      author?: string;
    }>;
    message?: string;
  };
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3 w-3 ${
            star <= rating
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30"
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function ReviewsCard({ data }: ReviewsCardProps) {
  if (data.message && !data.reviews && !data.totalReviews) {
    return (
      <DataCardMessage
        icon={Star}
        message={data.message}
        title="Review note"
        tone="amber"
      />
    );
  }

  if (data.totalReviews !== undefined && data.distribution) {
    const maxCount = Math.max(...Object.values(data.distribution), 1);

    return (
      <DataCardFrame
        icon={Star}
        title="Review summary"
        subtitle="Rating distribution and customer sentiment"
        tone="amber"
      >
        <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
          <div className="rounded-[8px] border border-border/70 bg-background/78 p-3 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-4xl font-semibold tracking-tight text-foreground">
              {(data.averageRating ?? 0).toFixed(1)}
            </p>
            <div className="mt-2">
              <StarRating rating={Math.round(data.averageRating ?? 0)} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {data.totalReviews} review{data.totalReviews !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="space-y-2 rounded-[8px] border border-border/70 bg-background/78 p-3 dark:border-white/10 dark:bg-white/[0.04]">
            {(["5star", "4star", "3star", "2star", "1star"] as const).map(
              (key) => {
                const count = data.distribution![key];
                const width = maxCount > 0 ? (count / maxCount) * 100 : 0;

                return (
                  <div key={key} className="grid grid-cols-[32px_1fr_32px] items-center gap-2 text-xs">
                    <span className="text-right text-muted-foreground">{key[0]}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {(data.topPraise?.length || data.topComplaints?.length) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.topPraise && data.topPraise.length > 0 && (
              <div className="rounded-[8px] border border-emerald-200/50 bg-emerald-500/10 p-3 dark:border-emerald-900/50">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                  Top praise
                </p>
                <div className="mt-3 space-y-2">
                  {data.topPraise.slice(0, 2).map((review, index) => (
                    <div key={index} className="text-xs">
                      <StarRating rating={review.rating} />
                      <p className="mt-1 truncate text-muted-foreground">
                        {review.excerpt || review.title}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.topComplaints && data.topComplaints.length > 0 && (
              <div className="rounded-[8px] border border-rose-200/50 bg-rose-500/10 p-3 dark:border-rose-900/50">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-200">
                  Top complaints
                </p>
                <div className="mt-3 space-y-2">
                  {data.topComplaints.slice(0, 2).map((review, index) => (
                    <div key={index} className="text-xs">
                      <StarRating rating={review.rating} />
                      <p className="mt-1 truncate text-muted-foreground">
                        {review.excerpt || review.title}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DataCardFrame>
    );
  }

  if (data.reviews && data.reviews.length > 0) {
    return (
      <DataCardFrame
        icon={Star}
        title="Product reviews"
        subtitle="Recent customer feedback"
        tone="amber"
      >
        <div className="space-y-3">
          {data.reviews.slice(0, 5).map((review, index) => (
            <div
              key={`${review.productTitle}:${index}`}
              className="rounded-[8px] border border-border/70 bg-background/78 p-3 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                  {review.productTitle}
                </p>
                <StarRating rating={review.rating} />
              </div>
              {review.title && <p className="mt-2 text-sm text-foreground">{review.title}</p>}
              {review.body && (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {review.body}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {review.authorName && <span>by {review.authorName}</span>}
                {review.verifiedPurchase && (
                  <span className="inline-flex items-center gap-1 rounded-[8px] border border-emerald-200/60 bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-200">
                    <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                    Verified
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </DataCardFrame>
    );
  }

  return null;
}
