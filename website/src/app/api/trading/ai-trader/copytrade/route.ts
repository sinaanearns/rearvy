/**
 * API Route: Copy-trading and follower management
 * POST /api/trading/ai-trader/copytrade (enable copy-trading)
 * DELETE /api/trading/ai-trader/copytrade (disable copy-trading)
 */

import { NextRequest, NextResponse } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { requireAuth } from "@/lib/firebase/middleware";
import { aiTraderSyncService } from "@/lib/trading/ai-trader-sync-service";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("AITraderCopytradeRoute");

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readPositiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function readSymbols(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 50)
    : [];
}

export async function POST(request: NextRequest) {
  try {
    // 1. Require authentication
    const auth = await requireAuth(request);
    if (auth.error) {
      return auth.error;
    }
    const userId = auth.user.uid;

    // 2. Parse request body
    const body = await readJsonRecord(request);
    const leaderId = readString(body.leaderId);
    const symbols = readSymbols(body.symbols);

    if (!leaderId || symbols.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: leaderId, symbols" },
        { status: 400 }
      );
    }

    // 3. Enable copy-trading
    const success = await aiTraderSyncService.enableCopyTrade(userId, leaderId, symbols, {
      positionSize: readPositiveNumber(body.positionSize, 1),
      maxRisk: readPositiveNumber(body.maxRisk, 100),
      autoExecute: body.autoExecute === true,
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
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Error enabling copy-trade:", error);
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
    const body = await readJsonRecord(request);
    const leaderId = readString(body.leaderId);

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
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Error disabling copy-trade:", error);
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
    log.error("Error fetching copy-trade info:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
