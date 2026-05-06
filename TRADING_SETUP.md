# Trading Copilot - Quick Setup Guide

## Installation & Configuration

### Step 1: Environment Variables

Add to `.env.local`:

```bash
# Internal API authentication (for Cloud Function)
INTERNAL_API_SECRET=your-random-secret-key-min-32-chars-recommended

# Market Data Provider (choose one)
# For Alpha Vantage:
VITE_ALPHA_VANTAGE_API_KEY=your-key

# For Polygon:
VITE_POLYGON_API_KEY=your-key

# For CoinGecko (free tier, no key needed):
VITE_COINGECKO_ENABLED=true
```

### Step 2: Firestore Indexes

This repository now includes [firestore.indexes.json](firestore.indexes.json) with trading monitor composite indexes.

Create the following composite indexes in Firestore Console:

**Collection: `users/{userId}/trading_monitors`**

| Field | Mode | Status |
| ------- | ------ | -------- |
| `isActive` | Ascending | Index 1 |
| `nextPollAt` | Ascending | Index 1 |
| `startedAt` | Descending | Index 2 |

Or use the CLI:

```bash
firebase firestore:indexes:create trading_monitors.json
```

### Step 3: Firestore Security Rules

This repository now includes [firestore.trading.rules](firestore.trading.rules) as a trading-specific ruleset.
Merge those rules into your main [firestore.rules](firestore.rules) before production deploy.

Update your `firestore.rules`:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Trading monitors access
    match /users/{userId}/trading_monitors/{monitorId} {
      allow read: if request.auth.uid == userId;
      allow create: if request.auth.uid == userId &&
                       request.resource.data.user_id == userId &&
                       request.resource.data.isActive == true;
      allow update, delete: if request.auth.uid == userId &&
                               resource.data.user_id == userId;
    }
    
    // Audit logs access
    match /users/{userId}/trading_audit_log/{auditId} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

Deploy:

```bash
firebase deploy --only firestore:rules
```

### Step 4: Production Scheduler Setup

This repository now includes an executable scheduler setup script:

- [scripts/trading/setup-scheduler.mjs](scripts/trading/setup-scheduler.mjs)

It creates or updates a Cloud Scheduler job that calls:

- POST /api/internal/trading/monitor-jobs/run

Required environment variables before running setup:

```bash
GOOGLE_CLOUD_PROJECT=<your-project-id>
REARVY_APP_URL=https://www.rearvy.com
INTERNAL_API_SECRET=<same-secret-used-by-app-runtime>
```

Optional environment variables:

```bash
TRADING_SCHEDULER_LOCATION=us-central1
TRADING_SCHEDULER_JOB_NAME=trading-monitor-runner
TRADING_SCHEDULER_CRON=*/1 * * * *
TRADING_SCHEDULER_TIME_ZONE=UTC
TRADING_SCHEDULER_DEADLINE=300s
```

Run setup:

```bash
npm run trading:setup-scheduler
```

Manual cycle trigger (for smoke tests):

```bash
npm run trading:run-cycle
```

### Step 5: Add Trading System Prompt to Chat

Update `src/app/api/chat/route.ts` to inject trading system prompt when appropriate:

```typescript
import { getTradingSystemPrompt } from '@/lib/ai/system-prompts/trading';

// In your chat system prompt building logic:
const isTradingSession = message?.includes('trade') || message?.includes('crypto');

const systemPrompt = isTradingSession 
  ? getTradingSystemPrompt()
  : DEFAULT_SYSTEM_PROMPT;
```

### Step 6: Integrate Trading Tool

Update `src/app/api/chat/route.ts` to include trading opinion tool:

```typescript
import { getTradingOpinionToolEntry } from '@/lib/ai/tools/trading-opinion';

// Build tools object:
const tools = {
  ...existingTools,
  ...getTradingOpinionToolEntry(),
  // ... other tools
};
```

### Step 7: Optional TradingAgents Main Logic

Rearvy's `getTradingOpinion` tool now attempts TauricResearch TradingAgents first and falls back to Rearvy's built-in guarded engine when the Python backend is unavailable or returns an invalid opinion.

Install TradingAgents:

```bash
npm run trading:agents:install
```

Configure `.env.local`:

```bash
TRADINGAGENTS_ENABLED=true
TRADINGAGENTS_PYTHON=python
TRADINGAGENTS_ANALYSTS=market,news
TRADINGAGENTS_TIMEOUT_MS=90000

# Pick one provider/key pair supported by TradingAgents:
TRADINGAGENTS_LLM_PROVIDER=openai
OPENAI_API_KEY=your-key

# Optional: use a local clone instead of the installed package
TRADINGAGENTS_REPO_PATH=C:\path\to\TradingAgents
```

For faster or cheaper runs, keep `TRADINGAGENTS_ANALYSTS=market,news`. Add `social` or `fundamentals` only when you want the fuller TradingAgents workflow and can tolerate higher latency.

---

## Testing the System

### 1. Test Opinion Generation

```bash
# In chat UI, ask:
"What do you think about BTC/USD on the 1-hour timeframe?"

# Expected: TradingOpinionCard appears with:
# - Action (Buy/Sell/Hold)
# - Confidence percentage
# - Reasoning
# - Entry/Stop/TP levels
```

### 2. Test Monitor Creation

```bash
# Click "Start Monitor" on the card
# Check Firestore:
# - Document created in users/{userId}/trading_monitors/{id}
# - isActive = true
# - lastUpdatedAt = now

# UI: Badge should show 🟢 Monitoring
```

### 3. Test Monitor Polling

```bash
# Manually trigger Cloud Function:
curl -X POST https://<YOUR_CLOUD_FUNCTION_URL> \
  -H "x-internal-token: $INTERNAL_API_SECRET" \
  -H "Content-Type: application/json"

# Check Firestore:
# - lastUpdatedAt updated
# - lastAction & lastConfidence populated
# - nextPollAt set for next poll time

# Check chat:
# - New message appended if action changed
```

### 4. Test Monitor Stop

```bash
# Click "Stop Monitor" on the card
# Check Firestore:
# - isActive = false

# UI: Badge should show ⚪ Not Monitoring
```

---

## Monitoring & Debugging

### View Monitor Jobs in Cloud Function Logs

```bash
gcloud functions log read tradingMonitorRunner --limit 50
```

### Query Active Monitors

```bash
# Firestore Console > Queries
db.collection('users').doc(userId)
  .collection('trading_monitors')
  .where('isActive', '==', true)
  .get()
```

### Check Audit Logs

```bash
# View all trading events for a user
db.collection('users').doc(userId)
  .collection('trading_audit_log')
  .orderBy('timestamp', 'desc')
  .limit(20)
  .get()
```

### Monitor Error Rate

```typescript
// In Cloud Function logs, look for:
// [Monitor] Error processing monitor
// [Monitor Runner] Error during cycle
```

---

## Common Issues & Fixes

### Issue: Monitor not updating

**Symptoms:** `lastUpdatedAt` not changing after scheduler runs

**Fixes:**

1. Verify `INTERNAL_API_SECRET` in Cloud Function config
2. Check Cloud Scheduler job is enabled and running
3. Look at Cloud Function logs for auth errors
4. Ensure Firestore indexes are created

### Issue: Opinion not generating

**Symptoms:** No TradingOpinionCard appears, or empty card

**Fixes:**

1. Check OpenAI API key is valid
2. Verify trading system prompt is injected
3. Look for validation errors in browser console
4. Check Chat API logs for tool execution errors

### Issue: Per-user limit enforced incorrectly

**Symptoms:** Can't create monitor even though <3 active

**Fixes:**

1. Check Firestore query: `where('isActive', '==', true)`
2. Verify security rules allow reading monitors
3. Look at API response error message

### Issue: High Cloud Function execution time

**Symptoms:** Function takes >30s to complete a cycle

**Fixes:**

1. Reduce number of collection group queries
2. Add batch processing for multiple users
3. Consider read replicas in different regions
4. Increase Cloud Function memory to 1GB

---

## Production Hardening

### Before Going Live

- [ ] Complete all unit tests (90%+ coverage)
- [ ] Shadow deploy runner for 48 hours
- [ ] Set up monitoring alerts (error rate, latency)
- [ ] Enable Firestore backup
- [ ] Test Firestore restore procedure
- [ ] Set budget alerts for API costs
- [ ] Document runbooks for common issues
- [ ] Train support team on guardrails & safety
- [ ] Audit system prompts for compliance
- [ ] Set per-user rate limits on opinion generation

### Runtime Monitoring

Set up alerts in Cloud Monitoring:

```text
Alert: trading_monitor_runner_failures > 3 in 5 min
Alert: trading_opinion_generation_error_rate > 5%
Alert: trading_runner_duration > 30 seconds
Alert: trading_monitor_count > 10,000 (cost spike)
```

---

## Next Steps (Phase 6: Qlib Integration)

Once MVP is stable:

1. Deploy Qlib service in Docker container
2. Create `services/qlib-signal-provider/main.py`
3. Set up bridge API: `/api/internal/qlib/signals`
4. Implement shadow mode comparison logging
5. Run validation for 48-72 hours
6. If validation passes, enable via feature flag

---

## Support & Troubleshooting

For issues, check:

1. Cloud Function logs: `gcloud functions log read`
2. Firestore audit logs: `trading_audit_log` collection
3. Browser console for API errors
4. Chat API response format
5. OpenAI API usage in OpenAI dashboard

---

**Estimated Setup Time:** 30-45 minutes (once credentials ready)

**Cost Impact:** ~$1-2/day for 100-1000 monitors with typical polling patterns
