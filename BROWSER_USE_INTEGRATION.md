# Browser Use Cloud Integration for Rearvy

> Enhanced documentation for Browser Use Cloud SDK integrated into Rearvy 2.0. This guide combines the official Browser Use docs with Rearvy-specific implementation patterns.

## Quick Reference

- **Official Docs**: https://docs.browser-use.com/cloud/llms-full.txt (complete reference)
- **API Key**: Configured in `.env.local` as `BROWSER_USE_API_KEY`
- **Model**: `bu-2-0` (NVIDIA-powered, see `BROWSER_USE_MODEL` in env)
- **Runner**: [src/lib/browser-use/runner.ts](src/lib/browser-use/runner.ts)
- **Tool**: [src/lib/ai/tools/browser.ts](src/lib/ai/tools/browser.ts)

---

## Architecture in Rearvy

### Current Integration Points

1. **Environment Setup**
   ```
   BROWSER_USE_API_KEY=bu_9VIfMsutA1IAvVMJmj2GZj_UeqtMsKzglZy-l_R8CJQ
   BROWSER_USE_MODEL=bu-2-0
   BROWSER_USE_LLM_PROVIDER=nvidia
   BROWSER_USE_USE_CLOUD_BROWSER=true
   BROWSER_USE_TIMEOUT_MS=240000  # 4 minutes
   ```

2. **Execution Flow**
   - User request → `runBrowserAgentTool()` in [src/lib/ai/tools/browser.ts](src/lib/ai/tools/browser.ts)
   - Quick path for simple commands (e.g., "open google.com") 
   - Full agent for complex tasks
   - Returns `BrowserUseResult` with structured output

3. **Result Handler**
   ```typescript
   interface BrowserUseResult {
     ok: boolean;
     summary?: string;
     error?: string;
     status: string;
   }
   ```

---

## Key Features (from Official Docs)

### 1. **Agent Models**
Use these via `BROWSER_USE_MODEL`:
- `claude-sonnet-4.6` (recommended, default in cloud)
- `claude-opus-4.6` (most capable)
- `gpt-5.4-mini` (fast, efficient)
- `bu-2-0` (Rearvy current, browser-use native)

### 2. **Structured Output**
Return typed data from browser tasks:
```typescript
import { z } from "zod";

const Schema = z.object({
  title: z.string(),
  price: z.number(),
  inStock: z.boolean(),
});

const result = await client.run(task, { schema: Schema });
// result.output is validated & typed
```

### 3. **Sessions & Follow-ups**
Reuse browser state across multiple tasks:
```typescript
const session = await client.sessions.create();
const result1 = await client.run("Task 1", { sessionId: session.id });
const result2 = await client.run("Task 2", { sessionId: session.id });
await client.sessions.stop(session.id);
```

### 4. **Workspaces & Files**
Upload/download files for agent tasks:
```typescript
const workspace = await client.workspaces.create({ name: "my-workspace" });

// Agent reads uploaded files
await client.workspaces.upload(workspace.id, "data.csv", "config.json");
const result = await client.run(task, { workspaceId: workspace.id });

// Download results
await client.workspaces.downloadAll(workspace.id, { to: "./output" });
```

### 5. **Deterministic Caching**
Run once, execute instantly on follow-ups at $0 LLM cost:
```typescript
// First run: agent figures out the task (~$0.10)
const result1 = await client.run(
  "Get prices from @{{amazon.com}} for @{{electronics}}",
  { workspaceId: workspace.id }
);

// Instant reruns with different params ($0 LLM)
const result2 = await client.run(
  "Get prices from @{{amazon.com}} for @{{laptops}}",
  { workspaceId: workspace.id }
);
```

### 6. **Human in the Loop**
Mix human interaction with agent automation:
```typescript
const session = await client.sessions.create();
console.log(`Live view: ${session.liveUrl}`);

// Agent does first part
await client.run("Navigate to checkout", { sessionId: session.id });

// Human enters payment info via live view
await userInput("Complete payment, then press Enter...");

// Agent continues
const result = await client.run("Verify order confirmation", 
  { sessionId: session.id });
```

### 7. **Live Messages (Streaming)**
Get real-time feedback as agent works:
```typescript
const run = client.run("Find top 10 GitHub repos today");
for await (const msg of run) {
  console.log(`[${msg.role}] ${msg.summary}`);
  if (msg.screenshot_url) showScreenshot(msg.screenshot_url);
}
console.log(run.result.output);
```

### 8. **Stealth & Anti-Detection**
- Canvas/WebGL fingerprint randomization
- Ad & cookie banner auto-dismissal
- Cloudflare/PerimeterX bypass
- Residential proxies in 195+ countries
- Enabled by default, no config needed

### 9. **2FA Handling**
Four approaches:
1. **Profiles** (recommended): Login once, reuse cookies
   ```typescript
   const profile = await client.profiles.create({ name: "user-id-1" });
   const session = await client.sessions.create({ profileId: profile.id });
   ```

2. **Human in the loop**: Agent navigates to login, human does 2FA
3. **Agent Mail**: Built-in email inbox for 2FA codes (enabled by default)
   ```typescript
   const result = await client.run(task, { agentmail: true });
   ```

4. **TOTP secret**: Pass authenticator secret to agent
   ```typescript
   const result = await client.run(
     `When prompted, generate 2FA code:\nimport pyotp\ntotp=pyotp.TOTP("${secret}")\ncode=totp.now()`,
   );
   ```

### 10. **Authentication Options**
- **Secrets**: Domain-scoped credentials
  ```typescript
  await client.run(task, {
    secrets: { "github.com": "username:password" },
    allowedDomains: ["github.com"]
  });
  ```

- **1Password Integration**: Auto-fill from 1Password vault
  ```typescript
  await client.run(task, { opVaultId: "vault-id" });
  ```

---

## Rearvy Integration Patterns

### Pattern 1: Simple Web Lookup
For tasks like "find the price of X on Y website":
```typescript
// In src/lib/ai/tools/browser.ts
if (isSimpleOpenCommand(task)) {
  const quickUrl = inferQuickStartUrl(task);
  await openExternalUrl(quickUrl); // Direct browser open
  return { ok: true, status: "completed", action: "quickOpen" };
}
```

### Pattern 2: Complex Multi-step Workflow
For trading research, data extraction, form filling:
```typescript
const result = await runBrowserAgent(task);
// Returns: { ok: boolean, summary?: string, error?: string, status: string }
if (result.ok === false) {
  // Handle API key missing, not configured, etc.
}
```

### Pattern 3: Session Persistence (Trading Workflows)
For multi-step trading operations:
```typescript
// Create session for trading task sequence
const session = await client.sessions.create({ keepAlive: true });
await client.run("Log in and check positions", { sessionId: session.id });
await client.run("Review pending orders", { sessionId: session.id });
await client.run("Analyze portfolio performance", { sessionId: session.id });
await client.sessions.stop(session.id);
```

### Pattern 4: Data Extraction with Caching
For repeated market data pulls:
```typescript
const result = await client.run(
  "Get stock prices from @{{yahoo.finance}} for @{{AAPL,MSFT}}",
  { workspaceId: workspace.id }
);
// Cached on second call with different tickers
```

---

## Configuration & Environment

### Current Setup
```env
# Browser Use
BROWSER_USE_API_KEY=bu_...
BROWSER_USE_MODEL=bu-2-0
BROWSER_USE_LLM_PROVIDER=nvidia
BROWSER_USE_USE_CLOUD_BROWSER=true
BROWSER_USE_TIMEOUT_MS=240000

# Optional fallback
AI_PROVIDER_MODEL="mistralai/ministral-14b-instruct-2512"
EMAIL_CLASSIFIER_MODEL="mistralai/ministral-14b-instruct-2512"
```

### Recommended Enhancements
- **For cost optimization**: Use `claude-sonnet-4.6` (better value than bu-2-0)
- **For accuracy**: Use `claude-opus-4.6` for complex trading tasks
- **Session timeout**: Currently 240s (4min). Increase for longer workflows
- **Proxy rotation**: Currently default (US). Consider geo-targeting for specific markets

---

## Error Handling

### Common Issues & Solutions

1. **API Key Missing**
   ```typescript
   if (errorMsg.includes("BROWSER_USE_API_KEY")) {
     return "Get API key at https://cloud.browser-use.com/settings";
   }
   ```

2. **Browser Not Configured**
   ```typescript
   if (errorMsg.includes("not configured")) {
     return "Browser Use not properly configured in environment";
   }
   ```

3. **Rate Limiting (429)**
   - SDK auto-retries with exponential backoff
   - For persistent issues: contact Browser Use support

4. **Website Blocking**
   - Verify stealth is enabled (default)
   - Try different proxy country: `proxyCountryCode="de"`
   - Use profiles with logged-in cookies

---

## Advanced Use Cases

### Use Case 1: Trading Data Aggregation
Combine multiple financial data sources into unified view:
```typescript
const workspace = await client.workspaces.create();
const result = await client.run(
  "Get stock info from @{{yahoo.finance}} and @{{investing.com}} for @{{AAPL}}",
  { workspaceId: workspace.id, schema: StockDataSchema }
);
```

### Use Case 2: Competitor Analysis
Monitor competitor websites for changes:
```typescript
// Use webhooks for automated monitoring
const session = await client.sessions.create();
result = await client.run("Get pricing from competitor.com", 
  { sessionId: session.id, enableRecording: true });
// Webhook fires when status changes
```

### Use Case 3: Form Filling Workflow
Automate complex application processes:
```typescript
const result = await client.run(
  `1. Navigate to application.com
   2. Fill form with: name={{John}}, email={{john@example.com}}
   3. Upload resume from workspace
   4. Submit form`,
  { workspaceId: workspace.id }
);
```

### Use Case 4: Live Dashboard
Embed Browser Use into Rearvy dashboard:
```typescript
// Show live browser view while agent works
<iframe src={session.liveUrl} style={{width: "100%", aspectRatio: "16/9"}} />

// Stream messages as agent executes
for await (const msg of client.run(task)) {
  updateDashboard(msg);
}
```

---

## Cost Optimization

| Scenario | Cost |
|----------|------|
| First task (agent explores) | ~$0.05–1.00 |
| Cached reruns (same template, different params) | **$0** |
| Auto-healing (script breaks, regenerates) | ~$0.05–1.00 |
| Browser + proxy infrastructure | Small per-execution fee |

**Best practices:**
- Use `@{{}}` syntax for parameterized tasks
- Cache frequently-repeated workflows
- Group related tasks in sessions (one browser reuse)

---

## MCP Server Integration (Recommended Enhancement)

Browser Use exposes a Model Context Protocol (MCP) server. Add to your AI agent:

```json
// For Claude Desktop or VS Code
{
  "mcpServers": {
    "browser-use": {
      "url": "https://api.browser-use.com/v3/mcp",
      "headers": {
        "x-browser-use-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

**Available tools:**
- `run_session` - Create & run tasks
- `get_session` - Poll status
- `send_task` - Follow-up tasks
- `stop_session` - Cleanup
- `list_browser_profiles` - Auth management

---

## Webhook Integration (for Async Monitoring)

Set up at https://cloud.browser-use.com/settings?tab=webhooks:

```typescript
// Express webhook handler
app.post("/webhook", (req, res) => {
  const { type, payload } = req.body;
  if (type === "agent.task.status_update") {
    const { task_id, status, session_id } = payload;
    console.log(`Task ${task_id} is now ${status}`);
  }
  res.status(200).send("OK");
});
```

---

## Next Steps for Rearvy

1. **Migrate to v3 SDK** (if not already): Better models, file workspaces, scheduling
2. **Add Profiles** for authenticated trading platforms
3. **Set up MCP server** for direct agent access
4. **Implement caching** for repeated market data pulls
5. **Add webhooks** for async monitoring of long-running tasks
6. **Create SKILL.md** for reusable trading research workflows

---

## Resources

- 📚 **Full Docs**: https://docs.browser-use.com/cloud/llms-full.txt
- 🎯 **Quick Index**: https://docs.browser-use.com/cloud/llms.txt
- 🔌 **API Reference**: https://docs.browser-use.com/cloud/api-reference
- 💬 **Chat UI Example**: https://github.com/browser-use/chat-ui-example
- 🛠️ **Dashboard**: https://cloud.browser-use.com
- 🆘 **Support**: Contact via cloud dashboard

---

## Related Rearvy Components

- [runBrowserAgent()](src/lib/browser-use/runner.ts) - Core execution
- [runBrowserAgentTool()](src/lib/ai/tools/browser.ts) - AI tool wrapper
- [BrowserUseResult](src/lib/browser-use/runner.ts#L8-L11) - Response type
- [.env.local](.env.local) - Configuration

---

**Last Updated**: May 1, 2026 | **Browser Use Version**: v3 | **Rearvy Integration**: Stable
