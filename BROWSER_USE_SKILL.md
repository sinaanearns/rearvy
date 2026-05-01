---
name: "Browser Use Cloud Integration"
description: "AI-powered browser automation for Rearvy. Automate web tasks, extract data, handle authentication, and monitor trading platforms."
category: "browser-automation"
tags: ["browser-use", "web-automation", "trading", "data-extraction", "scraping"]
version: "1.0"
supported_models: ["claude-opus-4.6", "claude-sonnet-4.6", "gpt-5.4-mini", "bu-2-0"]
---

# Browser Use Cloud Integration

## Purpose

Browser Use Cloud is an AI-powered browser automation API integrated into Rearvy. Use this skill to:
- Automate web interactions (navigate, click, fill forms, extract data)
- Monitor trading platforms and market data sources
- Handle complex authentication flows (2FA, OAuth, SSO)
- Extract structured data from websites
- Cache and re-execute workflows with parameterized inputs

## Quick Start

### Basic Web Task
```typescript
// Simple example: Get current Bitcoin price
const result = await client.run("Get the current Bitcoin price from coinmarketcap.com");
console.log(result.output);
```

### Complex Multi-step Workflow
```typescript
// Trading example: Check multiple positions
const result = await client.run(
  "Go to trading.platform.com, log in, check positions for AAPL and MSFT, return price and gain/loss"
);
```

### Structured Data Extraction
```typescript
// Extract and return typed data
import { z } from "zod";

const StockData = z.object({
  symbol: z.string(),
  price: z.number(),
  change: z.number(),
  percentChange: z.number(),
});

const result = await client.run(
  "Get stock data for Apple from Yahoo Finance",
  { schema: z.array(StockData) }
);
// result.output is validated array of StockData objects
```

## Key Capabilities

### 1. **Session Persistence** (Multi-step Workflows)
For workflows requiring multiple steps in the same browser:
```typescript
const session = await client.sessions.create({ keepAlive: true });

// Step 1: Navigate and authenticate
await client.run("Log in to trading platform", { sessionId: session.id });

// Step 2: Get data (reuses logged-in state)
await client.run("Get portfolio summary", { sessionId: session.id });

// Step 3: Perform action
await client.run("Place order for AAPL at market", { sessionId: session.id });

await client.sessions.stop(session.id);
```

### 2. **Caching & Deterministic Reruns** ($0 LLM Cost)
For repeated tasks with different parameters:
```typescript
// First run (caches the workflow): ~$0.10
const result1 = await client.run(
  "Get stock prices from @{{yahoo.finance}} for @{{AAPL}}, @{{MSFT}}, @{{GOOGL}}",
  { workspaceId: workspace.id }
);

// Instant reruns with different symbols ($0 LLM):
for (const symbols of [["TSLA", "NVDA"], ["AMD", "INTEL"]]) {
  const result = await client.run(
    `Get stock prices from @{{yahoo.finance}} for @{{${symbols.join(", ")}}}`,
    { workspaceId: workspace.id }
  );
  // No LLM cost, executes cached script
}
```

### 3. **File Upload/Download Workflows**
For tasks requiring data files:
```typescript
const workspace = await client.workspaces.create();

// Upload data file
await client.workspaces.upload(workspace.id, "portfolio.csv", "trades.json");

// Agent reads files and processes
const result = await client.run(
  "Analyze the portfolio and trades files, recommend rebalancing",
  { workspaceId: workspace.id }
);

// Download results
await client.workspaces.download(workspace.id, "recommendations.json", 
  { to: "./output/recommendations.json" });
```

### 4. **Authentication Patterns**

#### Pattern A: Profiles (Recommended for Recurring Tasks)
```typescript
// Create once, reuse across sessions
const profile = await client.profiles.create({ name: "trading-account" });

// Session 1: Use profile (cookies auto-loaded)
const session1 = await client.sessions.create({ profileId: profile.id });
const result1 = await client.run("Check portfolio", { sessionId: session1.id });
await client.sessions.stop(session1.id);

// Session 2: Same profile, no re-login needed
const session2 = await client.sessions.create({ profileId: profile.id });
const result2 = await client.run("Place order", { sessionId: session2.id });
await client.sessions.stop(session2.id);
```

#### Pattern B: Agent Mail (for Email-based 2FA)
```typescript
const result = await client.run(
  "Sign up and complete email verification",
  { agentmail: true } // Built-in email for 2FA codes
);
```

#### Pattern C: Secrets (for Single-use Credentials)
```typescript
const result = await client.run("Log in and export data", {
  secrets: { "trading-platform.com": "username:password" },
  allowedDomains: ["trading-platform.com"]
});
```

#### Pattern D: TOTP/2FA Secret
```typescript
const result = await client.run(
  `Log in to trading platform with username/password.
   When prompted for 2FA, generate code using:
   import pyotp
   totp = pyotp.TOTP("JBSWY3DPEHPK3PXP")  // Your TOTP secret
   code = totp.now()`,
  {}
);
```

### 5. **Live Messages** (Real-time Feedback)
Stream agent messages as it works:
```typescript
const run = client.run("Find top 5 trending cryptocurrencies");
for await (const msg of run) {
  console.log(`[${msg.role}] ${msg.summary}`);
  if (msg.screenshot_url) {
    console.log(`Screenshot: ${msg.screenshot_url}`);
  }
}
console.log("Final result:", run.result.output);
```

### 6. **Live Preview** (Embed in UI)
Watch the agent's browser in real-time:
```typescript
const session = await client.sessions.create();

// Embed live view in your UI
const liveUrl = session.liveUrl;
// <iframe src={liveUrl} style={{width: "100%", aspectRatio: "16/9"}} />

// Run task
await client.run("Complex workflow...", { sessionId: session.id });
```

### 7. **Recording** (MP4 Video)
Record browser activity for auditing:
```typescript
const result = await client.run("Complete trading workflow", {
  enableRecording: true
});

// Get MP4 URL after completion
const recordingUrls = await client.sessions.waitForRecording(result.id);
console.log("Recording:", recordingUrls[0]); // Download URL
```

### 8. **Human in the Loop** (Hybrid Automation)
Mix agent automation with human interaction:
```typescript
const session = await client.sessions.create();

// Agent does setup
await client.run("Navigate to payment page and fill checkout form",
  { sessionId: session.id });

// Human enters sensitive info (payment)
await waitForUserInput("Complete payment in the live view, then press Enter...");

// Agent continues
const result = await client.run("Verify order confirmation",
  { sessionId: session.id });
```

## Model Selection

Choose based on task complexity:

| Model | Best For | Cost |
|-------|----------|------|
| `claude-opus-4.6` | Complex multi-step, ambiguous sites | $0.05/step |
| `claude-sonnet-4.6` | Balanced (recommended) | $0.03/step |
| `gpt-5.4-mini` | Simple, well-defined tasks | $0.01/step |
| `bu-2-0` (current) | General browser automation | $0.006/step |

## Rearvy-Specific Examples

### Trading Platform Monitoring
```typescript
const result = await client.run(
  "Go to my trading platform, log in, check positions for AAPL MSFT GOOGL TSLA, return: symbol, current_price, quantity, gain_loss_percent",
  { model: "claude-sonnet-4.6" }
);
```

### Market Data Aggregation
```typescript
const workspace = await client.workspaces.create();
const result = await client.run(
  "Get @{{earnings dates}} from @{{investopedia}} and @{{yahoo finance}} for @{{tech companies}}",
  { workspaceId: workspace.id }
);
```

### Trading Signal Research
```typescript
const result = await client.run(
  "Search for technical analysis signals: RSI < 30, MACD crossover, moving average support on AAPL from TradingView",
  { enableRecording: true } // Record for analysis
);
```

### Portfolio Analysis
```typescript
const result = await client.run(
  `1. Get my portfolio from trading platform
   2. Fetch current prices for each holding
   3. Calculate: total value, gain/loss, top performer, worst performer
   4. Return as JSON`,
  { schema: PortfolioAnalysisSchema }
);
```

## Best Practices

### ✅ DO

1. **Use structured output** for data extraction:
   ```typescript
   const result = await client.run(task, { schema: DataSchema });
   ```

2. **Enable caching** for repeated tasks:
   ```typescript
   "Get prices from @{{source}} for @{{symbols}}"
   ```

3. **Set clear, specific tasks**:
   - ✅ "Get AAPL price from yahoo.finance"
   - ❌ "Find stock prices"

4. **Use profiles** for authenticated platforms:
   ```typescript
   { profileId: "profile-id" }
   ```

5. **Monitor costs** with caching:
   - First run: ~$0.10
   - Cached reruns: $0.00 LLM

### ❌ DON'T

1. Don't hardcode credentials in prompts
2. Don't use for untrusted websites
3. Don't exceed session timeout (15 min default)
4. Don't forget to call `sessions.stop()` to save profile state
5. Don't omit `schema` when you need specific return data

## Error Handling

```typescript
const result = await runBrowserAgent(task);

if (result.ok === false) {
  if (result.error?.includes("BROWSER_USE_API_KEY")) {
    // API key missing/invalid
    return "Get API key from https://cloud.browser-use.com/settings";
  }
  
  if (result.error?.includes("not configured")) {
    // Browser Use not configured
    return "Browser Use environment not properly set up";
  }
  
  // Other errors
  return `Browser automation failed: ${result.error}`;
}

// Success
console.log(result.summary);
```

## Stealth & Anti-Detection

Enabled by default:
- ✅ Canvas/WebGL fingerprint randomization
- ✅ Ad & banner auto-dismissal
- ✅ Cloudflare/PerimeterX bypass
- ✅ Residential proxies (195+ countries)
- ✅ User-agent rotation

No configuration needed.

## Cost Optimization

**Scenario** | **Cost** | **Tip**
---|---|---
First task | ~$0.05–1.00 | Normal
Cached reruns (50+) | **$0** | Use `@{{}}` syntax
Auto-healing (site changes) | ~$0.05–1.00 | Automatic
Infrastructure/proxy | ~$0.02–0.10 | Always charged

## Integration with Rearvy

**File**: [src/lib/ai/tools/browser.ts](src/lib/ai/tools/browser.ts)
**Runner**: [src/lib/browser-use/runner.ts](src/lib/browser-use/runner.ts)
**Env**: [.env.local](.env.local) - `BROWSER_USE_*` vars

To use in your AI prompts:
```
I can help you automate web tasks. I have access to a Browser Use agent that can:
- Navigate websites and interact with pages
- Extract data in structured formats
- Handle login and authentication flows
- Monitor sites for changes
- Perform multi-step workflows

What would you like me to automate?
```

## Advanced Topics

- **MCP Server**: Direct integration into Claude, Cursor, Windsurf
- **Webhooks**: Real-time notifications when tasks complete
- **Workspaces**: Persistent file storage across sessions
- **Skills**: Create reusable workflow APIs

See [BROWSER_USE_INTEGRATION.md](BROWSER_USE_INTEGRATION.md) for details.

## Support & Resources

- 📖 **Full Documentation**: https://docs.browser-use.com/cloud/llms-full.txt
- 🎯 **Quick Index**: https://docs.browser-use.com/cloud/llms.txt
- 🔧 **API Reference**: https://docs.browser-use.com/cloud/api-reference
- 💻 **Chat UI Example**: https://github.com/browser-use/chat-ui-example
- 🆘 **Dashboard**: https://cloud.browser-use.com
