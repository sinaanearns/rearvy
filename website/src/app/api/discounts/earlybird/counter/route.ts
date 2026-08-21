import { NextResponse } from "next/server";
import DodoPayments from "dodopayments";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("EarlybirdCounterApi");

function ensureEnv(name: string, value: string | undefined) {
  if (!value || !value.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

function createClient() {
  const bearerToken = ensureEnv("DODO_PAYMENTS_API_KEY", process.env.DODO_PAYMENTS_API_KEY);
  const environment = (process.env.DODO_PAYMENTS_ENVIRONMENT || "test_mode").trim() as "test_mode" | "live_mode";
  return new DodoPayments({ bearerToken, environment });
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const code = (process.env.DODO_EARLYBIRD_CODE || "").trim();
    if (!code) {
      return NextResponse.json(
        { error: "Earlybird code not configured" },
        { status: 404 }
      );
    }

    const client = createClient();
    const d = await client.discounts.retrieveByCode(code);

    const usage_limit =
      typeof (d as any)?.usage_limit === "number" ? (d as any).usage_limit : null;
    const times_used =
      typeof (d as any)?.times_used === "number" ? (d as any).times_used : 0;

    const limit = usage_limit ?? 0;
    const remaining = usage_limit === null ? null : Math.max(0, limit - times_used);

    return NextResponse.json(
      {
        code,
        times_used,
        usage_limit: usage_limit,
        remaining,
      },
      {
        status: 200,
        headers: {
          // Short cache to avoid hammering the API; UI can re-fetch periodically
          "Cache-Control": "public, max-age=15, s-maxage=15, stale-while-revalidate=30",
        },
      }
    );
  } catch (error) {
    log.error("Failed to read earlybird counter", error);
    return NextResponse.json(
      { error: "Unable to read earlybird counter" },
      { status: 500 }
    );
  }
}