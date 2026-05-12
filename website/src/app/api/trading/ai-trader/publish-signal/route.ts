/**
 * API Route: Publish trading opinion to AI-Trader
 * POST /api/trading/ai-trader/publish-signal
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { TradingOpinion } from "@/types/trading";
import { aiTraderPublisher } from "@/lib/trading/ai-trader-signal-publisher";
import { adminDb } from "@/lib/firebase/admin";

function normalizeOpinionPayload(input: Record<string, unknown>): TradingOpinion & {
  entryLevel?: number;
  stopLevel?: number;
  targetLevel?: number;
  reasoning?: string;
} {
  const action =
    input.action === "Buy" || input.action === "Sell" || input.action === "Hold"
      ? input.action
      : "Hold";
  const confidence = typeof input.confidence === "number" ? input.confidence : 0;
  const symbol = typeof input.symbol === "string" ? input.symbol : "UNKNOWN";
  const timeframe =
    input.timeframe === "M15" ||
    input.timeframe === "M30" ||
    input.timeframe === "H1" ||
    input.timeframe === "H4" ||
    input.timeframe === "D1" ||
    input.timeframe === "W1"
      ? input.timeframe
      : "H1";
  const riskNotes =
    typeof input.riskNotes === "string" && input.riskNotes.trim().length > 0
      ? input.riskNotes
      : "Risk controls should be validated before execution.";
  const fetchedAt = typeof input.fetchedAt === "number" ? input.fetchedAt : Date.now();

  const entry = typeof input.entry === "number" ? input.entry : undefined;
  const stopLoss = typeof input.stopLoss === "number" ? input.stopLoss : undefined;
  const takeProfit = typeof input.takeProfit === "number" ? input.takeProfit : undefined;

  return {
    action,
    confidence,
    symbol,
    timeframe,
    riskNotes,
    fetchedAt,
    reason:
      typeof input.reason === "string" && input.reason.trim().length > 0
        ? input.reason
        : "Systematic analysis",
    entry,
    stopLoss,
    takeProfit,
    entryLevel:
      typeof input.entryLevel === "number"
        ? input.entryLevel
        : entry,
    stopLevel:
      typeof input.stopLevel === "number"
        ? input.stopLevel
        : stopLoss,
    targetLevel:
      typeof input.targetLevel === "number"
        ? input.targetLevel
        : takeProfit,
    reasoning:
      typeof input.reasoning === "string" && input.reasoning.trim().length > 0
        ? input.reasoning
        : typeof input.reason === "string"
          ? input.reason
          : "Systematic analysis",
  };
}

export async function POST(request: NextRequest) {
  try {
    // 1. Require authentication
    const auth = await requireAuth(request);
    if (auth.error) {
      return auth.error;
    }
    const userId = auth.user.uid;

    // 2. Check AI-Trader integration is enabled
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};

    if (!userData.aiTraderEnabled) {
      return NextResponse.json(
        { error: "AI-Trader integration is not enabled. Register your agent first." },
        { status: 403 }
      );
    }

    // 3. Parse opinion data
    const rawOpinion = (await request.json()) as Record<string, unknown>;
    const opinion = normalizeOpinionPayload(rawOpinion);

    // 4. Validate opinion can be published
    if (!aiTraderPublisher.shouldPublish(opinion)) {
      return NextResponse.json(
        {
          error: "Opinion does not meet publishing criteria (Hold, low confidence, or missing levels)",
        },
        { status: 400 }
      );
    }

    // 5. Publish to AI-Trader
    const result = await aiTraderPublisher.publishOpinion(opinion);

    if (!result.success) {
      return NextResponse.json(
        { error: `Failed to publish signal: ${result.error}` },
        { status: 500 }
      );
    }

    // 6. Log the publication to Firestore
    await adminDb
      .collection(`users/${userId}/ai_trader_publications`)
      .add({
        signal: result.data,
        publishedAt: new Date(),
        status: "published",
      });

    return NextResponse.json({
      success: true,
      signal: result.data,
      message: "Signal published to AI-Trader successfully",
    });
  } catch (error) {
    console.error("[API] Error publishing signal to AI-Trader:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
