const SHOPIFY_API_VERSION = "2024-10";

export interface ShopifyConfig {
  shopDomain: string;
  accessToken: string;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  handle: string;
  status: "active" | "draft" | "archived";
  tags: string;
  variants: {
    id: number;
    price: string;
    compare_at_price: string | null;
    inventory_quantity: number;
  }[];
  images: { src: string }[];
  created_at: string;
  updated_at: string;
}

export interface ShopifyOrder {
  id: number;
  name: string;
  order_number: number;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;
  total_shipping_price_set: {
    shop_money: { amount: string; currency_code: string };
  };
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: {
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  line_items: {
    id: number;
    title: string;
    quantity: number;
    price: string;
    product_id: number | null;
    variant_id: number | null;
    sku: string | null;
  }[];
  tags: string;
  created_at: string;
  processed_at: string;
}

export interface ShopifyShop {
  id: number;
  name: string;
  email: string;
  domain: string;
  myshopify_domain: string;
  currency: string;
  timezone: string;
  plan_name: string;
}

async function shopifyFetch<T>(
  config: ShopifyConfig,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `https://${config.shopDomain}/admin/api/${SHOPIFY_API_VERSION}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "X-Shopify-Access-Token": config.accessToken,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function getShopInfo(config: ShopifyConfig): Promise<ShopifyShop> {
  const data = await shopifyFetch<{ shop: ShopifyShop }>(config, "/shop.json");
  return data.shop;
}

export async function getProducts(
  config: ShopifyConfig,
  params?: { limit?: number; since_id?: number; status?: string }
): Promise<ShopifyProduct[]> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.since_id) searchParams.set("since_id", String(params.since_id));
  if (params?.status) searchParams.set("status", params.status);
  searchParams.set("limit", String(params?.limit || 250));

  const qs = searchParams.toString();
  const data = await shopifyFetch<{ products: ShopifyProduct[] }>(
    config,
    `/products.json${qs ? `?${qs}` : ""}`
  );
  return data.products;
}

export async function getOrders(
  config: ShopifyConfig,
  params?: {
    limit?: number;
    since_id?: number;
    status?: string;
    created_at_min?: string;
    created_at_max?: string;
  }
): Promise<ShopifyOrder[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params?.limit || 250));
  searchParams.set("status", params?.status || "any");
  if (params?.since_id) searchParams.set("since_id", String(params.since_id));
  if (params?.created_at_min) searchParams.set("created_at_min", params.created_at_min);
  if (params?.created_at_max) searchParams.set("created_at_max", params.created_at_max);

  const qs = searchParams.toString();
  const data = await shopifyFetch<{ orders: ShopifyOrder[] }>(
    config,
    `/orders.json${qs ? `?${qs}` : ""}`
  );
  return data.orders;
}

export async function getOrdersCount(
  config: ShopifyConfig,
  params?: { status?: string; created_at_min?: string }
): Promise<number> {
  const searchParams = new URLSearchParams();
  searchParams.set("status", params?.status || "any");
  if (params?.created_at_min) searchParams.set("created_at_min", params.created_at_min);

  const qs = searchParams.toString();
  const data = await shopifyFetch<{ count: number }>(
    config,
    `/orders/count.json${qs ? `?${qs}` : ""}`
  );
  return data.count;
}
