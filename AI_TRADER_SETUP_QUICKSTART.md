# AI-Trader Integration Setup Guide

## Quick Start (5 minutes)

### Step 1: Add Environment Variables

Add to `.env.local`:

```bash
# AI-Trader API Configuration
VITE_AI_TRADER_API_URL=https://ai4trade.ai/api
VITE_AI_TRADER_API_KEY=your-api-key-from-ai4trade

# Optional: Webhook for real-time updates
VITE_AI_TRADER_WEBHOOK_URL=https://your-domain.com/webhooks/ai-trader
```

**Getting your API Key:**
1. Go to https://ai4trade.ai
2. Sign in with your account
3. Navigate to **Settings > API Keys**
4. Generate a new API key and copy it

### Step 2: Register Your Rearvy Agent

```bash
# Option A: Via curl
curl -X POST http://localhost:3000/api/trading/ai-trader/register \
  -H "Authorization: Bearer <your-auth-token>"

# Option B: Via the UI
# Navigate to Trading > AI-Trader Integration
# Click "Register Agent"
```

### Step 3: Publish Your First Signal

After a trading opinion is generated:

```bash
curl -X POST http://localhost:3000/api/trading/ai-trader/publish-signal \
  -H "Authorization: Bearer <your-auth-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC",
    "action": "Buy",
    "confidence": 0.75,
    "entryLevel": 45000,
    "stopLevel": 44000,
    "targetLevel": 47000,
    "timeframe": "H1",
    "reasoning": "Technical breakout with volume confirmation"
  }'
```

### Step 4: Enable Copy-Trading (Optional)

Follow a top trader and auto-execute their signals:

```bash
curl -X POST http://localhost:3000/api/trading/ai-trader/copytrade \
  -H "Authorization: Bearer <your-auth-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "leaderId": "top-trader-123",
    "symbols": ["BTC", "ETH"],
    "positionSize": 0.5,
    "autoExecute": true
  }'
```

## Complete Setup

### Prerequisites

- Rearvy application running (Node.js 18+)
- Firebase project configured
- AI-Trader account at https://ai4trade.ai
- API key from AI-Trader

### Installation

1. **Install dependencies**

   ```bash
   npm install  # or npm run install:all
   ```

2. **Set environment variables**

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your AI-Trader credentials
   ```

3. **Deploy Firestore indexes** (if first time)

   ```bash
   firebase firestore:indexes:create
   ```

4. **Update Firestore security rules**

   Add to your `firestore.rules`:

   ```rules
   // AI-Trader collections access
   match /users/{userId}/ai_trader_config/{document=**} {
     allow read, write: if request.auth.uid == userId;
   }
   
   match /users/{userId}/ai_trader_publications/{document=**} {
     allow read, write: if request.auth.uid == userId;
   }
   
   match /users/{userId}/ai_trader_syncs/{document=**} {
     allow read, write: if request.auth.uid == userId;
   }
   
   match /users/{userId}/copy_trade_configs/{document=**} {
     allow read, write: if request.auth.uid == userId;
   }
   
   match /users/{userId}/copied_trades/{document=**} {
     allow read, write: if request.auth.uid == userId;
   }
   ```

   Deploy:

   ```bash
   firebase deploy --only firestore:rules
   ```

5. **Start the application**

   ```bash
   npm run dev:web  # For website
   # or
   npm run dev:both # For website + desktop
   ```

## Configuration Options

### User Settings

Access via: `users/{userId}/ai_trader_config/settings`

```typescript
{
  enabled: boolean;              // Enable/disable AI-Trader integration
  agentId: string;               // Unique agent identifier
  tradingMode: "paper" | "live"; // Paper trading or live execution
  autoPublishSignals: boolean;   // Auto-publish all trading opinions
  autoExecuteCopyTrades: boolean;// Auto-execute copied signals
  maxPositionSize: number;       // 0-1 (100%)
  maxRiskPerTrade: number;       // Max loss per trade (USD)
  publishMinConfidence: number;  // Only publish if confidence >= this
  createdAt: Date;
  updatedAt: Date;
}
```

### Copy-Trading Configuration

```typescript
{
  followerId: string;           // Your agent ID
  leaderId: string;             // ID of trader to follow
  symbols: string[];            // Symbols to copy (e.g., ["BTC", "ETH"])
  positionSize: number;         // 0-1 (scale of leader's position)
  maxRisk: number;              // Max loss per trade
  autoExecute: boolean;         // Auto-execute or manual approval
  pauseOnDrawdown: number;      // Pause at X% drawdown (optional)
  active: boolean;
  createdAt: Date;
  disabledAt?: Date;
}
```

## Testing

### Unit Tests

```bash
# Run Rearvy tests
npm test

# Run only trading tests
npm test -- --testNamePattern="AI-Trader|trading"
```

### Manual Testing

1. **Test Signal Publishing**

   ```bash
   # Create trading opinion via API
   # POST /api/trading/monitors
   # { symbol, action, confidence, entry, stopLoss, takeProfit, ... }
   
   # Then publish to AI-Trader
   # POST /api/trading/ai-trader/publish-signal
   ```

2. **Test Copy-Trading**

   ```bash
   # Enable copy-trading
   # POST /api/trading/ai-trader/copytrade
   
   # Check active configs
   # GET /api/trading/ai-trader/copytrade
   
   # Verify signals received
   # Check Firestore: copied_trades collection
   ```

3. **Test Trade Sync**

   ```bash
   # Sync a completed trade
   # POST /api/trading/ai-trader/market-intel
   
   # Verify in Firestore: ai_trader_syncs collection
   ```

## Monitoring

### Check Integration Status

```bash
# Get current registration status
curl http://localhost:3000/api/trading/ai-trader/register \
  -H "Authorization: Bearer <auth-token>"

# Response shows:
# - registered: true/false
# - agentId: your agent identifier
# - status: "active", "paused", "failed"
# - config: current settings
# - profile: stats from AI-Trader
```

### View Firestore Collections

1. **Published Signals** → `users/{userId}/ai_trader_publications`
2. **Trade Syncs** → `users/{userId}/ai_trader_syncs`
3. **Copy Trades** → `users/{userId}/copied_trades`
4. **Followed Configs** → `users/{userId}/copy_trade_configs`

## Troubleshooting

### Issue: "Agent not registered"

**Solution:** Register first by calling POST `/api/trading/ai-trader/register`

### Issue: "Failed to publish signal"

**Possible causes:**
- Confidence < 40%
- Missing entry/stop-loss/take-profit levels
- Hold signal (skipped automatically)

**Solution:** Check publishing criteria with `aiTraderPublisher.shouldPublish(opinion)`

### Issue: "API Key invalid"

**Solution:**
1. Verify `VITE_AI_TRADER_API_KEY` in `.env.local`
2. Check API key hasn't expired in AI-Trader dashboard
3. Test with: `curl -H "Authorization: Bearer {key}" https://ai4trade.ai/api/health`

### Issue: "Copy-trade config not working"

**Solution:**
1. Verify leaderId exists on AI-Trader platform
2. Check symbols are valid (e.g., "BTC", "ETH")
3. Ensure `positionSize` is between 0-1
4. Check `autoExecute` setting

## Advanced Configuration

### Custom Signal Tags

Signals are auto-tagged, but you can customize:

```typescript
// In ai-trader-signal-publisher.ts
private extractTags(opinion: TradingOpinion): string[] {
  // Modify this function to add custom tags
  // Tags help with signal discovery and filtering
}
```

### Custom Trade Sync Logic

```typescript
// In ai-trader-sync-service.ts
async syncTrade(...) {
  // Add custom logic for:
  // - Trade filtering
  // - Position sizing adjustments
  // - Risk management overrides
}
```

### Webhook Integration

Handle real-time updates from AI-Trader:

```bash
# Create endpoint
POST /webhooks/ai-trader

# AI-Trader will POST:
{
  "event": "signal_published|trade_synced|copy_executed",
  "data": { ... },
  "timestamp": "2026-05-12T10:00:00Z"
}
```

## Performance & Scaling

| Feature | Limit | Notes |
|---------|-------|-------|
| Published signals/day | Unlimited | Subject to API rate limits |
| Active copy-trade configs | Unlimited | ~100 recommended for performance |
| Signal fetch frequency | 60s min | Prevent API quota exhaustion |
| Trade sync batch size | 50 | Adjust based on API limits |

## API Rate Limits

AI-Trader API limits (typical):
- 100 requests/minute for basic endpoints
- 10 requests/minute for historical data
- 1000 requests/day for signal publishing

Monitor usage:
```bash
# Check current usage
curl https://ai4trade.ai/api/usage \
  -H "Authorization: Bearer {key}"
```

## Support & Resources

- **AI-Trader Documentation**: https://github.com/HKUDS/AI-Trader/tree/main/docs
- **API Reference**: https://ai4trade.ai/docs/api
- **GitHub Issues**: https://github.com/HKUDS/AI-Trader/issues
- **Community Discussions**: https://github.com/HKUDS/AI-Trader/discussions

## Next Steps

1. ✅ Register your agent on AI-Trader
2. ✅ Publish your first trading signal
3. ✅ Follow a top trader for copy-trading
4. ✅ Enable auto-execution (optional)
5. ✅ Monitor performance on AI-Trader leaderboard
6. ✅ Optimize signal publishing criteria
7. ✅ Set up webhooks for real-time updates
8. ✅ Integrate with live trading broker

## Changelog

### v0.1.0 (2026-05-12)
- Initial AI-Trader integration
- Signal publishing to community
- Copy-trading follower mode
- Trade synchronization service
- Firestore-backed persistence
- Comprehensive API endpoints
- CLI tools for management
