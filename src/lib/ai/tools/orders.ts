import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

export function getOrders(ctx: ToolContext) {
  return tool({
    description: "Get orders for a time period with optional status filter",
    inputSchema: z.object({
      periodStart: z.string().describe("ISO date"),
      periodEnd: z.string().describe("ISO date"),
      status: z
        .enum(["all", "pending", "paid", "fulfilled", "refunded"])
        .optional()
        .default("all"),
      limit: z.number().optional().default(20),
    }),
    execute: async ({ periodStart, periodEnd, status, limit }) => {
      let query = ctx.supabase
        .from("orders")
        .select("*")
        .eq("user_id", ctx.userId)
        .gte("placed_at", periodStart)
        .lte("placed_at", periodEnd)
        .order("placed_at", { ascending: false })
        .limit(limit);

      if (status !== "all") {
        query = query.eq("financial_status", status);
      }

      const { data } = await query;

      if (!data || data.length === 0) {
        return {
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          orders: [],
          message:
            "No orders found for this period. Connect your Shopify store to sync orders.",
        };
      }

      const totalRevenue = data.reduce(
        (sum, o) => sum + Number(o.total_price),
        0
      );

      const refundedOrders = data.filter(
        (o) =>
          o.financial_status === "refunded" ||
          o.financial_status === "partially_refunded"
      );

      return {
        totalOrders: data.length,
        totalRevenue,
        averageOrderValue: data.length > 0 ? totalRevenue / data.length : 0,
        refundedOrderCount: refundedOrders.length,
        refundRate:
          data.length > 0
            ? (refundedOrders.length / data.length) * 100
            : 0,
        orders: data.map((o) => ({
          orderNumber: o.order_number,
          totalPrice: Number(o.total_price),
          financialStatus: o.financial_status,
          fulfillmentStatus: o.fulfillment_status,
          customerName: o.customer_name,
          placedAt: o.placed_at,
        })),
      };
    },
  });
}

export function getOrderDetails(ctx: ToolContext) {
  return tool({
    description: "Look up a specific order by order number",
    inputSchema: z.object({
      orderNumber: z.string().describe("The order number to look up"),
    }),
    execute: async ({ orderNumber }) => {
      const { data } = await ctx.supabase
        .from("orders")
        .select("*")
        .eq("user_id", ctx.userId)
        .eq("order_number", orderNumber)
        .single();

      if (!data) {
        return { message: `Order ${orderNumber} not found.` };
      }

      return {
        orderNumber: data.order_number,
        totalPrice: Number(data.total_price),
        subtotalPrice: Number(data.subtotal_price),
        totalTax: Number(data.total_tax),
        totalDiscount: Number(data.total_discount),
        shippingCost: Number(data.shipping_cost),
        financialStatus: data.financial_status,
        fulfillmentStatus: data.fulfillment_status,
        customerName: data.customer_name,
        customerEmail: data.customer_email,
        lineItems: data.line_items,
        placedAt: data.placed_at,
      };
    },
  });
}
