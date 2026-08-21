# Rearvy AI Executive Operating System — Implementation Plan

## Executive Summary

This document is the authoritative implementation plan for transforming Rearvy from an AI chatbot into an AI Executive Operating System. It contains the full audit, architecture decisions, and implementation roadmap.

---

1. Codebase Audit & Current State

### Production-Grade Existing Features
| Feature | Status | Location |
|---|---|---|
| Multi-provider AI routing (NVIDIA, Groq, Together, OpenAI) | ✅ Production | `website/src/lib/ai/model-router.ts` |
| Tool registry (~40 tools) | ✅ Production | `website/src/lib/ai/tools/index.ts` |
| Desktop automation (RobotJS, screenshots, workflows) | ✅ Production | `desktop-app/lib/workflow-executor.cjs` |
| Browser automation (local + Browserbase cloud) | ✅ Production | `website/src/lib/browser-use/` |
| MCP plugin hub (stdio + SSE) | ✅ Production | `website/src/lib/ai/mcp/hub.ts` |
| Memory system (cloud + local) | ✅ Production | `website/src/lib/memory-store.ts` |
| OCR (NVIDIA Nemotron + Tesseract) | ✅ Production | `website/src/lib/ai/nvidia-ocr.ts` |
| Vision model routing | ✅ Production | `website/src/lib/ai/model-router.ts` |
| Terminal agent | ✅ Production | `desktop-app/executor/terminal-service.cjs` |
| Trading opinion engine | ✅ Production | `website/src/lib/trading/opinion-engine.ts` |
| 12+ integrations (Gmail, GitHub, Shopify, etc.) | ✅ Production | `website/src/lib/integrations/` |
| Workflow automation (DAG, approvals, retries) | ✅ Production | `website/src/lib/ai/desktop-control/workflow.ts` |
| Firestore security rules | ✅ Production | `firestore.rules` |
| Electron IPC bridge | ✅ Production | `desktop-app/preload.cjs` |

### Partially Implemented / Scattered
| Feature | Status | Gaps |
|---|---|---|
| **Planning systems** | ⚠️ 4 disconnected systems | Orchestrator planner, executive planner, workflow planner, deterministic 4k-line if/else chain are not unified |
| **Chat → Execution** | ⚠️ Single-turn only | `streamText` tool calls are limited to one invocation; no multi-turn orchestration in chat path |
| **Research agent** | ⚠️ Basic | Firecrawl scraping only; no deep academic/patent/code research |
| **Coding agent** | ❌ Shell only | No autonomous code writing/refactoring/PR agent |
| **Creative Studio** | ❌ Endpoints only | No dashboard UI; media generation exists but no studio experience |
| **Notifications** | ❌ Toast-only | No push notifications, schedule, or notification center |
| **Business workspace** | ❌ Gaps | Missing: Slack, Notion, Stripe, Google Drive |

---

## 2. Architecture Decisions

### A. Unified Execution Brain (replaces 4 planning systems)

**Decision**: Build a single `ExecutionBrain` class in `website/src/lib/ai/execution/` that wraps all planning logic. The brain:

1. **Receives natural language requests** from any entry point (chat, assistant, API).
2. **Classifies intent** using the existing `AIProviderRouter` two-pass pattern (fast classification → rich execution).
3. **Routes** to one of three paths:
   - **Simple tool call**: Direct single-tool execution (current behavior).
   - **Structured plan**: Multi-step plan with `OrchestratorPlan` schema, confidence score, approval gates, and dependency resolution.
   - **Executive workflow**: Capability-tagged `ExecutionPlan` for high-level business goals.
4. **Feeds results back** to the LLM between steps (unlike the current fire-and-forget orchestration).
5. **Persists** state in Firestore for resumability.

**File**: `website/src/lib/ai/execution/brain.ts`

### B. Intelligent NL Router (replaces 4000-line if/else)

**Decision**: Replace deterministic intent detection with an LLM-first router, falling back to heuristics only when the LLM is unavailable. This eliminates the 4000-line if/else chain in `chat/route.ts`.

**File**: `website/src/lib/ai/execution/router.ts`

- Classifies user message into `IntentCategory` (e.g., `desktop.open_app`, `browser.search`, `file.read`, `gmail.send`, `code.run`, `research.deep`, `workflow.create`, `memory.learn`).
- Extracts structured parameters using `generateObject` with Zod.
- Falls back to keyword heuristics if LLM routing fails.

### C. Backward Compatibility Strategy

**Decision**: Add a new `/api/ai/execute` endpoint that uses the unified brain. Refactor existing `chat/route.ts` intent handlers to delegate to the new brain module. This allows incremental migration without breaking existing chat behavior.

**Files**:
- New: `website/src/app/api/ai/execute/route.ts`
- Refactor: `website/src/lib/ai/execution/chat-delegate.ts` (function called from `chat/route.ts`)

### D. Integration Pattern

**Decision**: Follow the existing `Gmail` integration pattern for all new integrations:
- `website/src/lib/integrations/{service}/client.ts` (API client)
- `website/src/lib/integrations/{service}/sync.ts` (sync logic)
- `website/src/lib/integrations/{service}/server.ts` (token management)
- `website/src/app/api/integrations/{service}/connect/route.ts` (OAuth)
- `website/src/app/api/integrations/{service}/callback/route.ts` (OAuth callback)
- `website/src/lib/ai/tools/{service}.ts` (AI tool)

**New integrations**: Slack, Notion, Stripe, Google Drive

---

## 3. Implementation Roadmap

### Phase 1: Core Architecture (Week 1-2) — Enable All Other Features

| Task | Files | Priority |
|---|---|---|
| 1.1 Build `ExecutionBrain` | `website/src/lib/ai/execution/brain.ts` | P0 |
| 1.2 Build NL Router | `website/src/lib/ai/execution/router.ts` | P0 |
| 1.3 Build `/api/ai/execute` endpoint | `website/src/app/api/ai/execute/route.ts` | P0 |
| 1.4 Add `execution.execute` tool | `website/src/lib/ai/tools/execution.ts` | P0 |
| 1.5 Delegate from `chat/route.ts` pilot | `website/src/lib/ai/execution/chat-delegate.ts` | P1 |

### Phase 2: Missing Integrations (Week 2-3)

| Task | Files | Priority |
|---|---|---|
| 2.1 Slack client + tools | `website/src/lib/integrations/slack/` | P1 |
| 2.2 Notion client + tools | `website/src/lib/integrations/notion/` | P1 |
| 2.3 Stripe client + tools | `website/src/lib/integrations/stripe/` | P2 |
| 2.4 Google Drive client + tools | `website/src/lib/integrations/google-drive/` | P1 |

### Phase 3: Missing Features (Week 3-4)

| Task | Files | Priority |
|---|---|---|
| 3.1 Autonomous Coding Agent | `website/src/lib/ai/execution/code-agent.ts`, tool | P1 |
| 3.2 Creative Studio UI | `website/src/app/(dashboard)/creative-studio/page.tsx` | P2 |
| 3.3 Push Notifications | FCM integration + notification center API | P2 |
| 3.4 Research Agent deep mode | Multi-source research planner | P2 |

### Phase 4: Desktop Control (Week 4)

| Task | Files | Priority |
|---|---|---|
| 4.1 Generic app resolution | `desktop-app/lib/app-resolver.cjs` | P1 |
| 4.2 Multi-monitor support | `desktop-app/lib/multi-monitor.cjs` | P1 |

### Phase 5: Hardening (Week 5)

| Task | Files | Priority |
|---|---|---|
| 5.1 Code dedup + lint | Root + all workspaces | P1 |
| 5.2 Tests + CI | Jest/Vitest + GitHub Actions | P1 |
| 5.3 Documentation | README + architecture docs | P2 |

---

## 4. Implementation Details

### 4.1 ExecutionBrain

Merges 4 systems:
- **Orchestrator planner** (`ai/planner/`)
- **Executive planner** (`executive/`)
- **Workflow planner** (`desktop-control/`)
- **Chat tool registry**

Unified API:
```typescript
interface ExecutionRequest {
  userId: string;
  goal: string;
  context: ExecutionContext;
  maxSteps?: number;
  approvalMode?: 'auto' | 'require_all' | 'safe_only';
}

interface ExecutionResult {
  success: boolean;
  steps: StepResult[];
  summary: string;
  confidence: number;
  needsApproval: boolean;
}
```

### 4.2 NL Router

Schema:
```typescript
const IntentSchema = z.object({
  category: z.enum(['chat','desktop','browser','file','terminal','code','research','integration','automation','memory','media','trading']),
  action: z.string(),
  parameters: z.record(z.any()),
  confidence: z.number(),
  requiresMultiStep: z.boolean()
});
```

### 4.3 Chat Delegate

Replaces the 4310-line `chat/route.ts` if/else chain:
```typescript
export async function handleChatRequest(req: NextRequest): Promise<Response> {
  const intent = await parseIntent(userMessage);
  if (intent.requiresMultiStep) {
    return executePlan(goal, ctx);
  }
  return streamToolCall(tool, parameters, ctx);
}
```

---

## 5. Missing Integration Specifications

### 5.1 Slack

- OAuth 2.0 connect flow
- `chat.postMessage`, `conversations.history`, `channels.list`
- Tool: `sendSlackMessage`, `readSlackChannel`, `listSlackChannels`
- Firestore token storage with same encryption pattern as Gmail

### 5.2 Notion

- OAuth 2.0 connect flow
- `POST /pages`, `PATCH /pages/{id}`, `POST /databases/{id}/query`, `GET /pages/{id}`
- Tool: `searchNotion`, `createNotionPage`, `updateNotionPage`
- Support for database queries and page creation

### 5.3 Stripe

- OAuth 2.0 + Secret key (dual auth)
- `GET /charges`, `GET /invoices`, `GET /subscriptions`, `POST /charges` (draft only)
- Tool: `getStripeInvoices`, `getStripeCharges`, `getStripeSubscriptions`

### 5.4 Google Drive

- Shared Google OAuth (reuses existing token)
- `GET /drive/v3/files`, `POST /upload`, `GET /download`
- Tool: `listDriveFiles`, `uploadDriveFile`, `getDriveFileContent`

---

## 6. Testing & Validation

- Unit tests for ExecutionBrain, NL Router, new integrations
- Integration tests for `/api/ai/execute`
- Backward compatibility: existing `chat/`, `assistant/`, `api/assistant/` endpoints unchanged
- E2E tests for new integrations
- Error boundary tests with degraded LLM fallback

---

## 7. Rollout Strategy

1. **Feature flags** behind `EXECUTION_BRAIN_ENABLED` env var
2. Shadow mode: mirror `chat/route.ts` traffic to new brain, compare results
3. Canary rollout: 5% of traffic via `/api/ai/execute`
4. Full rollout after 48h of stable metrics
5. Legacy `chat/route.ts` if/else chain kept as fallback for 2 weeks
