import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac } from "crypto";

function verifyWebhook(body: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return false;

  const hash = createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");

  return hash === hmacHeader;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256") || "";
  const topic = request.headers.get("x-shopify-topic") || "";
  const shopDomain = request.headers.get("x-shopify-shop-domain") || "";

  // Verify webhook signature
  if (process.env.SHOPIFY_WEBHOOK_SECRET && !verifyWebhook(body, hmacHeader)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const data = JSON.parse(body);

  // Find integration by shop domain
  const { data: integration } = await supabase
    .from("integrations")
    .select("id, user_id")
    .eq("provider", "shopify")
    .ilike("provider_account_name", `%${shopDomain}%`)
    .single();

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  const { user_id: userId, id: integrationId } = integration;

  switch (topic) {
    case "orders/create":
    case "orders/updated": {
      await supabase.from("orders").upsert(
        {
          user_id: userId,
          integration_id: integrationId,
          external_id: String(data.id),
          order_number: data.name,
          total_price: parseFloat(data.total_price),
          subtotal_price: parseFloat(data.subtotal_price),
          total_tax: parseFloat(data.total_tax),
          total_discount: parseFloat(data.total_discounts),
          shipping_cost: parseFloat(
            data.total_shipping_price_set?.shop_money?.amount || "0"
          ),
          currency: data.currency,
          financial_status: data.financial_status,
          fulfillment_status: data.fulfillment_status,
          customer_email: data.customer?.email || null,
          customer_name: data.customer
            ? `${data.customer.first_name} ${data.customer.last_name}`.trim()
            : null,
          line_items: (data.line_items || []).map(
            (li: { title: string; quantity: number; price: string; product_id: number | null; sku: string | null }) => ({
              title: li.title,
              quantity: li.quantity,
              price: parseFloat(li.price),
              product_id: li.product_id ? String(li.product_id) : null,
              sku: li.sku,
            })
          ),
          tags: data.tags ? data.tags.split(", ").filter(Boolean) : [],
          placed_at: data.processed_at || data.created_at,
        },
        { onConflict: "user_id,external_id" }
      );
      break;
    }

    case "products/create":
    case "products/update": {
      const variant = data.variants?.[0];
      await supabase.from("products").upsert(
        {
          user_id: userId,
          integration_id: integrationId,
          external_id: String(data.id),
          title: data.title,
          description: data.body_html,
          price: variant ? parseFloat(variant.price) : null,
          compare_at_price: variant?.compare_at_price
            ? parseFloat(variant.compare_at_price)
            : null,
          currency: "USD",
          inventory_quantity: (data.variants || []).reduce(
            (sum: number, v: { inventory_quantity: number }) =>
              sum + v.inventory_quantity,
            0
          ),
          status: data.status,
          product_type: data.product_type || null,
          vendor: data.vendor || null,
          tags: data.tags ? data.tags.split(", ").filter(Boolean) : [],
          image_url: data.images?.[0]?.src || null,
          handle: data.handle,
          variants_count: data.variants?.length || 0,
          metadata: {},
          synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,external_id" }
      );
      break;
    }

    case "products/delete": {
      await supabase
        .from("products")
        .delete()
        .eq("user_id", userId)
        .eq("external_id", String(data.id));
      break;
    }

    case "app/uninstalled": {
      await supabase
        .from("integrations")
        .update({ status: "revoked" })
        .eq("id", integrationId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
