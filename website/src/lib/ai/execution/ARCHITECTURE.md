# Rearvy Execution Architecture (Chat → Execution + Intelligent Tool Router)

This document describes the unified execution layer that transforms Rearvy from a
chatbot into an **AI Executive Operating System** where natural language is
automatically translated into intelligent tool execution.

## 1. Problem Statement

Prior to this layer, Rearvy had **four disconnected planning systems**:

| System | Location | Gap |
|---|---|---|
| Deterministic if/else chain | `website/src/app/api/chat/route.ts` (~4310 lines) | Brittle, requires memorized commands |
| Orchestrator planner | `website/src/lib/ai/planner/` | Not wired into chat streaming |
| Executive planner | `website/src/lib/executive/` | Orphaned, most capabilities unsupported |
| Workflow planner | `website/src/lib/ai/desktop-control/` | Desktop-only |

None fed results back to the LLM between steps, and none provided a single
entry point for natural-language-first execution.

## 2. Solution: Unified Execution Brain

`website/src/lib/ai/execution/` provides a single brain that:

1. **Parses intent** from natural language (`router.ts`).
2. **Routes** to one of three paths:
   - `chat` → conversational response (legacy path untouched).
   - single tool → direct execution via the existing tool registry.
   - multi-step / sensitive → structured plan with confidence + approval gates.
3. **Executes** plans step-by-step, re-invoking the LLM for `llm_reasoning` /
   `data_analysis` steps so downstream steps benefit from upstream results.
4. **Persists** nothing yet (Firestore task persistence is the next iteration)
   but returns a fully structured `ExecutionResult`.

### Files

| File | Responsibility |
|---|---|
| `router.ts` | LLM-first intent classification with keyword-heuristic fallback |
| `brain.ts` | `executeGoal()` — the unified orchestrator |
| `chat-delegate.ts` | Safe wrapper the chat route can call before legacy handlers |
| `router.test.ts` | Unit tests for intent schema + fallback |

### API

`POST /api/ai/execute`

```jsonc
{
  "message": "Read my invoices, summarize them, upload to Drive and email the accountant",
  "projectId": "…",
  "chatId": "…",
  "isDesktopApp": false,
  "approvalMode": "auto"   // auto | require_all | safe_only
}
```

Returns `{ understood, plan, steps, summary, confidence, needsApproval, intent }`.

### Tool

`executionRun` (`website/src/lib/ai/tools/execution.ts`) is registered in the
main tool registry. The LLM can call it during streaming chat to handle complex
natural-language goals without the user memorizing commands.

## 3. Intent Categories

`router.ts` classifies into 15 capability domains that map to the existing
tool registry:

`browser, chat, code, desktop, email, file, memory, media, research, terminal,
trading, automation, calendar, knowledge, integration`

Unknown apps/sites are resolved generically (see Desktop Control) or searched.

## 4. Backward Compatibility

- The 4310-line `chat/route.ts` is **untouched**. `chat-delegate.ts` is an
  optional pre-router the chat path may invoke; if it returns `fallback: true`
  the legacy flow continues unchanged.
- All existing tools remain in the registry; the brain only *adds* a new
  orchestration path on top of them.
- The deterministic handlers in `chat/route.ts` still win for explicit commands;
  the brain handles ambiguous/vague/complex requests.

## 5. Example Flows

| User says | Router | Brain |
|---|---|---|
| "Open Spotify" | `desktop` | single tool → `executeWorkflow` (launch) or web fallback |
| "Draft an email to the accountant" | `email` | single tool → `prepareGmailMessage` |
| "Summarize yesterday's Slack and post to Notion" | `integration` + `requiresMultiStep` | plan → Slack tool → Notion tool |
| "Hey, how's it going?" | `chat` | `fallback: true` → legacy chat |

## 6. Missing Integrations (parallel work)

Slack, Notion, Stripe, Google Drive clients + OAuth + tools are implemented in
feature worktrees and will be merged after review. They follow the exact Gmail
integration pattern (encrypted tokens, Firestore `INTEGRATIONS` collection,
draft-only sends).

## 7. Next Iterations

1. Firestore persistence of `OrchestratorTask` for resumable plans.
2. SSE streaming endpoint `/api/ai/orchestrate` re-pointed to the brain.
3. Approval UI in the chat surface for `needsApproval` plans.
4. Migrate the 4310-line deterministic chain to delegate to the brain.
