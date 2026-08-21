import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

type ReviewRecord = Record<string, unknown> & {
  product_id?: unknown;
  rating?: unknown;
  title?: unknown;
  body?: unknown;
  author_name?: unknown;
  verified_purchase?: unknown;
  sentiment?: unknown;
  created_at_source?: unknown;
};

type ProductTitleRecord = {
  id: string;
  title: string;
};

function toReviewRecord(data: Record<string, unknown>): ReviewRecord {
  return data;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getProductId(review: ReviewRecord): string {
  return optionalString(review.product_id) || "";
}

function getRating(review: ReviewRecord): number {
  return toNumber(review.rating);
}

function getExcerpt(value: unknown, length: number): string | undefined {
  return typeof value === "string" ? value.substring(0, length) : undefined;
}

function productTitleRecordsFromSnapshot(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
): ProductTitleRecord[] {
  return docs
    .map((doc) => {
      const title = optionalString(doc.data().title);
      return title ? { id: doc.id, title } : null;
    })
    .filter((product): product is ProductTitleRecord => Boolean(product));
}

export function getProductReviews(ctx: ToolContext) {
  return tool({
    description:
      "Get product reviews with optional filtering by product, rating, or sort order",
    inputSchema: z.object({
      productTitle: z
        .string()
        .optional()
        .describe("Filter reviews by product title (partial match)"),
      rating: z
        .number()
        .optional()
        .describe("Filter by exact star rating (1-5)"),
      limit: z.number().optional().default(10),
      sortBy: z
        .enum(["recent", "rating"])
        .optional()
        .default("recent"),
    }),
    execute: async ({ productTitle, rating, limit, sortBy }) => {
      let query = ctx.adminDb
        .collection(COLLECTIONS.PRODUCT_REVIEWS)
        .where("user_id", "==", ctx.userId);

      if (rating) {
        query = query.where("rating", "==", rating);
      }

      if (sortBy === "rating") {
        query = query.orderBy("rating", "desc");
      } else {
        query = query.orderBy("created_at_source", "desc");
      }

      query = query.limit(limit);
      const snapshot = await query.get();
      const reviews = snapshot.docs.map((doc) =>
        toReviewRecord(doc.data() as Record<string, unknown>)
      );

      if (!reviews || reviews.length === 0) {
        return {
          reviews: [],
          message: "No product reviews found. Reviews may not be synced yet.",
        };
      }

      // Get product titles for the reviews
      const productIds = [
        ...new Set(reviews.map((review) => getProductId(review)).filter(Boolean)),
      ];

      let productMap = new Map<string, string>();
      if (productIds.length > 0) {
        const snapshot = await ctx.adminDb
          .collection(COLLECTIONS.PRODUCTS)
          .where("user_id", "==", ctx.userId)
          .get();
        const products = productTitleRecordsFromSnapshot(snapshot.docs)
          .filter((product) => productIds.includes(product.id));

        productMap = new Map(
          (products || []).map((p) => [p.id, p.title])
        );
      }

      // Filter by product title if provided (post-query since it's a join)
      let filteredReviews = reviews;
      if (productTitle) {
        const lowerSearch = productTitle.toLowerCase();
        filteredReviews = reviews.filter((r) => {
          const title = productMap.get(getProductId(r)) || "";
          return title.toLowerCase().includes(lowerSearch);
        });
      }

      return {
        reviews: filteredReviews.map((r) => ({
          productTitle: productMap.get(getProductId(r)) || "Unknown Product",
          rating: getRating(r),
          title: optionalString(r.title),
          body: getExcerpt(r.body, 300),
          authorName: optionalString(r.author_name),
          verifiedPurchase: r.verified_purchase,
          sentiment: optionalString(r.sentiment),
          date: optionalString(r.created_at_source),
        })),
      };
    },
  });
}

export function getReviewSummary(ctx: ToolContext) {
  return tool({
    description:
      "Get review summary with average rating, star distribution, and recent highlights for a product or all products",
    inputSchema: z.object({
      productTitle: z
        .string()
        .optional()
        .describe("Filter summary to a specific product (partial match)"),
      periodStart: z
        .string()
        .optional()
        .describe("ISO date to filter reviews from"),
      periodEnd: z
        .string()
        .optional()
        .describe("ISO date to filter reviews until"),
    }),
    execute: async ({ productTitle, periodStart, periodEnd }) => {
      let query = ctx.adminDb
        .collection(COLLECTIONS.PRODUCT_REVIEWS)
        .where("user_id", "==", ctx.userId);

      if (periodStart) {
        query = query.where("created_at_source", ">=", periodStart);
      }
      if (periodEnd) {
        query = query.where("created_at_source", "<=", periodEnd);
      }

      const snapshot = await query.get();
      const reviews = snapshot.docs.map((doc) =>
        toReviewRecord(doc.data() as Record<string, unknown>)
      );

      if (!reviews || reviews.length === 0) {
        return {
          message: "No reviews found for the given criteria.",
          totalReviews: 0,
          averageRating: 0,
          distribution: { "5star": 0, "4star": 0, "3star": 0, "2star": 0, "1star": 0 },
        };
      }

      // Filter by product if specified
      let filteredReviews = reviews;
      if (productTitle) {
        const productIds: string[] = [];
        const snapshot = await ctx.adminDb
          .collection(COLLECTIONS.PRODUCTS)
          .where("user_id", "==", ctx.userId)
          .get();

        const products = productTitleRecordsFromSnapshot(snapshot.docs)
          .filter((product) => product.title.toLowerCase().includes(productTitle.toLowerCase()));

        for (const product of products) productIds.push(product.id);

        filteredReviews = reviews.filter(
          (r) => productIds.includes(getProductId(r))
        );
      }

      if (filteredReviews.length === 0) {
        return {
          message: `No reviews found for "${productTitle}".`,
          totalReviews: 0,
          averageRating: 0,
          distribution: { "5star": 0, "4star": 0, "3star": 0, "2star": 0, "1star": 0 },
        };
      }

      // Calculate distribution
      const distribution = { "5star": 0, "4star": 0, "3star": 0, "2star": 0, "1star": 0 };
      let totalRating = 0;

      for (const r of filteredReviews) {
        const rating = getRating(r);
        totalRating += rating;
        const key = `${rating}star` as keyof typeof distribution;
        if (key in distribution) {
          distribution[key]++;
        }
      }

      const averageRating = totalRating / filteredReviews.length;

      // Get top praise (highest rated) and complaints (lowest rated)
      const sorted = [...filteredReviews].sort((a, b) => getRating(b) - getRating(a));
      const topPraise = sorted
        .filter((r) => getRating(r) >= 4)
        .slice(0, 3)
        .map((r) => ({
          rating: getRating(r),
          title: optionalString(r.title),
          excerpt: getExcerpt(r.body, 100),
          author: optionalString(r.author_name),
        }));

      const topComplaints = sorted
        .filter((r) => getRating(r) <= 2)
        .slice(-3)
        .reverse()
        .map((r) => ({
          rating: getRating(r),
          title: optionalString(r.title),
          excerpt: getExcerpt(r.body, 100),
          author: optionalString(r.author_name),
        }));

      return {
        totalReviews: filteredReviews.length,
        averageRating: Math.round(averageRating * 10) / 10,
        distribution,
        topPraise,
        topComplaints,
      };
    },
  });
}
