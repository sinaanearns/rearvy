import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { createAdminClient } from "@/lib/supabase/admin";

type ExportPayload = {
  userId: string;
  dataType: string;
  filters: {
    periodStart?: string;
    periodEnd?: string;
    limit?: number;
  };
};

const COLUMN_CONFIGS: Record<
  string,
  { columns: string[]; select: string; dateCol?: string }
> = {
  products: {
    columns: [
      "title",
      "price",
      "compare_at_price",
      "currency",
      "inventory_quantity",
      "status",
      "product_type",
      "vendor",
      "tags",
    ],
    select:
      "title, price, compare_at_price, currency, inventory_quantity, status, product_type, vendor, tags",
  },
  orders: {
    columns: [
      "order_number",
      "total_price",
      "subtotal_price",
      "total_tax",
      "total_discount",
      "currency",
      "financial_status",
      "fulfillment_status",
      "customer_name",
      "customer_email",
      "placed_at",
    ],
    select:
      "order_number, total_price, subtotal_price, total_tax, total_discount, currency, financial_status, fulfillment_status, customer_name, customer_email, placed_at",
    dateCol: "placed_at",
  },
  youtube_videos: {
    columns: [
      "title",
      "video_id",
      "published_at",
      "view_count",
      "like_count",
      "comment_count",
      "duration",
    ],
    select:
      "title, video_id, published_at, view_count, like_count, comment_count, duration",
    dateCol: "published_at",
  },
  instagram_posts: {
    columns: [
      "post_id",
      "caption",
      "media_type",
      "published_at",
      "like_count",
      "comments_count",
      "reach",
      "impressions",
    ],
    select:
      "post_id, caption, media_type, published_at, like_count, comments_count, reach, impressions",
    dateCol: "published_at",
  },
  tiktok_videos: {
    columns: [
      "video_id",
      "title",
      "create_time",
      "view_count",
      "like_count",
      "comment_count",
      "share_count",
      "duration",
    ],
    select:
      "video_id, title, create_time, view_count, like_count, comment_count, share_count, duration",
    dateCol: "create_time",
  },
};

function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = Array.isArray(value) ? value.join("; ") : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const exportSecret = process.env.SYNC_WORKER_SECRET;
  if (!exportSecret) {
    return NextResponse.json(
      { error: "Export not configured" },
      { status: 503 }
    );
  }

  let payload: ExportPayload;
  try {
    const secret = new TextEncoder().encode(exportSecret);
    const { payload: verified } = await jwtVerify(token, secret);
    payload = verified as unknown as ExportPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired download link" },
      { status: 401 }
    );
  }

  const config = COLUMN_CONFIGS[payload.dataType];
  if (!config) {
    return NextResponse.json({ error: "Invalid data type" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const limit = Math.min(Number(payload.filters.limit) || 1000, 5000);

  let query = supabase
    .from(payload.dataType)
    .select(config.select)
    .eq("user_id", payload.userId)
    .limit(limit);

  if (payload.filters.periodStart && config.dateCol) {
    query = query.gte(config.dateCol, payload.filters.periodStart);
  }
  if (payload.filters.periodEnd && config.dateCol) {
    query = query.lte(config.dateCol, payload.filters.periodEnd);
  }

  if (config.dateCol) {
    query = query.order(config.dateCol, { ascending: false });
  }

  const { data, error } = await query;
  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }

  const header = config.columns.join(",");
  const rows = (data as unknown as Record<string, unknown>[]).map((row) =>
    config.columns.map((col) => escapeCSVField(row[col])).join(",")
  );
  const csv = [header, ...rows].join("\n");

  const filename = `${payload.dataType}_export_${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
