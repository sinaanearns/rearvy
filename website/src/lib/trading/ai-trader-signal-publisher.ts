/**
 * AI-Trader Signal Publisher
 * Converts Rearvy trading opinions to AI-Trader signals and publishes them
 */

import { TradingOpinion } from "@/types/trading";
import { AITraderSignal, AITraderResponseData } from "@/types/ai-trader";
import { createServerLogger } from "@/lib/server-logger";
import { aiTraderClient } from "./ai-trader-client";

const log = createServerLogger("AITraderSignalPublisher");

type TradingOpinionWithLegacy = TradingOpinion & {
    const normalized = opinion as TradingOpinionWithLegacy;
    const entryPrice = this.getEntry(normalized);
    const stopLoss = this.getStopLoss(normalized);
    const takeProfit = this.getTakeProfit(normalized);

    return {
      agentId: this.agentId,
      symbol: opinion.symbol,
      action: opinion.action as "Buy" | "Sell" | "Hold",
      confidence: opinion.confidence,
      entryPrice,
      stopLoss,
      takeProfit,
      timeframe: opinion.timeframe || "H1",
      reason: this.getReason(normalized),
      tags: this.extractTags(opinion),
      riskReward: this.calculateRiskReward(opinion),
      publishedAt: new Date(),
    };
  }

  private getEntry(opinion: TradingOpinionWithLegacy): number | undefined {
    return typeof opinion.entry === "number" ? opinion.entry : opinion.entryLevel;
  }

  private getStopLoss(opinion: TradingOpinionWithLegacy): number | undefined {
    return typeof opinion.stopLoss === "number" ? opinion.stopLoss : opinion.stopLevel;
  }

  private getTakeProfit(opinion: TradingOpinionWithLegacy): number | undefined {
    return typeof opinion.takeProfit === "number" ? opinion.takeProfit : opinion.targetLevel;
  }

  private getReason(opinion: TradingOpinionWithLegacy): string {
    if (typeof opinion.reason === "string" && opinion.reason.trim().length > 0) {
      return opinion.reason;
    }
    if (typeof opinion.reasoning === "string" && opinion.reasoning.trim().length > 0) {
      return opinion.reasoning;
    }
    return "Systematic analysis";
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
      log.error("Error publishing opinion:", error);
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
        log.warn(`${failed.length} of ${results.length} signals failed to publish`);
      }

      return {
        success: failed.length === 0,
        data: results.map((r) => r.data).filter(Boolean) as AITraderSignal[],
        message: `Published ${results.length - failed.length}/${results.length} signals`,
      };
    } catch (error) {
      log.error("Error publishing batch:", error);
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
    const normalized = opinion as TradingOpinionWithLegacy;
    const text = this.getReason(normalized).toLowerCase();
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
    if (text.includes("technical")) tags.push("technical");
    if (text.includes("fundamental")) tags.push("fundamental");
    if (text.includes("sentiment")) tags.push("sentiment");

    return [...new Set(tags)]; // Deduplicate
  }

  /**
   * Calculate risk/reward ratio
   */
  private calculateRiskReward(opinion: TradingOpinion): number | undefined {
    const normalized = opinion as TradingOpinionWithLegacy;
    const entry = this.getEntry(normalized);
    const stopLoss = this.getStopLoss(normalized);
    const takeProfit = this.getTakeProfit(normalized);

    if (!entry || !stopLoss || !takeProfit) {
      return undefined;
    }

    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(takeProfit - entry);

    if (risk === 0) return undefined;
    return reward / risk;
  }

  /**
   * Check if signal should be published based on rules
   */
  shouldPublish(opinion: TradingOpinion): boolean {
    const normalized = opinion as TradingOpinionWithLegacy;

    // Never publish Hold signals
    if (opinion.action === "Hold") return false;

    // Require minimum confidence
    if (opinion.confidence < 0.4) return false;

    // Require complete entry/exit levels
    if (!this.getEntry(normalized) || !this.getStopLoss(normalized) || !this.getTakeProfit(normalized)) {
      return false;
    }

    return true;
  }
}

// Export singleton instance
export const aiTraderPublisher = new AITraderSignalPublisher();
