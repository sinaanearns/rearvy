/**
 * API Route: Trade sync and market intelligence
 * POST /api/trading/ai-trader/sync-trade (sync completed trade)
 * GET /api/trading/ai-trader/market-intel/:symbol (get market intel)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { aiTraderSyncService } from "@/lib/trading/ai-trader-sync-service";
import { aiTraderClient } from "@/lib/trading/ai-trader-client";

export async function POST(request: NextRequest) {
  try {
    // 1. Require authentication
    const auth = await requireAuth(request);
    if (auth.error) {
      return auth.error;
    }
    const userId = auth.user.uid;

    // 2. Parse trade data
    const { symbol, entryPrice, exitPrice, quantity, action, broker } = await request.json();

    if (!symbol || !entryPrice || !quantity || !action) {
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
      broker: broker || "rearvy",
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
    console.error("[API] Error syncing trade:", error);
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
    console.error("[API] Error fetching market intel:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
