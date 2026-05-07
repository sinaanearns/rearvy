/**
 * Trading Copilot Type Definitions
 * Strict schema for AI-generated trading opinions with structured outputs
 */

export type TradingAction = 'Buy' | 'Sell' | 'Hold';
export type Timeframe = 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1';

export interface TradingResearchSource {
  title: string;
  url: string;
  source: string;
}

/**
 * Core trading opinion output from the AI
 * This is the strict JSON contract enforced by OpenAI JSON mode
 */
export interface TradingOpinion {
  // Core recommendation
  action: TradingAction;
  confidence: number; // 0 to 1
  reason: string; // Concise explanation (e.g., "Trend up on daily; fundamentals weak; recommend Sell")

  // Market context
  symbol: string; // e.g., "BTC/USD", "AAPL"
  timeframe: Timeframe;
  
  // Entry/Exit levels (optional, but recommended)
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;

  // Risk assessment
  riskNotes: string; // e.g., "High volatility. FDA approval pending could change fundamentals."
  
  // Data freshness
  fetchedAt: number; // Unix timestamp (ms) when data was fetched

  // Evidence metadata
  marketDataSource?: string; // e.g., "Binance", "Yahoo Finance"
  researchSummary?: string; // Summary of current public-web research used
  researchSources?: TradingResearchSource[]; // Public sources used to validate the trade
  researchBias?: 'bullish' | 'bearish' | 'mixed' | 'neutral';
  newsSentimentScore?: number; // -1 to 1 (bearish to bullish)
  newsBullishCount?: number; // Number of bullish news sources
  newsBearishCount?: number; // Number of bearish news sources
  newsConsensus?: number; // 0 to 1 directional agreement across news sources
  practicalAnalysis?: string; // Concise what-to-do-next guidance
  supportLevel?: number; // Near-term practical support
  resistanceLevel?: number; // Near-term practical resistance
  invalidationLevel?: number; // Level that invalidates the setup
  setupType?: 'trend' | 'reversal' | 'breakout' | 'mean_reversion' | 'wait';
  
  // Metadata
  model?: string; // e.g., "gpt-4-turbo" for tracking
  sessionId?: string; // For correlating with chat session
}

/**
 * Error case: when opinion cannot be generated
 */
export interface TradingOpinionError {
  action: 'Hold';
  confidence: 0;
  reason: string; // Clear explanation of why (e.g., "Data is stale (>1 hour old). No trade recommendation issued.")
  symbol: string;
  timeframe: Timeframe;
  riskNotes: string;
  fetchedAt: number;
  error: string; // Machine-readable error code
  errorDetails?: string; // Human-readable details
}

/**
 * Monitor record stored in Firestore
 * Tracks active trade monitoring with metadata
 */
export interface TradingMonitor {
  id: string; // Auto-generated Firestore doc ID
  user_id: string; // Links to user
  chat_id: string; // Links to conversation
  
  // Trade metadata from opinion
  symbol: string;
  timeframe: Timeframe;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  
  // Monitor state
  isActive: boolean;
  
  // Timestamps
  startedAt: number; // When monitor was created
  lastUpdatedAt: number; // Last time this record was modified
  lastFetchedAt?: number; // Last successful data fetch
  
  // Last observed state
  lastAction?: TradingAction;
  lastConfidence?: number;
  
  // Polling & retry state
  errorCount: number; // Consecutive errors
  error?: string; // Last error message
  nextPollAt?: number; // When to next check data (reactive polling)
}

/**
 * Monitor update event posted to chat
 * When action or confidence changes significantly
 */
export interface MonitorUpdateMessage {
  type: 'monitor_update';
  monitorId: string;
  symbol: string;
  timeframe: Timeframe;
  previousAction?: TradingAction;
  currentAction: TradingAction;
  currentConfidence: number;
  reason: string;
  timestamp: number;
  fetchedAt: number;
}

/**
 * Shadow mode validation log (Phase 6)
 * Tracks comparison between baseline and Qlib opinions
 */
export interface QlibShadowLog {
  id: string;
  user_id: string;
  symbol: string;
  timeframe: Timeframe;
  baselineOpinion: TradingOpinion;
  qlibSignal: QlibSignal;
  alignment: 'match' | 'diverge'; // Actions match or differ
  confidenceDelta: number; // abs(baseline.confidence - qlib.confidence)
  timestamp: number;
}

/**
 * Qlib signal response (Phase 6)
 */
export interface QlibSignal {
  signal: number; // Numeric signal between -1 and 1
  bias: 'bullish' | 'neutral' | 'bearish';
  confidence: number; // 0 to 1
  modelVersion: string; // e.g., "v3.2"
  computedAt: number; // Unix timestamp
  isStale: boolean; // True if data is >1 hour old
  explanation?: string; // Optional context from Qlib
}

/**
 * Guardrail configuration
 */
export interface GuardailConfig {
  maxMonitorsPerUser: number; // Default: 3
  minPollingIntervalMs: number; // Default: 60000 (60s)
  confidenceThresholdForUpdate: number; // Default: 0.1 (10%)
  stalePlanetDataThresholdMs: number; // Default: 3600000 (1 hour)
  maxErrorCountBeforePause: number; // Default: 3
  maxBackoffIntervalMs: number; // Default: 3600000 (1 hour)
  auditLogRetentionDays: number; // Default: 90
}

/**
 * Audit log entry for compliance
 */
export interface TradingAuditLog {
  id: string;
  user_id: string;
  chat_id?: string;
  monitor_id?: string;
  event_type: 'opinion_generated' | 'monitor_created' | 'monitor_stopped' | 'action_changed' | 'error' | 'fallback';
  symbol?: string;
  action?: TradingAction;
  confidence?: number;
  reason?: string;
  error_code?: string; // If error event
  fallback_reason?: string; // If fallback to Hold
  timestamp: number;
  metadata?: Record<string, unknown>; // Additional context
}
