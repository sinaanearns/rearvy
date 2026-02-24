import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    data = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Resolve all integrations explicitly connected to this shop domain.
  const { data: integrations, error: integrationError } = await supabase
    .from("integrations")
    .select("id, user_id")
    .eq("provider", "shopify")
    .eq("sync_cursor->>shop_domain", shopDomain);

  if (integrationError) {
    console.error("Shopify webhook integration lookup failed:", integrationError);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  if (!integrations || integrations.length === 0) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  switch (topic) {
    case "orders/create":
    case "orders/updated": {
      const lineItems = Array.isArray(data.line_items) ? data.line_items : [];
      const customer =
        data.customer && typeof data.customer === "object"
          ? (data.customer as Record<string, unknown>)
          : null;
      const shippingSet =
        data.total_shipping_price_set &&
        typeof data.total_shipping_price_set === "object"
          ? (data.total_shipping_price_set as {
              shop_money?: { amount?: unknown };
            })
          : null;

      for (const integration of integrations) {
        await supabase.from("orders").upsert(
          {
            user_id: integration.user_id,
            integration_id: integration.id,
            external_id: String(data.id),
            order_number: String(data.name || ""),
            total_price: toNumber(data.total_price),
            subtotal_price: toNullableNumber(data.subtotal_price),
            total_tax: toNumber(data.total_tax),
            total_discount: toNumber(data.total_discounts),
            shipping_cost: toNumber(shippingSet?.shop_money?.amount, 0),
            currency: String(data.currency || "USD"),
            financial_status: (data.financial_status as string) || null,
            fulfillment_status: (data.fulfillment_status as string) || null,
            customer_email:
              customer && typeof customer.email === "string"
                ? customer.email
                : null,
            customer_name: customer
              ? `${String(customer.first_name || "")} ${String(customer.last_name || "")}`.trim() ||
                null
              : null,
            line_items: lineItems.map((item) => {
              const li = item as Record<string, unknown>;
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
          },
          { onConflict: "user_id,external_id" }
        );
      }
      break;
    }

    case "products/create":
    case "products/update": {
      const variants = Array.isArray(data.variants) ? data.variants : [];
      const images = Array.isArray(data.images) ? data.images : [];
      const firstVariant =
        variants.length > 0
          ? (variants[0] as Record<string, unknown>)
          : null;

      for (const integration of integrations) {
        await supabase.from("products").upsert(
          {
            user_id: integration.user_id,
            integration_id: integration.id,
            external_id: String(data.id),
            title: String(data.title || "Untitled"),
            description:
              typeof data.body_html === "string" ? data.body_html : null,
            price: toNullableNumber(firstVariant?.price),
            compare_at_price: toNullableNumber(firstVariant?.compare_at_price),
            currency: "USD",
            inventory_quantity: variants.reduce((sum, rawVariant) => {
              const variant = rawVariant as Record<string, unknown>;
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
              typeof (images[0] as { src?: unknown }).src === "string"
                ? String((images[0] as { src?: unknown }).src)
                : null,
            handle: String(data.handle || ""),
            variants_count: variants.length,
            metadata: {},
            synced_at: new Date().toISOString(),
          },
          { onConflict: "user_id,external_id" }
        );
      }
      break;
    }

    case "products/delete": {
      for (const integration of integrations) {
        await supabase
          .from("products")
          .delete()
          .eq("user_id", integration.user_id)
          .eq("external_id", String(data.id));
      }
      break;
    }

    case "app/uninstalled": {
      const integrationIds = integrations.map((integration) => integration.id);
      await supabase
        .from("integrations")
        .update({ status: "revoked" })
        .in("id", integrationIds);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
