import { Firestore } from "firebase-admin/firestore";
import {
  getProducts as fetchShopifyProducts,
  getOrders as fetchShopifyOrders,
  ShopifyConfig,
  ShopifyProduct,
  ShopifyOrder,
} from "./client";
import { generateShopifyInsights } from "@/lib/insights/generate";
import { COLLECTIONS } from "@/lib/firebase/schema";

const UPSERT_CHUNK_SIZE = 500;

async function upsertInChunks(
  adminDb: Firestore,
  collectionName: string,
  rows: (Record<string, unknown> & { external_id: string })[],
  userId: string
) {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const batch = adminDb.batch();
    const collectionRef = adminDb.collection(collectionName);

    for (const row of chunk) {
      const query = await collectionRef
        .where("user_id", "==", userId)
        .where("external_id", "==", row.external_id)
        .limit(1)
        .get();

      if (!query.empty) {
        // Update existing document
        batch.update(query.docs[0].ref, { ...row, updated_at: new Date() });
      } else {
        // Add new document with auto-generated ID
        const newDocRef = collectionRef.doc();
        batch.set(newDocRef, {
          ...row,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }

    await batch.commit();
  }
}

export async function syncProducts(
  adminDb: Firestore,
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
    synced_at: new Date(),
  }));

  if (rows.length === 0) return { synced: 0 };

  await upsertInChunks(adminDb, COLLECTIONS.PRODUCTS, rows, userId);

  return { synced: rows.length };
}

export async function syncOrders(
  adminDb: Firestore,
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

  await upsertInChunks(adminDb, COLLECTIONS.ORDERS, rows, userId);

  return { synced: rows.length };
}

export async function syncMetrics(
  adminDb: Firestore,
  userId: string,
  integrationId: string
) {
  // Aggregate daily revenue and order metrics from synced orders
  const ordersSnapshot = await adminDb
    .collection(COLLECTIONS.ORDERS)
    .where("user_id", "==", userId)
    .where("integration_id", "==", integrationId)
    .select("total_price", "placed_at", "financial_status", "customer_email")
    .get();

  const orders = ordersSnapshot.docs.map((doc) => doc.data());

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
  const metricsRef = adminDb.collection(COLLECTIONS.BUSINESS_METRICS);
  const batch = adminDb.batch();

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
      // Check if metric already exists and delete it
      const existingMetricsQuery = await metricsRef
        .where("user_id", "==", userId)
        .where("integration_id", "==", integrationId)
        .where("metric_type", "==", metric.metric_type)
        .where("period_start", "==", periodStart)
        .where("granularity", "==", "daily")
        .get();

      existingMetricsQuery.docs.forEach((doc) => batch.delete(doc.ref));

      // Add new metric
      const newMetricRef = metricsRef.doc();
      batch.set(newMetricRef, {
        user_id: userId,
        integration_id: integrationId,
        metric_type: metric.metric_type,
        metric_value: metric.metric_value,
        dimensions: {},
        period_start: periodStart,
        period_end: periodEnd,
        granularity: "daily",
        created_at: new Date(),
        updated_at: new Date(),
      });
      metricsSynced++;
    }
  }

  await batch.commit();
  return { synced: metricsSynced };
}

export async function runFullSync(
  adminDb: Firestore,
  userId: string,
  integrationId: string,
  config: ShopifyConfig
) {
  const integrationSnapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .get();

  const integration = integrationSnapshot.data();
  let sinceDate: string | undefined;
  if (integration?.last_synced_at) {
    const syncDate = integration.last_synced_at;
    // Handle both Firestore Timestamp and Date objects
    if (syncDate instanceof Date) {
      sinceDate = syncDate.toISOString();
    } else if (syncDate.toDate) {
      // Firestore Timestamp
      sinceDate = syncDate.toDate().toISOString();
    }
  }

  const products = await syncProducts(adminDb, userId, integrationId, config);
  const orders = await syncOrders(
    adminDb,
    userId,
    integrationId,
    config,
    sinceDate
  );
  const metrics = await syncMetrics(adminDb, userId, integrationId);

  // Update last_synced_at
  await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .update({ last_synced_at: new Date() });

  let insightsGenerated = 0;
  try {
    const insightResult = await generateShopifyInsights(
      adminDb,
      userId,
      integrationId
    );
    insightsGenerated = insightResult.created;
  } catch (error) {
    console.error("Shopify insight generation failed:", error);
  }

  return {
    products: products.synced,
    orders: orders.synced,
    metrics: metrics.synced,
    insights: insightsGenerated,
  };
}
