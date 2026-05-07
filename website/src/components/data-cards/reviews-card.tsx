"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

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
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

export function ReviewsCard({ data }: ReviewsCardProps) {
  if (data.message && !data.reviews && !data.totalReviews) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground italic">{data.message}</p>
        </CardContent>
      </Card>
    );
  }

  // Summary view
  if (data.totalReviews !== undefined && data.distribution) {
    const maxCount = Math.max(
      ...Object.values(data.distribution),
      1
    );

    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Star className="h-4 w-4" />
            Review Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div>
              <p className="text-3xl font-bold">
                {(data.averageRating ?? 0).toFixed(1)}
              </p>
              <StarRating rating={Math.round(data.averageRating ?? 0)} />
            </div>
            <p className="text-sm text-muted-foreground">
              {data.totalReviews} review{data.totalReviews !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="space-y-1.5 mb-4">
            {(["5star", "4star", "3star", "2star", "1star"] as const).map(
              (key) => {
                const count = data.distribution![key];
                const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="w-6 text-right text-muted-foreground">
                      {key[0]}
                    </span>
                    <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="w-6 text-muted-foreground">{count}</span>
                  </div>
                );
              }
            )}
          </div>

          {data.topPraise && data.topPraise.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-green-600 dark:text-green-400">
                Top praise
              </p>
              {data.topPraise.slice(0, 2).map((r, i) => (
                <div key={i} className="text-xs">
                  <StarRating rating={r.rating} />
                  <p className="mt-0.5 text-muted-foreground truncate">
                    {r.excerpt || r.title}
                  </p>
                </div>
              ))}
            </div>
          )}

          {data.topComplaints && data.topComplaints.length > 0 && (
            <div className="border-t pt-3 mt-3 space-y-2">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                Top complaints
              </p>
              {data.topComplaints.slice(0, 2).map((r, i) => (
                <div key={i} className="text-xs">
                  <StarRating rating={r.rating} />
                  <p className="mt-0.5 text-muted-foreground truncate">
                    {r.excerpt || r.title}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Reviews list view
  if (data.reviews && data.reviews.length > 0) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Star className="h-4 w-4" />
            Product Reviews
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.reviews.slice(0, 5).map((review, i) => (
            <div key={i} className="border-b last:border-0 pb-2 last:pb-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium truncate max-w-[60%]">
                  {review.productTitle}
                </p>
                <StarRating rating={review.rating} />
              </div>
              {review.title && (
                <p className="text-sm mt-0.5">{review.title}</p>
              )}
              {review.body && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {review.body}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                {review.authorName && <span>by {review.authorName}</span>}
                {review.verifiedPurchase && (
                  <span className="text-green-600 dark:text-green-400">
                    Verified
                  </span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return null;
}
