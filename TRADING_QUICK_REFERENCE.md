# Trading Copilot - Quick Reference

## 🎯 System Overview

A responsible AI trading copilot that generates Buy/Sell/Hold opinions and monitors active trades with strict guardrails.

**Status:** ✅ **MVP Complete** (Phases 1-5)  
**Lines of Code:** ~2,530+ TypeScript  
**Files Created:** 14 new files  
**Files Updated:** 3 existing files  

---

## 🏗️ Architecture Stack

```
User Interface
├── TradingOpinionCard (opinion display + monitor controls)
├── Card Router (tradingOpinion → card routing)
└── Message Bubble (💡 header + chatId propagation)
         ↓
Chat Integration
├── useMonitorStatus Hook (client-side polling)
├── Monitor Status Polling (5-10s intervals)
└── Chat Messages (update notifications)
         ↓
Business Logic
├── Opinion Engine (guardrails, fallbacks)
├── Monitor Runner (Cloud Function)
├── Guardrails (limits, cooldowns, audit)
└── Polling Strategy (reactive, adaptive)
         ↓
Data & APIs
├── Firestore (trading_monitors collection)
├── POST /api/trading/monitors (create)
├── PATCH /api/trading/monitors/{id} (stop)
├── GET /api/trading/monitors (list)
└── POST /api/internal/trading/monitor-jobs/run (runner)
         ↓
External
├── NVIDIA Integrate API (JSON-compatible mode)
├── Market Data Provider (price, indicators)
└── Cloud Functions (scheduler)
```

---

## 📁 Key Files

| Purpose | File | Lines |
|---------|------|-------|
| Types | `src/types/trading.ts` | 200+ |
| System Prompt | `src/lib/ai/system-prompts/trading.ts` | 150+ |
| Opinion Tool | `src/lib/ai/tools/trading-opinion.ts` | 80+ |
| Opinion Engine | `src/lib/trading/opinion-engine.ts` | 350+ |
| Monitor Jobs | `src/lib/trading/monitor-jobs.ts` | 400+ |
| Guardrails | `src/lib/trading/guardrails.ts` | 250+ |
| Firestore Schema | `src/lib/firebase/trading-monitors-schema.ts` | 200+ |
| Monitor APIs | `src/app/api/trading/monitors/route.ts` | 150+ |
| API Controls | `src/app/api/trading/monitors/[id]/route.ts` | 150+ |
| Runner Endpoint | `src/app/api/internal/trading/monitor-jobs/route.ts` | 120+ |
| Card Component | `src/components/data-cards/trading-opinion-card.tsx` | 300+ |
| Monitor Hook | `src/hooks/use-monitor-status.ts` | 250+ |

---

## 🔄 User Flow

```
1. User: "What about BTC/USD?"
        ↓
2. AI: Calls tradingOpinion tool
        ↓
3. Tool: Returns { action: 'Buy', confidence: 0.72, ... }
        ↓
4. Card: Renders with ✅ Start Monitor button
        ↓
5. User: Clicks "Start Monitor"
        ↓
6. API: POST /api/trading/monitors → Creates in Firestore
        ↓
7. UI: Badge → 🟢 Monitoring (status polling every 7s)
        ↓
8. Cloud Function (every 1 min):
   - Queries active monitors
   - Fetches market data
   - Re-runs opinion
   - Updates Firestore if action changed
   - Appends chat message
        ↓
9. User sees: 🔄 Monitor Update: BTC/USD → Sell
        ↓
10. User: Clicks "Stop Monitor"
        ↓
11. UI: Badge → ⚪ Not Monitoring, isActive=false
```

---

## ⚙️ Configuration

### Environment Variables
```bash
INTERNAL_API_SECRET=<random-min-32-chars>      # Cloud Function auth
VITE_ALPHA_VANTAGE_API_KEY=<key>               # Market data (optional Phase 1)
NVIDIA_API_KEY=<key>                           # For JSON mode
```

### Firestore Indexes
```
Collection: users/{userId}/trading_monitors
- Index 1: isActive (Asc), nextPollAt (Asc)
- Index 2: startedAt (Desc)
```

### Firestore Rules
```rules
match /users/{userId}/trading_monitors/{monitorId} {
  allow read: if request.auth.uid == userId;
  allow create: if request.auth.uid == userId;
  allow update, delete: if request.auth.uid == userId;
}
```

### Cloud Function (every 1 minute)
```bash
gcloud scheduler jobs create http trading-monitor-runner \
  --schedule="*/1 * * * *" \
  --uri="https://..../tradingMonitorRunner" \
  --http-method=POST \
  --headers="x-internal-token=$INTERNAL_API_SECRET"
```

---

## 🛡️ Guardrails

| Guardrail | Limit | Why |
|-----------|-------|-----|
| Active Monitors | 3 per user | Cost control, prevent confusion |
| Opinion Cooldown | 60s minimum | Prevent spam, AI confusion |
| Polling Interval | 30s-15m (adaptive) | Cost optimization |
| Error Tolerance | 3 consecutive | Auto-pause after failures |
| Data Staleness | 1 hour | Fallback to Hold if stale |
| Profit Promises | 0 allowed | Compliance, safety |

---

## 📊 Data Model

### TradingMonitor (Firestore)
```
{
  id: "uuid",
  user_id: "uid",
  chat_id: "chat123",
  symbol: "BTC/USD",
  timeframe: "H1",
  isActive: true,
  lastAction: "Buy",
  lastConfidence: 0.72,
  lastUpdatedAt: 1712976543123,
  nextPollAt: 1712976603123,         // Reactive polling time
  errorCount: 0,
  startedAt: 1712976543000
}
```

### TradingOpinion (JSON Output)
```
{
  action: "Buy" | "Sell" | "Hold",
  confidence: 0.0-1.0,
  reason: "Technical + fundamental analysis",
  symbol: "BTC/USD",
  timeframe: "H1",
  entry?: 45000,
  stopLoss?: 43500,
  takeProfit?: 48000,
  riskNotes: "Market risks...",
  fetchedAt: 1712976543123
}
```

---

## 🧪 Testing Checklist

### Phase 1: Opinion Generation
- [ ] Chat: "What about BTC/USD?"
- [ ] Result: TradingOpinionCard appears
- [ ] Card shows: Action, confidence, entry/exit, risk notes

### Phase 2: UI Integration
- [ ] Card renders with correct colors (Buy=green, Sell=red, Hold=gray)
- [ ] Confidence bar displays correctly
- [ ] Header shows "💡 Trading Opinion"

### Phase 3: Monitor Creation
- [ ] Click "Start Monitor"
- [ ] Check Firestore: Document created with `isActive=true`
- [ ] UI: Badge shows 🟢 Monitoring

### Phase 4: Monitor Polling
- [ ] Trigger Cloud Function manually
- [ ] CheckFirestore: `lastUpdatedAt` updated
- [ ] Check chat: New message appended if action changed

### Phase 5: Monitor Stopping
- [ ] Click "Stop Monitor"
- [ ] Check Firestore: `isActive=false`
- [ ] UI: Badge shows ⚪ Not Monitoring

---

## 🚀 Deployment Steps

1. **Create Firestore indexes**
   ```bash
   firebase firestore:indexes:create trading_monitors.json
   firebase deploy --only firestore:indexes
   ```

2. **Update Firestore rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

3. **Deploy Cloud Function**
   ```bash
   firebase deploy --only functions:tradingMonitorRunner
   ```

4. **Create Cloud Scheduler trigger**
   ```bash
   gcloud scheduler jobs create http trading-monitor-runner \
     --schedule="*/1 * * * *" \
     --uri="..." \
     --http-method=POST \
     --headers="x-internal-token=$INTERNAL_API_SECRET"
   ```

5. **Update environment variables**
   - `.env.local` for local dev
   - Firebase Projects settings for production

6. **Test end-to-end**
   - Generate opinion
   - Create monitor
   - Wait for Cloud Function run
   - Verify monitor update message

---

## 📈 Monitoring

### Key Metrics
- `trading.opinions.generated` — Per hour
- `trading.monitors.active` — Current count
- `trading.runner.duration` — Job execution time
- `trading.api.error_rate` — % failures

### Alerts
- Error rate > 5% for 10 min
- Runner duration > 30s
- Monitor count > 10,000 (cost spike)

### Debug
```bash
# View Cloud Function logs
gcloud functions log read tradingMonitorRunner

# Query active monitors
db.collection('users').doc(userId)
  .collection('trading_monitors')
  .where('isActive', '==', true).get()

# View audit logs
db.collection('users').doc(userId)
  .collection('trading_audit_log')
  .orderBy('timestamp', 'desc').limit(20).get()
```

---

## ⚠️ Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Monitor not updating | Cloud Function not running | Check Cloud Scheduler, auth token |
| Opinion not showing | API error | Check NVIDIA key, logs |
| Can't create monitor | At limit | Stop existing monitor (3 max) |
| High error rate | Market data unavailable | Check provider API key, rate limits |

---

## 📚 Documentation

- **`TRADING_COPILOT_GUIDE.md`** — Comprehensive architecture & implementation details
- **`TRADING_SETUP.md`** — Step-by-step deployment & configuration
- **`TRADING_MANIFEST.md`** — Complete file manifest & statistics

---

## 🔮 Phase 6: Qlib Integration (Future)

- Deploy Qlib service (Python container)
- Create bridge API: `/api/internal/qlib/signals`
- Implement shadow mode comparison
- Validate agreement > 60%, backtest differential > +5%
- Enable via feature flag: `ENABLE_QLIB_MODE=true`

---

## 📝 System Prompt Constraints

The AI is instructed to:
```
✓ Output ONLY JSON (no markdown, no commentary)
✓ Never promise profits ("you will make money" forbidden)
✓ Fallback to Hold on missing/stale data
✓ Use probabilistic language ("appears to", "suggests")
✓ Always include risk disclaimers
✓ Explain reasoning concisely (technical + fundamental)
```

---

## 🎓 Best Practices

1. **Always use reactive polling** — Saves ~70% of API calls during quiet periods
2. **Fallback to Hold on any uncertainty** — Never guess with incomplete data
3. **Log everything** — Audit trail essential for compliance
4. **Monitor costs** — Set budget alerts on API usage
5. **Test shadow mode first** — Validate new signals before production
6. **Use feature flags** — Enable/disable functionality without redeploys

---

## 📞 Support

For issues:
1. Check documentation (`TRADING_SETUP.md`, `TRADING_COPILOT_GUIDE.md`)
2. Review error logs (Cloud Function, Firestore audit)
3. Check browser console for API errors
4. Query Firestore `trading_audit_log` for event history
5. Verify configuration (env vars, indexes, rules)

---

**Last Updated:** April 2026  
**Version:** 1.0 (MVP - Phases 1-5 Complete)  
**Status:** ✅ Ready for Testing & Deployment
