import { SupabaseClient } from "@supabase/supabase-js";
import {
  getProducts as fetchShopifyProducts,
  getOrders as fetchShopifyOrders,
  ShopifyConfig,
  ShopifyProduct,
  ShopifyOrder,
} from "./client";

export async function syncProducts(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: ShopifyConfig
) {
  const products = await fetchShopifyProducts(config);

  const rows = products.map((p: ShopifyProduct) => ({
    user_id: userId,
    integration_id: integrationId,
    external_id: String(p.id),
    title: p.title,
    description: p.body_html,
    price: p.variants[0] ? parseFloat(p.variants[0].price) : null,
    compare_at_price: p.variants[0]?.compare_at_price
      ? parseFloat(p.variants[0].compare_at_price)
      : null,
    currency: "USD",
    inventory_quantity: p.variants.reduce((sum, v) => sum + v.inventory_quantity, 0),
    status: p.status,
    product_type: p.product_type || null,
    vendor: p.vendor || null,
    tags: p.tags ? p.tags.split(", ").filter(Boolean) : [],
    image_url: p.images[0]?.src || null,
    handle: p.handle,
    variants_count: p.variants.length,
    metadata: {},
    synced_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return { synced: 0 };

  // Upsert by external_id
  for (const row of rows) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("user_id", userId)
      .eq("external_id", row.external_id)
      .single();

    if (existing) {
      await supabase.from("products").update(row).eq("id", existing.id);
    } else {
      await supabase.from("products").insert(row);
    }
  }

  return { synced: rows.length };
}

export async function syncOrders(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: ShopifyConfig,
  sinceDate?: string
) {
  const orders = await fetchShopifyOrders(config, {
    created_at_min: sinceDate,
  });

  const rows = orders.map((o: ShopifyOrder) => ({
    user_id: userId,
    integration_id: integrationId,
    external_id: String(o.id),
    order_number: o.name,
    total_price: parseFloat(o.total_price),
    subtotal_price: parseFloat(o.subtotal_price),
    total_tax: parseFloat(o.total_tax),
    total_discount: parseFloat(o.total_discounts),
    shipping_cost: parseFloat(o.total_shipping_price_set?.shop_money?.amount || "0"),
    currency: o.currency,
    financial_status: o.financial_status || null,
    fulfillment_status: o.fulfillment_status || null,
    customer_email: o.customer?.email || null,
    customer_name: o.customer
      ? `${o.customer.first_name} ${o.customer.last_name}`.trim()
      : null,
    line_items: o.line_items.map((li) => ({
      title: li.title,
      quantity: li.quantity,
      price: parseFloat(li.price),
      product_id: li.product_id ? String(li.product_id) : null,
      sku: li.sku,
    })),
    tags: o.tags ? o.tags.split(", ").filter(Boolean) : [],
    placed_at: o.processed_at || o.created_at,
  }));

  if (rows.length === 0) return { synced: 0 };

  for (const row of rows) {
    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .eq("external_id", row.external_id)
      .single();

    if (existing) {
      await supabase.from("orders").update(row).eq("id", existing.id);
    } else {
      await supabase.from("orders").insert(row);
    }
  }

  return { synced: rows.length };
}

export async function syncMetrics(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string
) {
  // Aggregate daily revenue and order metrics from synced orders
  const { data: orders } = await supabase
    .from("orders")
    .select("total_price, placed_at, financial_status, customer_email")
    .eq("user_id", userId)
    .eq("integration_id", integrationId);

  if (!orders || orders.length === 0) return { synced: 0 };

  // Group orders by day
  const dailyMap = new Map<
    string,
    { revenue: number; count: number; customers: Set<string> }
  >();

  for (const order of orders) {
    const day = order.placed_at.split("T")[0];
    const existing = dailyMap.get(day) || {
      revenue: 0,
      count: 0,
      customers: new Set<string>(),
    };
    existing.revenue += order.total_price;
    existing.count += 1;
    if (order.customer_email) existing.customers.add(order.customer_email);
    dailyMap.set(day, existing);
  }

  let metricsSynced = 0;

  for (const [day, data] of dailyMap) {
    const periodStart = `${day}T00:00:00Z`;
    const periodEnd = `${day}T23:59:59Z`;

    const metrics = [
      { metric_type: "revenue", metric_value: data.revenue },
      { metric_type: "orders", metric_value: data.count },
      {
        metric_type: "average_order_value",
        metric_value: data.count > 0 ? data.revenue / data.count : 0,
      },
      { metric_type: "customer_count", metric_value: data.customers.size },
    ];

    for (const metric of metrics) {
      // Upsert: delete existing then insert
      await supabase
        .from("business_metrics")
        .delete()
        .eq("user_id", userId)
        .eq("integration_id", integrationId)
        .eq("metric_type", metric.metric_type)
        .eq("period_start", periodStart)
        .eq("granularity", "daily");

      await supabase.from("business_metrics").insert({
        user_id: userId,
        integration_id: integrationId,
        metric_type: metric.metric_type,
        metric_value: metric.metric_value,
        dimensions: {},
        period_start: periodStart,
        period_end: periodEnd,
        granularity: "daily",
      });
      metricsSynced++;
    }
  }

  return { synced: metricsSynced };
}

export async function runFullSync(
  supabase: SupabaseClient,
  userId: string,
  integrationId: string,
  config: ShopifyConfig
) {
  const products = await syncProducts(supabase, userId, integrationId, config);
  const orders = await syncOrders(supabase, userId, integrationId, config);
  const metrics = await syncMetrics(supabase, userId, integrationId);

  // Update last_synced_at
  await supabase
    .from("integrations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", integrationId);

  return {
    products: products.synced,
    orders: orders.synced,
    metrics: metrics.synced,
  };
}
