import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  normalizeShopifyDomain,
  verifyShopifyWebhookHmac,
} from "@/lib/integrations/shopify/security";

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toExternalId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

type ShopifyIntegrationRecord = Record<string, unknown> & {
  id: string;
  user_id: string;
};

function toShopifyIntegrationRecord(
  id: string,
  data: Record<string, unknown>
): ShopifyIntegrationRecord | null {
  return typeof data.user_id === "string" && data.user_id.trim()
    ? { id, ...data, user_id: data.user_id }
    : null;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "SHOPIFY_WEBHOOK_SECRET is not configured" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256") || "";
  const topic = request.headers.get("x-shopify-topic") || "";
  const rawShopDomain = request.headers.get("x-shopify-shop-domain");
  const shopDomain = rawShopDomain
    ? normalizeShopifyDomain(rawShopDomain)
    : null;

  // Verify webhook signature
  if (!verifyShopifyWebhookHmac(body, hmacHeader, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!shopDomain) {
    return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });
  }

  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed)) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    data = parsed;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // Resolve all integrations explicitly connected to this shop domain.
  const integrationsSnap = await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("provider", "==", "shopify")
    .where("sync_cursor.shop_domain", "==", shopDomain)
    .get();

  const integrations = integrationsSnap.docs
    .map((doc) =>
      toShopifyIntegrationRecord(doc.id, doc.data())
    )
    .filter((integration): integration is ShopifyIntegrationRecord =>
      Boolean(integration)
    );

  if (!integrations || integrations.length === 0) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  switch (topic) {
    case "orders/create":
    case "orders/updated": {
      const externalId = toExternalId(data.id);
      if (!externalId) {
        return NextResponse.json({ error: "Missing order id" }, { status: 400 });
      }

      const lineItems = Array.isArray(data.line_items) ? data.line_items : [];
      const customer = isRecord(data.customer) ? data.customer : null;
      const shippingSet = isRecord(data.total_shipping_price_set)
        ? data.total_shipping_price_set
        : null;
      const shopMoney = isRecord(shippingSet?.shop_money)
        ? shippingSet.shop_money
        : null;

      const batch = adminDb.batch();
      for (const integration of integrations) {
        const orderDocId = `${integration.user_id}_${externalId}`;
        const orderRef = adminDb.collection(COLLECTIONS.ORDERS).doc(orderDocId);
        batch.set(orderRef, {
          user_id: integration.user_id,
          integration_id: integration.id,
          external_id: externalId,
          order_number: String(data.name || ""),
          total_price: toNumber(data.total_price),
          subtotal_price: toNullableNumber(data.subtotal_price),
          total_tax: toNumber(data.total_tax),
          total_discount: toNumber(data.total_discounts),
          shipping_cost: toNumber(shopMoney?.amount, 0),
          currency: String(data.currency || "USD"),
          financial_status: toNullableString(data.financial_status),
          fulfillment_status: toNullableString(data.fulfillment_status),
          customer_email:
            customer && typeof customer.email === "string"
              ? customer.email
              : null,
          customer_name: customer
            ? `${String(customer.first_name || "")} ${String(customer.last_name || "")}`.trim() ||
              null
            : null,
          line_items: lineItems.map((item) => {
            const li = isRecord(item) ? item : {};
            return {
              title: String(li.title || ""),
              quantity: toNumber(li.quantity, 0),
              price: toNumber(li.price, 0),
              product_id: li.product_id ? String(li.product_id) : null,
              sku: li.sku ? String(li.sku) : null,
            };
          }),
          tags:
            typeof data.tags === "string"
              ? data.tags.split(", ").filter(Boolean)
              : [],
          placed_at: String(data.processed_at || data.created_at || new Date().toISOString()),
          synced_at: new Date().toISOString(),
        }, { merge: true });
      }
      await batch.commit();
      break;
    }

    case "products/create":
    case "products/update": {
      const externalId = toExternalId(data.id);
      if (!externalId) {
        return NextResponse.json({ error: "Missing product id" }, { status: 400 });
      }

      const variants = Array.isArray(data.variants) ? data.variants : [];
      const images = Array.isArray(data.images) ? data.images : [];
      const firstVariant =
        variants.length > 0 && isRecord(variants[0]) ? variants[0] : null;

      const batch = adminDb.batch();
      for (const integration of integrations) {
        const productDocId = `${integration.user_id}_${externalId}`;
        const productRef = adminDb.collection(COLLECTIONS.PRODUCTS).doc(productDocId);
        batch.set(productRef, {
          user_id: integration.user_id,
          integration_id: integration.id,
          external_id: externalId,
          title: String(data.title || "Untitled"),
          description:
            typeof data.body_html === "string" ? data.body_html : null,
          price: toNullableNumber(firstVariant?.price),
          compare_at_price: toNullableNumber(firstVariant?.compare_at_price),
          currency: "USD",
          inventory_quantity: variants.reduce((sum, rawVariant) => {
            const variant = isRecord(rawVariant) ? rawVariant : {};
            return sum + toNumber(variant.inventory_quantity, 0);
          }, 0),
          status: String(data.status || "active"),
          product_type:
            typeof data.product_type === "string" ? data.product_type : null,
          vendor: typeof data.vendor === "string" ? data.vendor : null,
          tags:
            typeof data.tags === "string"
              ? data.tags.split(", ").filter(Boolean)
              : [],
          image_url:
            images.length > 0 &&
            isRecord(images[0]) &&
            typeof images[0].src === "string"
              ? images[0].src
              : null,
          handle: String(data.handle || ""),
          variants_count: variants.length,
          metadata: {},
          synced_at: new Date().toISOString(),
        }, { merge: true });
      }
      await batch.commit();
      break;
    }

    case "products/delete": {
      const externalId = toExternalId(data.id);
      if (!externalId) {
        return NextResponse.json({ error: "Missing product id" }, { status: 400 });
      }

      const batch = adminDb.batch();
      for (const integration of integrations) {
        const productsSnap = await adminDb
          .collection(COLLECTIONS.PRODUCTS)
          .where("user_id", "==", integration.user_id)
          .where("external_id", "==", externalId)
          .get();
        
        for (const doc of productsSnap.docs) {
          batch.delete(doc.ref);
        }
      }
      await batch.commit();
      break;
    }

    case "app/uninstalled": {
      const batch = adminDb.batch();
      for (const integration of integrations) {
        const integrationRef = adminDb
          .collection(COLLECTIONS.INTEGRATIONS)
          .doc(integration.id);
        batch.update(integrationRef, { status: "revoked" });
      }
      await batch.commit();
      break;
    }
  }

  return NextResponse.json({ received: true });
}
