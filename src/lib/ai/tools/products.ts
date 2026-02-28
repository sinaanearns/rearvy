import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

export function getTopProducts(ctx: ToolContext) {
  return tool({
    description:
      "Get top-performing products by revenue or units sold for a period",
    inputSchema: z.object({
      periodStart: z.string().describe("ISO date"),
      periodEnd: z.string().describe("ISO date"),
      limit: z.number().optional().default(5),
      sortBy: z
        .enum(["revenue", "units_sold"])
        .optional()
        .default("revenue"),
    }),
    execute: async ({ periodStart, periodEnd, limit }) => {
      const snapshot = await ctx.adminDb
        .collection(COLLECTIONS.ORDERS)
        .where("user_id", "==", ctx.userId)
        .where("placed_at", ">=", periodStart)
        .where("placed_at", "<=", periodEnd)
        .get();
      const orders = snapshot.docs.map((doc) => doc.data() as any);

      if (!orders || orders.length === 0) {
        return {
          products: [],
          message:
            "No sales data found. Connect your Shopify store to see product performance.",
        };
      }

      const productStats: Record<
        string,
        { title: string; revenue: number; unitsSold: number }
      > = {};
      let totalRevenue = 0;

      for (const order of orders) {
        const items = order.line_items as Array<{
          title: string;
          price: number;
          quantity: number;
        }>;
        if (Array.isArray(items)) {
          for (const item of items) {
            const rev = (item.price || 0) * (item.quantity || 1);
            if (!productStats[item.title]) {
              productStats[item.title] = {
                title: item.title,
                revenue: 0,
                unitsSold: 0,
              };
            }
            productStats[item.title].revenue += rev;
            productStats[item.title].unitsSold += item.quantity || 1;
            totalRevenue += rev;
          }
        }
      }

      const products = Object.values(productStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit)
        .map((p) => ({
          ...p,
          percentOfTotal:
            totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0,
        }));

      return { products };
    },
  });
}

export function getProductDetails(ctx: ToolContext) {
  return tool({
    description: "Get details about a specific product by title",
    inputSchema: z.object({
      productTitle: z
        .string()
        .describe("Product title or partial match to search for"),
    }),
    execute: async ({ productTitle }) => {
      const snapshot = await ctx.adminDb
        .collection(COLLECTIONS.PRODUCTS)
        .where("user_id", "==", ctx.userId)
        .where("title", ">=", productTitle)
        .where("title", "<", productTitle + "\uf8ff")
        .limit(1)
        .get();
      const data = snapshot.docs[0]?.data() as any;

      if (!data) {
        return { message: `Product matching "${productTitle}" not found.` };
      }

      return {
        title: data.title,
        price: Number(data.price),
        compareAtPrice: data.compare_at_price
          ? Number(data.compare_at_price)
          : null,
        inventoryQuantity: data.inventory_quantity,
        status: data.status,
        productType: data.product_type,
        vendor: data.vendor,
        tags: data.tags,
        imageUrl: data.image_url,
      };
    },
  });
}

export function getInventoryStatus(ctx: ToolContext) {
  return tool({
    description:
      "Check inventory levels across all products, highlighting low and out of stock items",
    inputSchema: z.object({
      threshold: z
        .number()
        .optional()
        .default(10)
        .describe("Low stock threshold"),
      status: z
        .enum(["all", "low_stock", "out_of_stock", "in_stock"])
        .optional()
        .default("all"),
    }),
    execute: async ({ threshold, status }) => {
      const snapshot = await ctx.adminDb
        .collection(COLLECTIONS.PRODUCTS)
        .where("user_id", "==", ctx.userId)
        .where("status", "==", "active")
        .orderBy("inventory_quantity", "asc")
        .get();
      const data = snapshot.docs.map((doc) => doc.data() as any);

      if (!data || data.length === 0) {
        return {
          products: [],
          lowStockCount: 0,
          outOfStockCount: 0,
          message:
            "No products found. Connect your Shopify store to track inventory.",
        };
      }

      const products = data.map((p) => {
        const qty = p.inventory_quantity ?? 0;
        let stockStatus: "out_of_stock" | "low_stock" | "in_stock";
        if (qty <= 0) stockStatus = "out_of_stock";
        else if (qty <= threshold) stockStatus = "low_stock";
        else stockStatus = "in_stock";

        return {
          title: p.title,
          quantity: qty,
          status: stockStatus,
          price: Number(p.price),
          imageUrl: p.image_url,
        };
      });

      const filtered =
        status === "all"
          ? products
          : products.filter((p) => p.status === status);

      return {
        products: filtered,
        lowStockCount: products.filter((p) => p.status === "low_stock").length,
        outOfStockCount: products.filter(
          (p) => p.status === "out_of_stock"
        ).length,
      };
    },
  });
}
