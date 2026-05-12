/**
 * AI-Trader Trade Sync Service
 * Handles trade synchronization and copy-trading workflows
 */

import { adminDb } from "@/lib/firebase/admin";
import { AITraderTradeSync, AITraderCopyTradeConfig, AITraderSignal } from "@/types/ai-trader";
import { aiTraderClient } from "./ai-trader-client";

export class AITraderSyncService {
  /**
   * Sync a completed trade to AI-Trader platform (provider mode)
   */
  async syncTrade(
    userId: string,
    trade: {
      symbol: string;
      entryPrice: number;
      exitPrice?: number;
      quantity: number;
      action: "Buy" | "Sell";
      executedAt: Date;
      broker?: string;
    }
  ): Promise<boolean> {
    try {
      const tradeSync: AITraderTradeSync = {
        tradeId: `${userId}-${Date.now()}`,
        agentId: userId,
        symbol: trade.symbol,
        entryPrice: trade.entryPrice,
        quantity: trade.quantity,
        action: trade.action,
        executedAt: trade.executedAt,
        broker: trade.broker || "rearvy",
        status: "filled",
      };

      const response = await aiTraderClient.syncTrade(tradeSync);

      if (response.success) {
        // Log sync to Firestore
        await adminDb
          .collection(`users/${userId}/ai_trader_syncs`)
          .add({
            ...tradeSync,
            syncedAt: new Date(),
            success: true,
          });
        return true;
      }

      // Log failed sync
      await adminDb
        .collection(`users/${userId}/ai_trader_syncs`)
        .add({
          ...tradeSync,
          syncedAt: new Date(),
          success: false,
          error: response.error,
        });

      console.error(`[AITraderSyncService] Failed to sync trade: ${response.error}`);
      return false;
    } catch (error) {
      console.error("[AITraderSyncService] Error syncing trade:", error);
      return false;
    }
  }

  /**
   * Enable copy-trading from a leader agent
   */
  async enableCopyTrade(
    followerId: string,
    leaderId: string,
    symbols: string[],
    options?: {
      positionSize?: number;
      maxRisk?: number;
      autoExecute?: boolean;
    }
  ): Promise<boolean> {
    try {
      const config: AITraderCopyTradeConfig = {
        followerId,
        leaderId,
        symbols,
        positionSize: options?.positionSize || 1,
        maxRisk: options?.maxRisk || 100,
        autoExecute: options?.autoExecute ?? false,
        pauseOnDrawdown: 20, // Default: pause at 20% drawdown
      };

      const response = await aiTraderClient.setCopyTradeConfig(config);

      if (response.success) {
        // Store config in Firestore
        await adminDb
          .collection(`users/${followerId}/copy_trade_configs`)
          .doc(leaderId)
          .set({
            ...config,
            createdAt: new Date(),
            active: true,
          });
        return true;
      }

      console.error(`[AITraderSyncService] Failed to enable copy-trade: ${response.error}`);
      return false;
    } catch (error) {
      console.error("[AITraderSyncService] Error enabling copy-trade:", error);
      return false;
    }
  }

  /**
   * Get active copy-trade configurations
   */
  async getActiveCopyTrades(followerId: string): Promise<AITraderCopyTradeConfig[]> {
    try {
      const response = await aiTraderClient.getCopyTradeConfigs(followerId);
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error("[AITraderSyncService] Error fetching copy-trade configs:", error);
      return [];
    }
  }

  /**
   * Get signals from followed agents
   */
  async getFollowedSignals(agentId: string): Promise<AITraderSignal[]> {
    try {
      const response = await aiTraderClient.getFollowedSignals(agentId);
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error("[AITraderSyncService] Error fetching followed signals:", error);
      return [];
    }
  }

  /**
   * Auto-execute signals from followed agents (copy-trading)
   */
  async autoExecuteSignals(userId: string, signals: AITraderSignal[]): Promise<number> {
    let executedCount = 0;

    for (const signal of signals) {
      try {
        // Get copy-trade config for this leader/symbol
        const configs = await adminDb
          .collection(`users/${userId}/copy_trade_configs`)
          .where("symbols", "array-contains", signal.symbol)
          .where("autoExecute", "==", true)
          .get();

        if (configs.empty) continue;

        // For now, just log the trade - actual execution depends on broker integration
        const config = configs.docs[0].data() as AITraderCopyTradeConfig;

        await adminDb
          .collection(`users/${userId}/copied_trades`)
          .add({
            leaderSignalId: signal.id,
            leaderId: config.leaderId,
            symbol: signal.symbol,
            action: signal.action,
            confidence: signal.confidence,
            executedAt: new Date(),
            status: "pending_execution",
            positionSize: config.positionSize,
          });

        executedCount++;
      } catch (error) {
        console.error(`[AITraderSyncService] Error auto-executing signal for ${signal.symbol}:`, error);
      }
    }

    return executedCount;
  }

  /**
   * Disable copy-trading from a leader
   */
  async disableCopyTrade(followerId: string, leaderId: string): Promise<boolean> {
    try {
      await adminDb
        .collection(`users/${followerId}/copy_trade_configs`)
        .doc(leaderId)
        .update({
          active: false,
          disabledAt: new Date(),
        });
      return true;
    } catch (error) {
      console.error("[AITraderSyncService] Error disabling copy-trade:", error);
      return false;
    }
  }

  /**
   * Get sync history
   */
  async getSyncHistory(userId: string, limit: number = 50) {
    try {
      const snapshot = await adminDb
        .collection(`users/${userId}/ai_trader_syncs`)
        .orderBy("syncedAt", "desc")
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => doc.data());
    } catch (error) {
      console.error("[AITraderSyncService] Error fetching sync history:", error);
      return [];
    }
  }
}

// Export singleton instance
export const aiTraderSyncService = new AITraderSyncService();
