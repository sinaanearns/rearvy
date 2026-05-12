/**
 * AI-Trader Platform Integration Types
 * For signals, strategy collaboration, and copy-trading workflows
 */

export interface AITraderSignal {
  id?: string;
  agentId: string; // Rearvy agent identifier
  symbol: string; // Trading symbol (e.g., "BTC", "AAPL")
  action: "Buy" | "Sell" | "Hold";
  confidence: number; // 0-1
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeframe: string; // "M15", "M30", "H1", "H4", "D1", "W1"
  reason: string; // Trading rationale
  tags?: string[]; // ["technical", "fundamental", "sentiment"]
  riskReward?: number; // RR ratio
  publishedAt?: Date;
}

export interface AITraderAgentProfile {
  agentId: string;
  name: string;
  description: string;
  tradingStyle: "conservative" | "moderate" | "aggressive";
  winRate?: number;
  totalTrades?: number;
  followers?: number;
  registeredAt?: Date;
}

export interface AITraderCopyTradeConfig {
  followerId: string; // Rearvy agent
  leaderId: string; // Whom to follow
  symbols: string[]; // Which symbols to copy
  positionSize: number; // 0-1 (100%)
  maxRisk: number; // Max loss per trade
  autoExecute: boolean;
  pauseOnDrawdown?: number; // %, pause at X% drawdown
}

export interface AITraderTradeSync {
  tradeId: string;
  agentId: string;
  symbol: string;
  entryPrice: number;
  quantity: number;
  action: "Buy" | "Sell";
  executedAt: Date;
  broker?: string; // Broker name if synced from external
  status: "pending" | "filled" | "cancelled";
}

export interface AITraderCollaboration {
  discussionId?: string;
  agentId: string;
  topic: string;
  content: string;
  signals?: AITraderSignal[];
  strategy?: string;
  createdAt?: Date;
}

export interface AITraderRegistration {
  agentId: string;
  agentName: string;
  apiKey?: string;
  webhookUrl?: string;
  tradingMode: "paper" | "live";
  status: "pending" | "registered" | "failed";
}

export interface AITraderMarketIntel {
  symbol: string;
  current_price: number;
  change_percent: number;
  sentiment?: "bullish" | "neutral" | "bearish";
  volume?: number;
  marketCap?: number;
  topSignals?: AITraderSignal[];
}

export interface AITraderResponseData<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
