import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRequiredTables } from "@/lib/integrations/schema-health";
import { getUserFromRequest } from "@/lib/supabase/server";
import { encrypt } from "@/lib/utils/encryption";

const DAY_MS = 24 * 60 * 60 * 1000;

const REQUIRED_TABLES = [
  "integrations",
  "products",
  "orders",
  "business_metrics",
  "youtube_channels",
  "youtube_videos",
  "youtube_comments",
  "youtube_analytics",
] as const;

type DemoOrderTemplate = {
  number: number;
  daysAgo: number;
  total: number;
  subtotal: number;
  tax: number;
  shipping: number;
  customerEmail: string;
  customerName: string;
  lineItems: Array<{
    title: string;
    quantity: number;
    price: number;
    product_id: string;
    sku: string;
  }>;
};

function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function buildDemoOrders(userId: string, integrationId: string, now: Date) {
  const templates: DemoOrderTemplate[] = [
    {
      number: 1001,
      daysAgo: 0,
      total: 207,
      subtotal: 189,
      tax: 14,
      shipping: 4,
      customerEmail: "ava.johnson@example.com",
      customerName: "Ava Johnson",
      lineItems: [
        {
          title: "Rearvy Performance Hoodie",
          quantity: 2,
          price: 79,
          product_id: "demo-prod-hoodie",
          sku: "RV-HOODIE-M",
        },
        {
          title: "Analytics Sticker Pack",
          quantity: 1,
          price: 12,
          product_id: "demo-prod-stickers",
          sku: "RV-STICKERS-01",
        },
      ],
    },
    {
      number: 1002,
      daysAgo: 1,
      total: 96,
      subtotal: 83,
      tax: 7,
      shipping: 6,
      customerEmail: "liam.chen@example.com",
      customerName: "Liam Chen",
      lineItems: [
        {
          title: "Growth Planning Playbook",
          quantity: 1,
          price: 49,
          product_id: "demo-prod-playbook",
          sku: "RV-PLAYBOOK-01",
        },
        {
          title: "Conversion Sprint Notebook",
          quantity: 1,
          price: 29,
          product_id: "demo-prod-notebook",
          sku: "RV-NOTEBOOK-01",
        },
      ],
    },
    {
      number: 1003,
      daysAgo: 3,
      total: 48,
      subtotal: 42,
      tax: 4,
      shipping: 2,
      customerEmail: "sofia.martin@example.com",
      customerName: "Sofia Martin",
      lineItems: [
        {
          title: "Customer Insights Tee",
          quantity: 1,
          price: 34,
          product_id: "demo-prod-tee",
          sku: "RV-TEE-M",
        },
        {
          title: "Analytics Sticker Pack",
          quantity: 1,
          price: 12,
          product_id: "demo-prod-stickers",
          sku: "RV-STICKERS-01",
        },
      ],
    },
    {
      number: 1004,
      daysAgo: 5,
      total: 168,
      subtotal: 149,
      tax: 11,
      shipping: 8,
      customerEmail: "ethan.reed@example.com",
      customerName: "Ethan Reed",
      lineItems: [
        {
          title: "Rearvy Performance Hoodie",
          quantity: 1,
          price: 79,
          product_id: "demo-prod-hoodie",
          sku: "RV-HOODIE-L",
        },
        {
          title: "Customer Insights Tee",
          quantity: 2,
          price: 34,
          product_id: "demo-prod-tee",
          sku: "RV-TEE-L",
        },
      ],
    },
    {
      number: 1005,
      daysAgo: 6,
      total: 129,
      subtotal: 116,
      tax: 9,
      shipping: 4,
      customerEmail: "mia.wright@example.com",
      customerName: "Mia Wright",
      lineItems: [
        {
          title: "Growth Planning Playbook",
          quantity: 2,
          price: 49,
          product_id: "demo-prod-playbook",
          sku: "RV-PLAYBOOK-01",
        },
        {
          title: "Analytics Sticker Pack",
          quantity: 1,
          price: 12,
          product_id: "demo-prod-stickers",
          sku: "RV-STICKERS-01",
        },
      ],
    },
    {
      number: 1006,
      daysAgo: 8,
      total: 53,
      subtotal: 46,
      tax: 4,
      shipping: 3,
      customerEmail: "olivia.hall@example.com",
      customerName: "Olivia Hall",
      lineItems: [
        {
          title: "Customer Insights Tee",
          quantity: 1,
          price: 34,
          product_id: "demo-prod-tee",
          sku: "RV-TEE-S",
        },
        {
          title: "Analytics Sticker Pack",
          quantity: 1,
          price: 12,
          product_id: "demo-prod-stickers",
          sku: "RV-STICKERS-01",
        },
      ],
    },
    {
      number: 1007,
      daysAgo: 10,
      total: 218,
      subtotal: 199,
      tax: 15,
      shipping: 4,
      customerEmail: "jack.turner@example.com",
      customerName: "Jack Turner",
      lineItems: [
        {
          title: "Rearvy Performance Hoodie",
          quantity: 2,
          price: 79,
          product_id: "demo-prod-hoodie",
          sku: "RV-HOODIE-XL",
        },
        {
          title: "Growth Planning Playbook",
          quantity: 1,
          price: 49,
          product_id: "demo-prod-playbook",
          sku: "RV-PLAYBOOK-01",
        },
      ],
    },
    {
      number: 1008,
      daysAgo: 13,
      total: 104,
      subtotal: 95,
      tax: 7,
      shipping: 2,
      customerEmail: "lucas.bennett@example.com",
      customerName: "Lucas Bennett",
      lineItems: [
        {
          title: "Growth Planning Playbook",
          quantity: 1,
          price: 49,
          product_id: "demo-prod-playbook",
          sku: "RV-PLAYBOOK-01",
        },
        {
          title: "Customer Insights Tee",
          quantity: 1,
          price: 34,
          product_id: "demo-prod-tee",
          sku: "RV-TEE-M",
        },
        {
          title: "Analytics Sticker Pack",
          quantity: 1,
          price: 12,
          product_id: "demo-prod-stickers",
          sku: "RV-STICKERS-01",
        },
      ],
    },
  ];

  return templates.map((template) => {
    const placedAt = new Date(now.getTime() - template.daysAgo * DAY_MS);
    placedAt.setUTCHours(16, 0, 0, 0);

    return {
      user_id: userId,
      integration_id: integrationId,
      external_id: `demo-order-${template.number}`,
      order_number: `#${template.number}`,
      total_price: template.total,
      subtotal_price: template.subtotal,
      total_tax: template.tax,
      total_discount: 0,
      shipping_cost: template.shipping,
      currency: "USD",
      financial_status: "paid",
      fulfillment_status: "fulfilled",
      customer_email: template.customerEmail,
      customer_name: template.customerName,
      line_items: template.lineItems,
      tags: ["demo"],
      placed_at: placedAt.toISOString(),
    };
  });
}

function buildBusinessMetrics(
  userId: string,
  integrationId: string,
  now: Date,
  orders: Array<{
    total_price: number;
    placed_at: string;
    customer_email: string | null;
  }>
) {
  const byDay = new Map<string, { revenue: number; count: number; customers: Set<string> }>();
  for (const order of orders) {
    const day = order.placed_at.split("T")[0];
    const existing = byDay.get(day) || {
      revenue: 0,
      count: 0,
      customers: new Set<string>(),
    };
    existing.revenue += Number(order.total_price);
    existing.count += 1;
    if (order.customer_email) existing.customers.add(order.customer_email);
    byDay.set(day, existing);
  }

  const metrics: Array<{
    user_id: string;
    integration_id: string;
    metric_type: "revenue" | "orders" | "average_order_value" | "customer_count";
    metric_value: number;
    dimensions: Record<string, never>;
    period_start: string;
    period_end: string;
    granularity: "daily";
  }> = [];

  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime() - offset * DAY_MS);
    const day = toIsoDate(date);
    const snapshot = byDay.get(day) || {
      revenue: 0,
      count: 0,
      customers: new Set<string>(),
    };
    const start = `${day}T00:00:00.000Z`;
    const end = `${day}T23:59:59.999Z`;
    const aov = snapshot.count > 0 ? snapshot.revenue / snapshot.count : 0;

    metrics.push({
      user_id: userId,
      integration_id: integrationId,
      metric_type: "revenue",
      metric_value: snapshot.revenue,
      dimensions: {},
      period_start: start,
      period_end: end,
      granularity: "daily",
    });
    metrics.push({
      user_id: userId,
      integration_id: integrationId,
      metric_type: "orders",
      metric_value: snapshot.count,
      dimensions: {},
      period_start: start,
      period_end: end,
      granularity: "daily",
    });
    metrics.push({
      user_id: userId,
      integration_id: integrationId,
      metric_type: "average_order_value",
      metric_value: aov,
      dimensions: {},
      period_start: start,
      period_end: end,
      granularity: "daily",
    });
    metrics.push({
      user_id: userId,
      integration_id: integrationId,
      metric_type: "customer_count",
      metric_value: snapshot.customers.size,
      dimensions: {},
      period_start: start,
      period_end: end,
      granularity: "daily",
    });
  }

  return metrics;
}

function buildYoutubeAnalytics(
  userId: string,
  integrationId: string,
  channelId: string,
  now: Date,
  syncedAt: string
) {
  return Array.from({ length: 21 }, (_, index) => {
    const daysAgo = 20 - index;
    const date = new Date(now.getTime() - daysAgo * DAY_MS);
    const weekendBoost = date.getUTCDay() === 0 || date.getUTCDay() === 6 ? 180 : 0;
    const views = 900 + index * 35 + weekendBoost;

    return {
      user_id: userId,
      integration_id: integrationId,
      channel_id: channelId,
      metric_date: toIsoDate(date),
      views,
      estimated_minutes_watched: Math.round(views * 2.7),
      subscribers_gained: Math.max(1, Math.round(views / 100)),
      subscribers_lost: Math.max(0, Math.round(views / 420)),
      likes: Math.round(views * 0.065),
      dislikes: Math.max(1, Math.round(views * 0.002)),
      comments: Math.round(views * 0.012),
      shares: Math.round(views * 0.008),
      average_view_duration: 170,
      impressions: Math.round(views * 13),
      impressions_ctr: 5.2,
      synced_at: syncedAt,
    };
  });
}

export async function POST(request: NextRequest) {
  const {
    data: { user },
  } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const demoEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEMO_INTEGRATIONS === "true";

  if (!demoEnabled) {
    return NextResponse.json(
      {
        error:
          "Demo connection is disabled in production. Set ENABLE_DEMO_INTEGRATIONS=true to enable it.",
      },
      { status: 403 }
    );
  }

  const adminSupabase = createAdminClient();
  const health = await checkRequiredTables(adminSupabase, REQUIRED_TABLES);

  if (!health.ok) {
    return NextResponse.json(
      {
        error: `Missing required tables: ${health.missingTables.join(", ")}`,
        missingTables: health.missingTables,
      },
      { status: 503 }
    );
  }

  const now = new Date();
  const syncedAt = now.toISOString();
  const demoChannelId = "UCrearvyDemo0001";

  try {
    const { encrypted: shopifyAccessToken, iv: shopifyIv } = encrypt(
      "demo_shopify_access_token"
    );
    const { encrypted: youtubeAccessToken, iv: youtubeAccessIv } = encrypt(
      "demo_youtube_access_token"
    );
    const { encrypted: youtubeRefreshToken, iv: youtubeRefreshIv } = encrypt(
      "demo_youtube_refresh_token"
    );

    const { data: shopifyIntegration, error: shopifyIntegrationError } =
      await adminSupabase
        .from("integrations")
        .upsert(
          {
            user_id: user.id,
            provider: "shopify",
            provider_account_id: "demo-shopify-store",
            provider_account_name: "Rearvy Demo Store (demo-store.myshopify.com)",
            access_token_enc: shopifyAccessToken,
            token_iv: shopifyIv,
            scopes: ["read_products", "read_orders", "read_inventory"],
            status: "active",
            last_synced_at: syncedAt,
            sync_cursor: { demo: true, shop_domain: "demo-store.myshopify.com" },
          },
          { onConflict: "user_id,provider" }
        )
        .select("id")
        .single();

    if (shopifyIntegrationError || !shopifyIntegration) {
      throw new Error(
        `Failed creating Shopify demo integration: ${shopifyIntegrationError?.message || "Unknown error"}`
      );
    }

    const { data: youtubeIntegration, error: youtubeIntegrationError } =
      await adminSupabase
        .from("integrations")
        .upsert(
          {
            user_id: user.id,
            provider: "youtube",
            provider_account_id: demoChannelId,
            provider_account_name: "Rearvy Demo Channel",
            access_token_enc: youtubeAccessToken,
            refresh_token_enc: youtubeRefreshToken,
            token_iv: youtubeAccessIv,
            scopes: [
              "https://www.googleapis.com/auth/youtube.readonly",
              "https://www.googleapis.com/auth/yt-analytics.readonly",
            ],
            token_expires_at: new Date(Date.now() + 30 * DAY_MS).toISOString(),
            status: "active",
            last_synced_at: syncedAt,
            sync_cursor: {
              demo: true,
              refresh_iv: youtubeRefreshIv,
              channel_id: demoChannelId,
            },
          },
          { onConflict: "user_id,provider" }
        )
        .select("id")
        .single();

    if (youtubeIntegrationError || !youtubeIntegration) {
      throw new Error(
        `Failed creating YouTube demo integration: ${youtubeIntegrationError?.message || "Unknown error"}`
      );
    }

    await Promise.all([
      adminSupabase.from("products").delete().eq("user_id", user.id),
      adminSupabase.from("orders").delete().eq("user_id", user.id),
      adminSupabase.from("business_metrics").delete().eq("user_id", user.id),
      adminSupabase.from("youtube_comments").delete().eq("user_id", user.id),
      adminSupabase.from("youtube_analytics").delete().eq("user_id", user.id),
      adminSupabase.from("youtube_videos").delete().eq("user_id", user.id),
      adminSupabase.from("youtube_channels").delete().eq("user_id", user.id),
    ]);

    const products = [
      {
        user_id: user.id,
        integration_id: shopifyIntegration.id,
        external_id: "demo-prod-hoodie",
        title: "Rearvy Performance Hoodie",
        description: "Premium hoodie designed for long creator work sessions.",
        price: 79,
        compare_at_price: 99,
        currency: "USD",
        inventory_quantity: 42,
        status: "active",
        product_type: "Apparel",
        vendor: "Rearvy Labs",
        tags: ["demo", "apparel", "top_seller"],
        handle: "rearvy-performance-hoodie",
        variants_count: 2,
        metadata: { demo: true },
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: shopifyIntegration.id,
        external_id: "demo-prod-playbook",
        title: "Growth Planning Playbook",
        description: "Weekly planning playbook with growth templates.",
        price: 49,
        compare_at_price: 59,
        currency: "USD",
        inventory_quantity: 999,
        status: "active",
        product_type: "Digital",
        vendor: "Rearvy Labs",
        tags: ["demo", "digital"],
        handle: "growth-planning-playbook",
        variants_count: 1,
        metadata: { demo: true },
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: shopifyIntegration.id,
        external_id: "demo-prod-tee",
        title: "Customer Insights Tee",
        description: "Soft cotton tee for customer research days.",
        price: 34,
        compare_at_price: 42,
        currency: "USD",
        inventory_quantity: 76,
        status: "active",
        product_type: "Apparel",
        vendor: "Rearvy Labs",
        tags: ["demo", "apparel"],
        handle: "customer-insights-tee",
        variants_count: 3,
        metadata: { demo: true },
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: shopifyIntegration.id,
        external_id: "demo-prod-notebook",
        title: "Conversion Sprint Notebook",
        description: "A notebook for weekly conversion experiments.",
        price: 29,
        compare_at_price: 35,
        currency: "USD",
        inventory_quantity: 130,
        status: "active",
        product_type: "Stationery",
        vendor: "Rearvy Labs",
        tags: ["demo", "stationery"],
        handle: "conversion-sprint-notebook",
        variants_count: 1,
        metadata: { demo: true },
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: shopifyIntegration.id,
        external_id: "demo-prod-stickers",
        title: "Analytics Sticker Pack",
        description: "Stickers for dashboards, funnels, and growth loops.",
        price: 12,
        compare_at_price: 16,
        currency: "USD",
        inventory_quantity: 220,
        status: "active",
        product_type: "Accessories",
        vendor: "Rearvy Labs",
        tags: ["demo", "accessories"],
        handle: "analytics-sticker-pack",
        variants_count: 1,
        metadata: { demo: true },
        synced_at: syncedAt,
      },
    ];

    const orders = buildDemoOrders(user.id, shopifyIntegration.id, now);
    const metrics = buildBusinessMetrics(user.id, shopifyIntegration.id, now, orders);

    const videos = [
      {
        user_id: user.id,
        integration_id: youtubeIntegration.id,
        channel_id: demoChannelId,
        video_id: "rearvy_demo_video_1",
        title: "How We Doubled Conversion Rate in 14 Days",
        description: "A practical walkthrough of rapid conversion testing.",
        published_at: new Date(now.getTime() - 4 * DAY_MS).toISOString(),
        duration: "PT8M24S",
        tags: ["conversion", "growth"],
        category_id: "27",
        privacy_status: "public",
        view_count: 12480,
        like_count: 835,
        comment_count: 118,
        favorite_count: 0,
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: youtubeIntegration.id,
        channel_id: demoChannelId,
        video_id: "rearvy_demo_video_2",
        title: "Shopify Dashboard Setup for Weekly Reviews",
        description: "A setup guide for high-signal ecommerce dashboards.",
        published_at: new Date(now.getTime() - 9 * DAY_MS).toISOString(),
        duration: "PT10M05S",
        tags: ["shopify", "analytics"],
        category_id: "27",
        privacy_status: "public",
        view_count: 9830,
        like_count: 641,
        comment_count: 94,
        favorite_count: 0,
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: youtubeIntegration.id,
        channel_id: demoChannelId,
        video_id: "rearvy_demo_video_3",
        title: "Content Calendar That Drives Product Sales",
        description: "Planning content around demand and seasonal moments.",
        published_at: new Date(now.getTime() - 14 * DAY_MS).toISOString(),
        duration: "PT6M52S",
        tags: ["content-strategy", "sales"],
        category_id: "27",
        privacy_status: "public",
        view_count: 15120,
        like_count: 1012,
        comment_count: 142,
        favorite_count: 0,
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: youtubeIntegration.id,
        channel_id: demoChannelId,
        video_id: "rearvy_demo_video_4",
        title: "Pricing Test Teardown: What We Learned",
        description: "A breakdown of an end-to-end pricing experiment.",
        published_at: new Date(now.getTime() - 21 * DAY_MS).toISOString(),
        duration: "PT9M44S",
        tags: ["pricing", "a-b-testing"],
        category_id: "27",
        privacy_status: "public",
        view_count: 11190,
        like_count: 768,
        comment_count: 101,
        favorite_count: 0,
        synced_at: syncedAt,
      },
    ];

    const comments = [
      {
        user_id: user.id,
        integration_id: youtubeIntegration.id,
        video_id: "rearvy_demo_video_1",
        comment_id: "rearvy_demo_comment_1",
        text_display:
          "This framework helped us prioritize experiments better. Thanks!",
        author_name: "Maya P",
        like_count: 17,
        reply_count: 2,
        published_at: new Date(now.getTime() - 3 * DAY_MS).toISOString(),
        updated_at_yt: new Date(now.getTime() - 3 * DAY_MS).toISOString(),
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: youtubeIntegration.id,
        video_id: "rearvy_demo_video_1",
        comment_id: "rearvy_demo_comment_2",
        text_display: "Can you share the spreadsheet template from minute 4?",
        author_name: "Jordan K",
        like_count: 9,
        reply_count: 1,
        published_at: new Date(now.getTime() - 2 * DAY_MS).toISOString(),
        updated_at_yt: new Date(now.getTime() - 2 * DAY_MS).toISOString(),
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: youtubeIntegration.id,
        video_id: "rearvy_demo_video_2",
        comment_id: "rearvy_demo_comment_3",
        text_display:
          "We copied this dashboard layout and reporting is much faster now.",
        author_name: "Casey M",
        like_count: 14,
        reply_count: 0,
        published_at: new Date(now.getTime() - 7 * DAY_MS).toISOString(),
        updated_at_yt: new Date(now.getTime() - 7 * DAY_MS).toISOString(),
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: youtubeIntegration.id,
        video_id: "rearvy_demo_video_2",
        comment_id: "rearvy_demo_comment_4",
        text_display: "Would love a follow-up focused on cohort analysis.",
        author_name: "Priya N",
        like_count: 6,
        reply_count: 0,
        published_at: new Date(now.getTime() - 6 * DAY_MS).toISOString(),
        updated_at_yt: new Date(now.getTime() - 6 * DAY_MS).toISOString(),
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: youtubeIntegration.id,
        video_id: "rearvy_demo_video_3",
        comment_id: "rearvy_demo_comment_5",
        text_display: "This content calendar angle is exactly what we needed.",
        author_name: "Logan C",
        like_count: 21,
        reply_count: 3,
        published_at: new Date(now.getTime() - 12 * DAY_MS).toISOString(),
        updated_at_yt: new Date(now.getTime() - 12 * DAY_MS).toISOString(),
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: youtubeIntegration.id,
        video_id: "rearvy_demo_video_3",
        comment_id: "rearvy_demo_comment_6",
        text_display: "Great examples. Please do one for B2B SaaS too.",
        author_name: "Nora S",
        like_count: 8,
        reply_count: 1,
        published_at: new Date(now.getTime() - 11 * DAY_MS).toISOString(),
        updated_at_yt: new Date(now.getTime() - 11 * DAY_MS).toISOString(),
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: youtubeIntegration.id,
        video_id: "rearvy_demo_video_4",
        comment_id: "rearvy_demo_comment_7",
        text_display: "Loved the honesty about the failed test before the win.",
        author_name: "Ryan E",
        like_count: 19,
        reply_count: 2,
        published_at: new Date(now.getTime() - 19 * DAY_MS).toISOString(),
        updated_at_yt: new Date(now.getTime() - 19 * DAY_MS).toISOString(),
        synced_at: syncedAt,
      },
      {
        user_id: user.id,
        integration_id: youtubeIntegration.id,
        video_id: "rearvy_demo_video_4",
        comment_id: "rearvy_demo_comment_8",
        text_display: "This gave us confidence to test pricing in small cohorts.",
        author_name: "Sana V",
        like_count: 13,
        reply_count: 1,
        published_at: new Date(now.getTime() - 18 * DAY_MS).toISOString(),
        updated_at_yt: new Date(now.getTime() - 18 * DAY_MS).toISOString(),
        synced_at: syncedAt,
      },
    ];

    const analytics = buildYoutubeAnalytics(
      user.id,
      youtubeIntegration.id,
      demoChannelId,
      now,
      syncedAt
    );

    const { error: productError } = await adminSupabase
      .from("products")
      .upsert(products, { onConflict: "user_id,external_id" });
    if (productError) throw new Error(productError.message);

    const { error: orderError } = await adminSupabase
      .from("orders")
      .upsert(orders, { onConflict: "user_id,external_id" });
    if (orderError) throw new Error(orderError.message);

    const { error: metricsError } = await adminSupabase
      .from("business_metrics")
      .insert(metrics);
    if (metricsError) throw new Error(metricsError.message);

    const { error: channelError } = await adminSupabase
      .from("youtube_channels")
      .upsert(
        {
          user_id: user.id,
          integration_id: youtubeIntegration.id,
          channel_id: demoChannelId,
          title: "Rearvy Demo Channel",
          description:
            "Demo YouTube account used to preview analytics and engagement workflows.",
          custom_url: "@rearvy-demo",
          country: "US",
          published_at: new Date(now.getTime() - 500 * DAY_MS).toISOString(),
          subscriber_count: 28410,
          video_count: videos.length,
          view_count: videos.reduce(
            (sum, video) => sum + Number(video.view_count),
            0
          ),
          synced_at: syncedAt,
        },
        { onConflict: "user_id,channel_id" }
      );
    if (channelError) throw new Error(channelError.message);

    const { error: videoError } = await adminSupabase
      .from("youtube_videos")
      .upsert(videos, { onConflict: "user_id,video_id" });
    if (videoError) throw new Error(videoError.message);

    const { error: commentError } = await adminSupabase
      .from("youtube_comments")
      .upsert(comments, { onConflict: "user_id,comment_id" });
    if (commentError) throw new Error(commentError.message);

    const { error: analyticsError } = await adminSupabase
      .from("youtube_analytics")
      .upsert(analytics, { onConflict: "user_id,channel_id,metric_date" });
    if (analyticsError) throw new Error(analyticsError.message);

    return NextResponse.json({
      success: true,
      synced: {
        products: products.length,
        orders: orders.length,
        businessMetrics: metrics.length,
        videos: videos.length,
        comments: comments.length,
        analytics: analytics.length,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to connect demo data";
    console.error("Demo integration setup failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
