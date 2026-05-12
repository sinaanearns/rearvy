/**
 * AI-Trader Signal Publisher
 * Converts Rearvy trading opinions to AI-Trader signals and publishes them
 */

import { TradingOpinion } from "@/types/trading";
import { AITraderSignal, AITraderResponseData } from "@/types/ai-trader";
import { aiTraderClient } from "./ai-trader-client";

export class AITraderSignalPublisher {
  private agentId: string;
  private agentName: string;

  constructor(agentId: string = "rearvy-agent", agentName: string = "Rearvy AI") {
    this.agentId = agentId;
    this.agentName = agentName;
  }

  /**
   * Convert Rearvy trading opinion to AI-Trader signal
   */
  convertOpinionToSignal(opinion: TradingOpinion): AITraderSignal {
    return {
      agentId: this.agentId,
      symbol: opinion.symbol,
      action: opinion.action as "Buy" | "Sell" | "Hold",
      confidence: opinion.confidence,
      entryPrice: opinion.entryLevel,
      stopLoss: opinion.stopLevel,
      takeProfit: opinion.targetLevel,
      timeframe: opinion.timeframe || "H1",
      reason: opinion.reasoning || "Systematic analysis",
      tags: this.extractTags(opinion),
      riskReward: this.calculateRiskReward(opinion),
      publishedAt: new Date(),
    };
  }

  /**
   * Publish Rearvy trading opinion to AI-Trader
   */
  async publishOpinion(opinion: TradingOpinion): Promise<AITraderResponseData<AITraderSignal>> {
    try {
      // Skip Hold opinions - they don't need to be published
      if (opinion.action === "Hold") {
        return {
          success: false,
          error: "Hold opinions are not published to AI-Trader",
        };
      }

      const signal = this.convertOpinionToSignal(opinion);
      return await aiTraderClient.publishSignal(signal);
    } catch (error) {
      console.error("[AITraderSignalPublisher] Error publishing opinion:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to publish signal",
      };
    }
  }

  /**
   * Publish multiple opinions in batch
   */
  async publishBatch(opinions: TradingOpinion[]): Promise<AITraderResponseData<AITraderSignal[]>> {
    try {
      const signals = opinions
        .filter((op) => op.action !== "Hold")
        .map((op) => this.convertOpinionToSignal(op));

      const results = await Promise.all(signals.map((s) => aiTraderClient.publishSignal(s)));

      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        console.warn(
          `[AITraderSignalPublisher] ${failed.length} of ${results.length} signals failed to publish`
        );
      }

      return {
        success: failed.length === 0,
        data: results.map((r) => r.data).filter(Boolean) as AITraderSignal[],
        message: `Published ${results.length - failed.length}/${results.length} signals`,
      };
    } catch (error) {
      console.error("[AITraderSignalPublisher] Error publishing batch:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to publish batch",
      };
    }
  }

  /**
   * Extract trading tags from opinion
   */
  private extractTags(opinion: TradingOpinion): string[] {
    const tags: string[] = [];

    // Tag based on confidence
    if (opinion.confidence >= 0.8) tags.push("high-conviction");
    if (opinion.confidence < 0.5) tags.push("low-conviction");

    // Tag based on action
    if (opinion.action === "Buy") tags.push("bullish");
    if (opinion.action === "Sell") tags.push("bearish");

    // Tag based on timeframe
    if (opinion.timeframe?.includes("M")) tags.push("intraday");
    if (opinion.timeframe?.includes("D") || opinion.timeframe?.includes("W")) tags.push("swing");

    // Add custom analysis type if available
    if (opinion.reasoning?.toLowerCase().includes("technical")) tags.push("technical");
    if (opinion.reasoning?.toLowerCase().includes("fundamental")) tags.push("fundamental");
    if (opinion.reasoning?.toLowerCase().includes("sentiment")) tags.push("sentiment");

    return [...new Set(tags)]; // Deduplicate
  }

  /**
   * Calculate risk/reward ratio
   */
  private calculateRiskReward(opinion: TradingOpinion): number | undefined {
    if (!opinion.stopLevel || !opinion.targetLevel) {
      return undefined;
    }

    const risk = Math.abs(opinion.entryLevel - opinion.stopLevel);
    const reward = Math.abs(opinion.targetLevel - opinion.entryLevel);

    if (risk === 0) return undefined;
    return reward / risk;
  }

  /**
   * Check if signal should be published based on rules
   */
  shouldPublish(opinion: TradingOpinion): boolean {
    // Never publish Hold signals
    if (opinion.action === "Hold") return false;

    // Require minimum confidence
    if (opinion.confidence < 0.4) return false;

    // Require complete entry/exit levels
    if (!opinion.entryLevel || !opinion.stopLevel || !opinion.targetLevel) {
      return false;
    }

    return true;
  }
}

// Export singleton instance
export const aiTraderPublisher = new AITraderSignalPublisher();
