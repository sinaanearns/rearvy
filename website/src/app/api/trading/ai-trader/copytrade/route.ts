/**
 * API Route: Copy-trading and follower management
 * POST /api/trading/ai-trader/copytrade (enable copy-trading)
 * DELETE /api/trading/ai-trader/copytrade (disable copy-trading)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { aiTraderSyncService } from "@/lib/trading/ai-trader-sync-service";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  try {
    // 1. Require authentication
    const auth = await requireAuth(request);
    if (auth.error) {
      return auth.error;
    }
    const userId = auth.user.uid;

    // 2. Parse request body
    const { leaderId, symbols, positionSize, maxRisk, autoExecute } = await request.json();

    if (!leaderId || !symbols || symbols.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: leaderId, symbols" },
        { status: 400 }
      );
    }

    // 3. Enable copy-trading
    const success = await aiTraderSyncService.enableCopyTrade(userId, leaderId, symbols, {
      positionSize: positionSize || 1,
      maxRisk: maxRisk || 100,
      autoExecute: autoExecute || false,
    });

    if (!success) {
      return NextResponse.json(
        { error: "Failed to enable copy-trading on AI-Trader" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Copy-trading enabled for ${symbols.join(", ")} from agent ${leaderId}`,
      followingAgent: leaderId,
      symbols,
    });
  } catch (error) {
    console.error("[API] Error enabling copy-trade:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 1. Require authentication
    const auth = await requireAuth(request);
    if (auth.error) {
      return auth.error;
    }
    const userId = auth.user.uid;

    // 2. Parse request body
    const { leaderId } = await request.json();

    if (!leaderId) {
      return NextResponse.json({ error: "Missing leaderId" }, { status: 400 });
    }

    // 3. Disable copy-trading
    const success = await aiTraderSyncService.disableCopyTrade(userId, leaderId);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to disable copy-trading" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Copy-trading disabled for agent ${leaderId}`,
    });
  } catch (error) {
    console.error("[API] Error disabling copy-trade:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Require authentication
    const auth = await requireAuth(request);
    if (auth.error) {
      return auth.error;
    }
    const userId = auth.user.uid;

    // 2. Get active copy-trade configs
    const configs = await aiTraderSyncService.getActiveCopyTrades(userId);

    // 3. Get followed signals for each config
    const signals = await aiTraderSyncService.getFollowedSignals(userId);

    return NextResponse.json({
      success: true,
      copyTradeConfigs: configs,
      totalConfigs: configs.length,
      recentSignals: signals.slice(0, 10),
    });
  } catch (error) {
    console.error("[API] Error fetching copy-trade info:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
