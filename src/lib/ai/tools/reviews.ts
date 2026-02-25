import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

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
      let query = ctx.supabase
        .from("product_reviews")
        .select(
          "id, product_id, rating, title, body, author_name, verified_purchase, sentiment, created_at_source"
        )
        .eq("user_id", ctx.userId);

      if (rating) {
        query = query.eq("rating", rating);
      }

      if (sortBy === "rating") {
        query = query.order("rating", { ascending: false });
      } else {
        query = query.order("created_at_source", { ascending: false });
      }

      query = query.limit(limit);
      const { data: reviews } = await query;

      if (!reviews || reviews.length === 0) {
        return {
          reviews: [],
          message: "No product reviews found. Reviews may not be synced yet.",
        };
      }

      // Get product titles for the reviews
      const productIds = [
        ...new Set(reviews.map((r) => r.product_id).filter(Boolean)),
      ];

      let productMap = new Map<string, string>();
      if (productIds.length > 0) {
        const { data: products } = await ctx.supabase
          .from("products")
          .select("id, title")
          .eq("user_id", ctx.userId)
          .in("id", productIds);

        productMap = new Map(
          (products || []).map((p) => [p.id, p.title])
        );
      }

      // Filter by product title if provided (post-query since it's a join)
      let filteredReviews = reviews;
      if (productTitle) {
        const lowerSearch = productTitle.toLowerCase();
        filteredReviews = reviews.filter((r) => {
          const title = productMap.get(r.product_id || "") || "";
          return title.toLowerCase().includes(lowerSearch);
        });
      }

      return {
        reviews: filteredReviews.map((r) => ({
          productTitle: productMap.get(r.product_id || "") || "Unknown Product",
          rating: r.rating,
          title: r.title,
          body: r.body?.substring(0, 300),
          authorName: r.author_name,
          verifiedPurchase: r.verified_purchase,
          sentiment: r.sentiment,
          date: r.created_at_source,
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
      let query = ctx.supabase
        .from("product_reviews")
        .select("rating, title, body, author_name, product_id, created_at_source")
        .eq("user_id", ctx.userId);

      if (periodStart) {
        query = query.gte("created_at_source", periodStart);
      }
      if (periodEnd) {
        query = query.lte("created_at_source", periodEnd);
      }

      const { data: reviews } = await query;

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
        const { data: products } = await ctx.supabase
          .from("products")
          .select("id, title")
          .eq("user_id", ctx.userId)
          .ilike("title", `%${productTitle}%`);

        if (products) {
          for (const p of products) productIds.push(p.id);
        }

        filteredReviews = reviews.filter(
          (r) => r.product_id && productIds.includes(r.product_id)
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
        totalRating += r.rating;
        const key = `${r.rating}star` as keyof typeof distribution;
        distribution[key]++;
      }

      const averageRating = totalRating / filteredReviews.length;

      // Get top praise (highest rated) and complaints (lowest rated)
      const sorted = [...filteredReviews].sort((a, b) => b.rating - a.rating);
      const topPraise = sorted
        .filter((r) => r.rating >= 4)
        .slice(0, 3)
        .map((r) => ({
          rating: r.rating,
          title: r.title,
          excerpt: r.body?.substring(0, 100),
          author: r.author_name,
        }));

      const topComplaints = sorted
        .filter((r) => r.rating <= 2)
        .slice(-3)
        .reverse()
        .map((r) => ({
          rating: r.rating,
          title: r.title,
          excerpt: r.body?.substring(0, 100),
          author: r.author_name,
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
