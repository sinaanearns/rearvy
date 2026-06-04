/**
 * API Route: Register/connect Rearvy agent to AI-Trader
 * POST /api/trading/ai-trader/register
 * GET /api/trading/ai-trader/register (get registration status)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { aiTraderClient } from "@/lib/trading/ai-trader-client";
import { adminDb } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("AITraderRegisterRoute");

export async function POST(request: NextRequest) {
  try {
    // 1. Require authentication
    const auth = await requireAuth(request);
    if (auth.error) {
      return auth.error;
    }
    const userId = auth.user.uid;

    // 2. Get user data
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};

    // 3. Check if already registered
    if (userData.aiTraderEnabled && userData.aiTraderAgentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Agent already registered on AI-Trader",
          agentId: userData.aiTraderAgentId,
        },
        { status: 400 }
      );
    }

    // 4. Register agent with AI-Trader
    const agentId = `rearvy-${userId.substring(0, 12)}`;
    const registration = {
      agentId,
      agentName: userData.displayName || "Rearvy Agent",
      tradingMode: "paper" as const, // Start in paper mode
      status: "pending" as const,
    };

    const result = await aiTraderClient.registerAgent(registration);

    if (!result.success) {
      return NextResponse.json(
        { error: `Registration failed: ${result.error}` },
        { status: 500 }
      );
    }

    // 5. Update user document with registration data
    await adminDb
      .collection("users")
      .doc(userId)
      .update({
        aiTraderEnabled: true,
        aiTraderAgentId: agentId,
        aiTraderProfile: result.data,
        aiTraderRegisteredAt: new Date(),
        aiTraderStatus: "active",
      });

    // 6. Create AI-Trader config document
    await adminDb
      .collection(`users/${userId}/ai_trader_config`)
      .doc("settings")
      .set({
        enabled: true,
        agentId,
        tradingMode: "paper",
        autoPublishSignals: false,
        autoExecuteCopyTrades: false,
        maxPositionSize: 1,
        maxRiskPerTrade: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    return NextResponse.json({
      success: true,
      agentId,
      profile: result.data,
      message: "Agent successfully registered on AI-Trader",
    });
  } catch (error) {
    log.error("Error registering agent on AI-Trader:", error);
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

    // 2. Get user document
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};

    // 3. Check registration status
    if (!userData.aiTraderEnabled) {
      return NextResponse.json({
        registered: false,
        message: "Agent not registered on AI-Trader",
      });
    }

    // 4. Get config settings
    const configDoc = await adminDb
      .collection(`users/${userId}/ai_trader_config`)
      .doc("settings")
      .get();
    const config = configDoc.data();

    // 5. Get stats from AI-Trader (optional)
    let agentProfile = null;
    if (userData.aiTraderAgentId) {
      const profileResult = await aiTraderClient.getAgentProfile(userData.aiTraderAgentId);
      if (profileResult.success) {
        agentProfile = profileResult.data;
      }
    }

    return NextResponse.json({
      registered: true,
      agentId: userData.aiTraderAgentId,
      status: userData.aiTraderStatus || "active",
      registeredAt: userData.aiTraderRegisteredAt,
      config,
      profile: agentProfile,
    });
  } catch (error) {
    log.error("Error checking AI-Trader registration status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
