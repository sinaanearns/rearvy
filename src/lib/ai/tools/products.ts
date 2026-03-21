import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

function normalizeProductKey(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

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
      const orders = snapshot.docs.map((doc) => doc.data() as Record<string, unknown>);

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
      const data = snapshot.docs[0]?.data() as Record<string, unknown> | undefined;

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
      "Check inventory risk across products, prioritizing low-stock items that matter most based on recent revenue and sales velocity",
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
      const ordersSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [productsSnapshot, ordersSnapshot] = await Promise.all([
        ctx.adminDb
          .collection(COLLECTIONS.PRODUCTS)
          .where("user_id", "==", ctx.userId)
          .where("status", "==", "active")
          .orderBy("inventory_quantity", "asc")
          .get(),
        ctx.adminDb
          .collection(COLLECTIONS.ORDERS)
          .where("user_id", "==", ctx.userId)
          .where("placed_at", ">=", ordersSince)
          .get(),
      ]);
      const data = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<Record<string, unknown>>;

      if (!data || data.length === 0) {
        return {
          products: [],
          lowStockCount: 0,
          outOfStockCount: 0,
          message:
            "No products found. Connect your Shopify store to track inventory.",
        };
      }

      const revenueByProductId = new Map<string, { revenue: number; units: number }>();
      const revenueByTitle = new Map<string, { revenue: number; units: number }>();

      for (const orderDoc of ordersSnapshot.docs) {
        const orderData = orderDoc.data() as Record<string, unknown>;
        const lineItems = Array.isArray(orderData.line_items)
          ? (orderData.line_items as Array<Record<string, unknown>>)
          : [];

        for (const item of lineItems) {
          const quantity = Number(item.quantity ?? 0);
          const price = Number(item.price ?? 0);
          const revenue = Math.max(quantity, 0) * Math.max(price, 0);
          const productIdKey =
            item.product_id !== undefined && item.product_id !== null
              ? String(item.product_id)
              : null;
          const titleKey = normalizeProductKey(item.title);

          if (productIdKey) {
            const existing = revenueByProductId.get(productIdKey) || {
              revenue: 0,
              units: 0,
            };
            existing.revenue += revenue;
            existing.units += Math.max(quantity, 0);
            revenueByProductId.set(productIdKey, existing);
          }

          if (titleKey) {
            const existing = revenueByTitle.get(titleKey) || {
              revenue: 0,
              units: 0,
            };
            existing.revenue += revenue;
            existing.units += Math.max(quantity, 0);
            revenueByTitle.set(titleKey, existing);
          }
        }
      }

      const products = data.map((p) => {
        const qty = Number(p.inventory_quantity ?? 0);
        let stockStatus: "out_of_stock" | "low_stock" | "in_stock";
        if (qty <= 0) stockStatus = "out_of_stock";
        else if (qty <= threshold) stockStatus = "low_stock";
        else stockStatus = "in_stock";
        const externalId =
          p.external_id !== undefined && p.external_id !== null
            ? String(p.external_id)
            : null;
        const titleKey = normalizeProductKey(p.title);
        const matchedRevenue =
          (externalId ? revenueByProductId.get(externalId) : null) ||
          (titleKey ? revenueByTitle.get(titleKey) : null) || {
            revenue: 0,
            units: 0,
          };
        const statusWeight =
          stockStatus === "out_of_stock"
            ? 2
            : stockStatus === "low_stock"
              ? 1
              : 0;
        const priorityScore =
          statusWeight * 100000 +
          matchedRevenue.revenue * 10 +
          matchedRevenue.units * 25 -
          qty;

        return {
          title: String(p.title || "Untitled product"),
          quantity: qty,
          status: stockStatus,
          price: Number(p.price ?? 0),
          imageUrl: p.image_url,
          recentRevenue30d: Number(matchedRevenue.revenue.toFixed(2)),
          unitsSold30d: matchedRevenue.units,
          priorityScore,
        };
      });

      const lowStockCount = products.filter((p) => p.status === "low_stock").length;
      const outOfStockCount = products.filter((p) => p.status === "out_of_stock").length;
      const inStockCount = products.filter((p) => p.status === "in_stock").length;

      let filtered =
        status === "all"
          ? products.filter((p) => p.status !== "in_stock")
          : products.filter((p) => p.status === status);

      let message: string | undefined;
      if (status === "all" && filtered.length === 0) {
        filtered = products
          .filter((p) => p.recentRevenue30d > 0)
          .sort((left, right) => right.priorityScore - left.priorityScore)
          .slice(0, 8);
        message =
          "No urgent stock risks found. Showing the highest-revenue products to keep an eye on.";
      }

      const prioritized = filtered
        .sort((left, right) => right.priorityScore - left.priorityScore)
        .slice(0, 10);

      return {
        products: prioritized,
        lowStockCount,
        outOfStockCount,
        inStockCount,
        prioritization:
          "Products are ranked by stock risk first, then recent 30-day revenue and unit velocity.",
        message,
      };
    },
  });
}
