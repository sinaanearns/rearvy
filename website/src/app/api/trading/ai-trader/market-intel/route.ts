/**
 * API Route: Trade sync and market intelligence
 * POST /api/trading/ai-trader/sync-trade (sync completed trade)
 * GET /api/trading/ai-trader/market-intel/:symbol (get market intel)
 */

import { NextRequest, NextResponse } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { requireAuth } from "@/lib/firebase/middleware";
import { aiTraderSyncService } from "@/lib/trading/ai-trader-sync-service";
import { aiTraderClient } from "@/lib/trading/ai-trader-client";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("AITraderMarketIntelRoute");

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function readTradeAction(value: unknown): "Buy" | "Sell" | null {
  return value === "Buy" || value === "Sell" ? value : null;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Require authentication
    const auth = await requireAuth(request);
    if (auth.error) {
      return auth.error;
    }
    const userId = auth.user.uid;

    // 2. Parse trade data
    const body = await readJsonRecord(request);
    const symbol = readString(body.symbol);
    const entryPrice = readPositiveNumber(body.entryPrice);
    const exitPrice = readPositiveNumber(body.exitPrice) ?? undefined;
    const quantity = readPositiveNumber(body.quantity);
    const action = readTradeAction(body.action);
    const broker = readString(body.broker) || "rearvy";

    if (!symbol || entryPrice === null || quantity === null || !action) {
      return NextResponse.json(
        {
          error: "Missing required fields: symbol, entryPrice, quantity, action",
        },
        { status: 400 }
      );
    }

    // 3. Sync trade to AI-Trader
    const success = await aiTraderSyncService.syncTrade(userId, {
      symbol,
      entryPrice,
      exitPrice,
      quantity,
      action,
      executedAt: new Date(),
      broker,
    });

    if (!success) {
      return NextResponse.json(
        { error: "Failed to sync trade to AI-Trader" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Trade synced: ${action} ${quantity} ${symbol} at ${entryPrice}`,
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Error syncing trade:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get symbol from query param
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const action = searchParams.get("action"); // "market-intel" or "top-signals"

    if (!symbol) {
      return NextResponse.json({ error: "Missing symbol parameter" }, { status: 400 });
    }

    if (action === "market-intel") {
      // Get market intelligence for symbol
      const result = await aiTraderClient.getMarketIntel(symbol);

      if (!result.success) {
        return NextResponse.json(
          { error: `Failed to fetch market intel: ${result.error}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        intel: result.data,
      });
    } else if (action === "top-signals") {
      // Get top signals for symbol
      const result = await aiTraderClient.getTopSignals(symbol, 20);

      if (!result.success) {
        return NextResponse.json(
          { error: `Failed to fetch top signals: ${result.error}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        signals: result.data || [],
        count: result.data?.length || 0,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'market-intel' or 'top-signals'" },
        { status: 400 }
      );
    }
  } catch (error) {
    log.error("Error fetching market intel:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
