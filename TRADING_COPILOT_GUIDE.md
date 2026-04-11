# Trading Copilot Implementation Guide

## Overview

A responsible AI trading copilot that provides Buy/Sell/Hold recommendations and continuously monitors open trades with **strict guardrails** and **safe deployment patterns**.

**Key Principles:**
- ✅ Structured JSON outputs (OpenAI JSON mode)
- ✅ Reactive polling (efficient resource usage)
- ✅ Safe fallbacks (Hold on stale/missing data)
- ✅ Per-user limits & cooldowns
- ✅ Comprehensive audit logging
- ✅ Shadow mode validation for Qlib integration

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                       │
│  • Trading Opinion Card                                       │
│  • Monitor Start/Stop Controls                               │
│  • Real-time Status Badges                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                    Chat Integration Layer                     │
│  • Card Router (tradingOpinion → TradingOpinionCard)         │
│  • Message Bubble (💡 header for opinions)                  │
│  • Monitor Status Polling Hook                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                    Business Logic Layer                       │
│  • Opinion Engine (with guardrails)                          │
│  • Monitor Jobs Runner (Cloud Function)                      │
│  • Reactive Polling Strategy                                │
│  • Guardrails Enforcement                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                    Data & API Layer                           │
│  • Firestore: trading_monitors collection                   │
│  • POST /api/trading/monitors (create)                      │
│  • PATCH /api/trading/monitors/{id} (stop/resume)          │
│  • POST /api/internal/trading/monitor-jobs/run (internal)  │
│  • GET /api/trading/monitors (list)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                    External Services                          │
│  • OpenAI (JSON mode for structured outputs)                │
│  • Market Data Provider (Alpha Vantage, Polygon, etc.)     │
│  • Qlib (Phase 6: Analytics, backtesting, ML models)       │
└──────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Type Definitions (`src/types/trading.ts`)

**TradingOpinion** — AI's opinion on a trade
```typescript
{
  action: 'Buy' | 'Sell' | 'Hold';
  confidence: 0.0 - 1.0;
  reason: string;
  symbol: string;
  timeframe: 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1';
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskNotes: string;
  fetchedAt: timestamp;
}
```

**TradingMonitor** — Active trade being monitored
```typescript
{
  id: string;
  user_id: string;
  chat_id: string;
  symbol: string;
  isActive: boolean;
  lastAction?: string;
  lastConfidence?: number;
  errorCount: number;
  nextPollAt?: number; // Reactive polling timing
}
```

### 2. Opinion Engine (`src/lib/trading/opinion-engine.ts`)

Core logic for generating opinions with guardrails:
- `computeOpinion()` — Generates opinion from market data
- `validateOpinion()` — Schema validation + profit promise checks
- `createFallbackHoldOpinion()` — Safe default on stale/missing data
- `calculateNextPollInterval()` — Reactive polling strategy
- `shouldUpdateOnConfidenceChange()` — Prevents spam

**Reactive Polling Strategy:**
```
Data Change: Poll every 30s (active monitoring)
Within 5 min of last change: Poll every 60s  
Within 30 min: Poll every 120s
Quiet periods: 240s, cap at 15 min (cost optimization)
Errors: Exponential backoff (30s → 60s → 120s... cap 1 hour)
```

### 3. Trading Opinion Tool (`src/lib/ai/tools/trading-opinion.ts`)

AI tool that generates structured trading opinions:
- Uses **OpenAI JSON mode** for guaranteed schema compliance
- Input: `{ symbol, timeframe, marketData? }`
- Output: Strict `TradingOpinion` JSON only

```typescript
const opinion = await tradingOpinionTool().execute({
  symbol: 'BTC/USD',
  timeframe: 'H1',
  marketData: { currentPrice: 45000, trend: 'up', ... }
});
// Returns: { action: 'Buy', confidence: 0.72, reason: '...', ... }
```

### 4. Trading Opinion Card (`src/components/data-cards/trading-opinion-card.tsx`)

**Features:**
- ✅ Action badge (Buy=green, Sell=red, Hold=gray)
- ✅ Confidence bar & percentage
- ✅ Reasoning & risk notes
- ✅ Entry/Stop/TP levels
- ✅ Start/Stop Monitor buttons
- ✅ Monitor status badge (🟢 Active, ⚪ Inactive, 🔴 Error)
- ✅ Data freshness timestamp

**Usage:**
```jsx
<TradingOpinionCard 
  opinion={tradingOpinion} 
  chatId={chatId}
  onMonitorStatusChange={handleStatusChange}
/>
```

### 5. Monitor Data Model (`src/lib/firebase/trading-monitors-schema.ts`)

Firestore schema & converters:
- Collection: `users/{userId}/trading_monitors/{monitorId}`
- Indexes: `(userId, isActive)`, `(userId, startedAt)`
- Converter: `tradingMonitorConverter` (serialization/deserialization)
- Helpers: `createNewMonitor()`, `updateMonitorWithOpinion()`, `stopMonitor()`, `resumeMonitor()`

**Firestore Rules (required):**
```rules
match /users/{userId}/trading_monitors/{monitorId} {
  allow read: if request.auth.uid == userId;
  allow create: if request.auth.uid == userId &&
                   request.resource.data.user_id == userId;
  allow update, delete: if request.auth.uid == userId &&
                           resource.data.user_id == userId;
}
```

### 6. Monitor APIs

**POST /api/trading/monitors** — Create monitor
- Request: `{ chatId, symbol, timeframe, entry?, stopLoss?, takeProfit? }`
- Response: `{ monitorId, isActive, startedAt }`
- Enforces: 3-monitor per-user limit

**PATCH /api/trading/monitors/{id}** — Stop/resume
- Request: `{ isActive: boolean }`
- Response: `{ success, monitorId, isActive }`
- Auth: User ownership Check

**GET /api/trading/monitors** — List monitors
- Query: `?chatId=xxx&activeOnly=true`
- Response: `{ monitors: TradingMonitor[] }`

**POST /api/internal/trading/monitor-jobs/run** — Internal runner
- Header: `x-internal-token: <INTERNAL_API_SECRET>`
- Called by Cloud Function every 1 minute
- Response: `{ jobsProcessed, updated, errored, duration }`

### 7. Monitor Runner (`src/lib/trading/monitor-jobs.ts`)

Background job that polls active monitors:
```typescript
async function runMonitorCycle(db: Firestore): Promise<MonitorCycleResult>
```

**Per Monitor:**
1. Fetch minimal market data (reactive check)
2. If data is stale, skip (retry in 5 min)
3. Compute new opinion
4. Compare to `lastAction` & `lastConfidence`
5. If update needed, append message to chat
6. Update monitor with new state + next poll time
7. On error: exponential backoff

### 8. Guardrails (`src/lib/trading/guardrails.ts`)

Safety enforcement:
- `enforcePerUserLimits()` — Max 3 active monitors
- `enforceOpinionCooldown()` — Min 60s between updates
- `validateOpinionText()` — Detect profit promises
- `logTradingAction()` — Audit compliance
- `shouldPauseMonitor()` — Pause after 3 errors

### 9. Monitor Status Hook (`src/hooks/use-monitor-status.ts`)

Client-side polling for real-time monitor status:
```typescript
const { statusMap, startMonitoring, stopMonitoring, getStatus } = 
  useMonitorStatus(userId, { chatId, pollIntervalMs: 7000 });
```

---

## System Prompt (`src/lib/ai/system-prompts/trading.ts`)

**Key Constraints:**
```
✓ Output ONLY JSON (no markdown, no commentary)
✓ Never promise profits ("you will make money" forbidden)
✓ Fallback to Hold on stale/missing data
✓ Explicit uncertainty statements
✓ Risk disclaimers always included
✓ Concise reasoning (explain technical + fundamental factors)
```

**Example Output:**
```json
{
  "action": "Buy",
  "confidence": 0.72,
  "reason": "BTC broke $45k resistance on strong volume. RSI 60-70 suggests momentum. Caution: Fed rate decision Thu could reverse.",
  "symbol": "BTC/USD",
  "timeframe": "H1",
  "entry": 45000,
  "stopLoss": 43500,
  "takeProfit": 48000,
  "riskNotes": "High volatility. Geopolitical risk. Short-term trade only.",
  "fetchedAt": 1712976543123
}
```

---

## Deployment Checklist

### Phase 1-5 (MVP)

- [ ] Types: `src/types/trading.ts` ✅
- [ ] System Prompt: `src/lib/ai/system-prompts/trading.ts` ✅
- [ ] Opinion Tool: `src/lib/ai/tools/trading-opinion.ts` ✅
- [ ] Opinion Engine: `src/lib/trading/opinion-engine.ts` ✅
- [ ] Trading Opinion Card: `src/components/data-cards/trading-opinion-card.tsx` ✅
- [ ] Card Router: Updated to route `tradingOpinion` ✅
- [ ] Message Bubble: Added "💡 Trading Opinion" header ✅
- [ ] Firestore Schema: `src/lib/firebase/trading-monitors-schema.ts` ✅
- [ ] Monitor APIs: `/api/trading/monitors/*` ✅
- [ ] Monitor Runner: `src/lib/trading/monitor-jobs.ts` ✅
- [ ] Guardrails: `src/lib/trading/guardrails.ts` ✅
- [ ] Monitor Status Hook: `src/hooks/use-monitor-status.ts` ✅

### Configuration Required

1. **Environment Variables:**
   ```
   INTERNAL_API_SECRET=<random-strong-secret>
   OPENAI_API_KEY=<for-json-mode>
   MARKET_DATA_PROVIDER_API_KEY=<if-using-external>
   ```

2. **Firestore Indexes:**
   - `users/{userId}/trading_monitors` on `(isActive, nextPollAt)`
   - `users/{userId}/trading_monitors` on `(isActive, startedAt)`

3. **Firestore Security Rules:**
   ```rules
   match /users/{userId}/trading_monitors/{monitorId} {
     allow read: if request.auth.uid == userId;
     allow create: if request.auth.uid == userId && 
                      request.resource.data.user_id == userId;
     allow update, delete: if request.auth.uid == userId;
   }
   ```

4. **Cloud Function:**
   - Create Cloud Scheduler trigger to POST to `/api/internal/trading/monitor-jobs/run` every 1 minute
   - Pass header: `x-internal-token: $INTERNAL_API_SECRET`

5. **AI Library Integration:**
   - Ensure OpenAI JSON mode is enabled in chat route
   - System prompt: `getTradingSystemPrompt()` injected for trading sessions

---

## Testing

### Unit Tests

```bash
# Opinion engine guardrails
npm test src/__tests__/trading-opinion.test.ts

# Opinion schema validation
npm test src/__tests__/trading-opinion-validation.test.ts

# Monitor jobs logic
npm test src/__tests__/trading-monitor-jobs.test.ts

# Guardrails enforcement
npm test src/__tests__/trading-guardrails.test.ts

# Polling strategy
npm test src/__tests__/trading-polling-strategy.test.ts
```

### Manual Testing

1. **Opinion Generation:**
   - Send: "What do you think of BTC/USD on 1H?"
   - Expect: Card with Buy/Sell/Hold, confidence bar, entry/exit levels

2. **Monitor Creation:**
   - Click "Start Monitor" button
   - Expect: Monitor created in Firestore, badge → 🟢 Active

3. **Cloud Function Trigger:**
   - Manually invoke Cloud Function or wait for scheduled trigger
   - Check Firestore `trading_monitors` for `lastUpdatedAt` timestamp update

4. **Monitor Stop:**
   - Click "Stop Monitor" button
   - Expect: Badge → ⚪ Inactive, `isActive=false` in Firestore

---

## Monitoring & Observability

### Key Metrics

```typescript
trading.opinions.generated (counter)
trading.monitors.active (gauge)
trading.monitor.update_latency (histogram ms)
trading.api.error_rate (percent)
trading.runner.job_duration (histogram ms)
```

### Logging

All events logged to `trading_audit_log` collection:
- Opinion generated
- Monitor created/stopped
- Errors (stale data, API failure, etc.)
- Fallback to Hold (reason)

### Alerts (set via Sentry/CloudWatch)

- ⚠️ Monitor runner fails >3x in 5 min
- ⚠️ API error rate >5% for >10 min
- ⚠️ Average monitor latency >30s
- ⚠️ Unusually high error count on specific symbol

---

## Phase 6: Qlib Integration (Future)

**Shadow Mode Approach:**
1. Deploy Qlib service in Docker container
2. Create `/api/internal/qlib/signals` bridge
3. Monitor runner fetches Qlib signal in parallel with baseline
4. Log comparisons to `shadow_mode_log` (no user-facing changes yet)
5. Validate: Qlib agreement > 60%, backtest differential > +5%
6. Once validated, feature flag `ENABLE_QLIB_MODE=true` to include Qlib insights

---

## Safety & Compliance

**Never:**
- Promise profits or guaranteed returns
- Ignore or hide stale data
- Execute actual trades (recommendations only)
- Expose raw model internals to users

**Always:**
- Fall back to Hold on missing/stale data with explicit reason
- Use probabilistic language ("appears to", "suggests")
- Include risk disclaimers
- Log all opinions and events for audit trail
- Enforce per-user limits & cooldowns
- Validate schema before user display

---

## Troubleshooting

### Monitor not updating

1. Check `isActive=true` in Firestore
2. Verify Cloud Function is scheduled and running (check logs)
3. Confirm `INTERNAL_API_SECRET` env var matches in Cloud Function config
4. Monitor `errorCount` — if >3, monitor may be auto-paused

### Opinion not generating

1. Check OpenAI API key configured
2. Verify system prompt includes trading constraints
3. Look for validation errors in console logs
4. If market data missing, opinion will be Hold (expected)

### High error rate

1. Check market data provider API key & rate limits
2. Verify Firestore connectivity & quotas
3. Ensure indexes created on `trading_monitors` collection
4. Review error logs in `trading_audit_log`

---

## Future Enhancements

- [ ] Email/Slack alerts on significant action changes
- [ ] Custom per-user monitor limits (subscription tier)
- [ ] Multi-timeframe correlation analysis
- [ ] Advanced charting & technical indicators
- [ ] Sentiment analysis from news/social
- [ ] Mobile app companion
- [ ] Broker integration (for paper trading, not real execution)
- [ ] Community trade sharing & performance leaderboards
