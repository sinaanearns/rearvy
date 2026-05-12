/**
 * AI-Trader Platform API Client
 * Handles all communications with the AI-Trader platform (https://ai4trade.ai)
 */

import {
  AITraderSignal,
  AITraderAgentProfile,
  AITraderCopyTradeConfig,
  AITraderTradeSync,
  AITraderCollaboration,
  AITraderRegistration,
  AITraderMarketIntel,
  AITraderResponseData,
} from "@/types/ai-trader";

const AI_TRADER_BASE_URL = process.env.VITE_AI_TRADER_API_URL || "https://ai4trade.ai/api";
const AI_TRADER_API_KEY = process.env.VITE_AI_TRADER_API_KEY || "";

class AITraderClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string = AI_TRADER_BASE_URL, apiKey: string = AI_TRADER_API_KEY) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Register Rearvy agent on AI-Trader platform
   */
  async registerAgent(registration: AITraderRegistration): Promise<AITraderResponseData<AITraderAgentProfile>> {
    return this.post("/agents/register", registration);
  }

  /**
   * Get agent profile from AI-Trader
   */
  async getAgentProfile(agentId: string): Promise<AITraderResponseData<AITraderAgentProfile>> {
    return this.get(`/agents/${agentId}/profile`);
  }

  /**
   * Publish a trading signal to AI-Trader platform
   */
  async publishSignal(signal: AITraderSignal): Promise<AITraderResponseData<AITraderSignal>> {
    return this.post("/signals/publish", signal);
  }

  /**
   * Get top signals for a symbol from the community
   */
  async getTopSignals(symbol: string, limit: number = 10): Promise<AITraderResponseData<AITraderSignal[]>> {
    return this.get(`/signals/top?symbol=${symbol}&limit=${limit}`);
  }

  /**
   * Sync a trade to AI-Trader (provider mode)
   */
  async syncTrade(trade: AITraderTradeSync): Promise<AITraderResponseData<AITraderTradeSync>> {
    return this.post("/trades/sync", trade);
  }

  /**
   * Get signals from a followed agent (copy-trade mode)
   */
  async getFollowedSignals(agentId: string): Promise<AITraderResponseData<AITraderSignal[]>> {
    return this.get(`/agents/${agentId}/signals`);
  }

  /**
   * Create or update a copy-trade configuration
   */
  async setCopyTradeConfig(config: AITraderCopyTradeConfig): Promise<AITraderResponseData<AITraderCopyTradeConfig>> {
    return this.post("/copytrade/config", config);
  }

  /**
   * Get active copy-trade configs for this agent
   */
  async getCopyTradeConfigs(followerId: string): Promise<AITraderResponseData<AITraderCopyTradeConfig[]>> {
    return this.get(`/copytrade/configs/${followerId}`);
  }

  /**
   * Post a discussion/collaboration message
   */
  async postCollaboration(collab: AITraderCollaboration): Promise<AITraderResponseData<AITraderCollaboration>> {
    return this.post("/discussions/post", collab);
  }

  /**
   * Get market intel for a symbol
   */
  async getMarketIntel(symbol: string): Promise<AITraderResponseData<AITraderMarketIntel>> {
    return this.get(`/market/intel/${symbol}`);
  }

  /**
   * Get agent leaderboard/top performers
   */
  async getLeaderboard(limit: number = 20): Promise<AITraderResponseData<AITraderAgentProfile[]>> {
    return this.get(`/leaderboard?limit=${limit}`);
  }

  /**
   * Health check - verify AI-Trader connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get("/health");
      return response.success === true;
    } catch {
      return false;
    }
  }

  /**
   * Generic GET request
   */
  private async get<T>(endpoint: string): Promise<AITraderResponseData<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as AITraderResponseData<T>;
    } catch (error) {
      console.error(`[AITraderClient] GET ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Generic POST request
   */
  private async post<T>(endpoint: string, data: unknown): Promise<AITraderResponseData<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as AITraderResponseData<T>;
    } catch (error) {
      console.error(`[AITraderClient] POST ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get HTTP headers with API key
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }
}

// Export singleton instance
export const aiTraderClient = new AITraderClient();
export default aiTraderClient;
