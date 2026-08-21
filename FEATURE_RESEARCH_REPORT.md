# Rearvy — Exhaustive Feature Research & Chronological Analysis

**Project:** Rearvy 2.0 → Rearvy 3.0 ("AI Business Operating System")
**Repository:** `mutalvita-cyber/rearvy2.0`
**Current version:** `0.1.19` (website + desktop, synced) — as of 2026-07-08
**Architecture:** Next.js (App Router) `website/` + Electron `desktop-app/`, Firebase (Auth/Firestore/Storage), multi‑provider LLM model‑router, Python `browser‑use`/Playwright automation, NVIDIA NIM (OCR/Cosmos), RAG knowledge base.

> **Method & caveat:** Chronology is reconstructed from the 790‑commit `git log` and cross‑referenced against the live source tree (`website/src`, `desktop-app`), `README_LLM.md`, `llms.txt`, `TRADING_SETUP.md`, and `AGENTS.md`. Roughly 60% of commits carry descriptive `feat:`/`fix:` messages; the remainder are terse single‑letter commits. Where a commit is opaque, functionality is inferred from the surrounding descriptive commits and the current implementation. No formal `CHANGELOG.md` exists; version‑milestone signal comes from four git tags (`v0.1.0`, `v0.1.1`, `v0.1.2`, `v0.1.17`) and the explicit desktop version bumps recorded in commit messages.

---

## Release / Milestone Map

| Milestone | Date | What it marked |
|---|---|---|
| **Foundation** | 2026‑02‑22 → 2026‑03‑17 | Next.js app, Supabase→Firebase migration, auth, dashboard, chat, first integrations |
| **Web‑app expansion** | 2026‑03‑21 → 2026‑04‑30 | Marketing site, Gmail, trading copilot, GitHub, desktop shell born, browser automation, MemPalace |
| **Work Automation / Automaton era** | 2026‑05‑01 → 2026‑05‑23 | `work/*` automation platform, Automaton/Buddy APIs, desktop control layer, Maria overlay |
| **v0.1.0** (tag) | 2026‑05‑10 | First tagged desktop build / desktop refactor milestone |
| **v0.1.1** (tag) | 2026‑05‑15 | Desktop iteration |
| **v0.1.2** (commit bump) | 2026‑05‑17/18 | NSIS installer, Windows unsigned build, blockmap, code‑signing tooling prep |
| **v0.1.8** (commit bump) | 2026‑06‑04 | Desktop release iteration |
| **v0.1.13 / v0.1.15** (commit bump) | 2026‑06‑13 | Maria overlay dragging fix, indicator‑dot removal, IPC cleanup |
| **v0.1.16** (commit bump) | 2026‑06‑14/15 | Simplified browser‑extension connection, dropped local Ollama/OpenRouter, Maria bridge/SSR race fixes |
| **Cinematic marketing** | 2026‑06‑16 → 2026‑06‑18 | Cinematic hero section + looping homepage background video |
| **AI‑SEO blog** | 2026‑06‑27/28 | Blog refactor for niche SEO + Maria AI knowledge base |
| **v0.1.17** (tag) | 2026‑07‑05 | **Rearvy 3.0 "AI Business OS" spec** — `AGENTS.md` rewritten; AI capabilities/agents/knowledge‑base/storage integration |
| **0.1.19** (current) | 2026‑07‑08 | Final merge of AI capabilities, agents, knowledge base, storage infrastructure; Zod fixes; download/action‑plan test fixes |

---

## Chronological Feature Ledger

### Era 1 — Foundation (2026‑02‑22 → 2026‑03‑17)

| Date | Feature | Description | Key locations |
|---|---|---|---|
| 02‑22 | Global styles & Next.js layout | Base app shell, Tailwind, routing. | `website/src/app/layout.tsx` |
| 02‑22 | Revenue tracking tools & utilities | Early business‑metric helpers. | `lib/` utils |
| 02‑22 | PostgreSQL / Supabase support | Initial DB via Supabase + migration scripts. | `supabase/` migrations (later removed) |
| 02‑23 | Error handling + user‑context scaffolding | Multiple context directories. | — |
| 02‑23 | **Shopify integration** | OAuth connect, CSRF validation, data sync, webhook/claim; removed access‑token requirement. | `api/integrations/shopify/*`, `webhooks/shopify`, `integrations/shopify/claim` |
| 02‑23 | **Core dashboard, projects, chat, auth** | Dashboard layout, project + chat management, Supabase auth middleware. | `(dashboard)/page.tsx`, `api/auth/*` |
| 02‑23 | Integration status API | Endpoint returning integration statuses + synced data counts. | `api/integrations/status` |
| 02‑23 | **YouTube integration** | Connect/disconnect/sync, channel stats, data handling. | `api/integrations/youtube/*` |
| 02‑24 | Sidebar / Topbar refactor | Improved navigation structure. | `components/layout/*` |
| 02‑25 | Right‑sidebar (news) + theme provider | News panel + dark/light theme. | `layout/right-sidebar`, theme provider |
| 02‑25 | Memory & news panels; insights for Shopify/YouTube | AI‑generated insights from integration data. | `components/insights/*`, `MemoryPanel` |
| 02‑25 | **Instagram & TikTok integrations** (TikTok later removed) | Syncing capabilities. | `api/integrations/instagram/*` |
| 02‑25 | Action tools | Data sync, project creation, export. | — |
| 02‑25 | Dev‑mode auth bypass | Skip auth in development. | `lib/firebase/auth` |
| 02‑26 | **undici HTTP + new auth routes** | Hardened server HTTP + auth routes. | `api/auth/*` |
| 02‑27 | TikTok removal + migration cleanup | Dropped TikTok integration. | — |
| 02‑27 | **Google Analytics integration** | Connect/disconnect/sync, property fetching. | `api/integrations/google-analytics/*` |
| 02‑28 | Dashboard APIs | Chats, memories, projects, user‑profile management. | `api/dashboard/*` |
| 03‑12 | AI model selection in chat | Per‑chat model picker + auth. | `api/chat`, model config |
| 03‑12 | Subscription plan mgmt + invites | Plan tiers, workspace invites. | `api/billing/*`, `projects/[id]/invite` |
| 03‑12 | Firestore migration | Pageview counts moved Supabase→Firestore. | `firestore` |
| 03‑13 | **Rearvy branding rollout** | Logo (SVG→PNG→favicon→wordmark) across header/sidebar/topbar; removed Sparkles. | `brand/rearvy-logo`, metadata icons |
| 03‑13 | **Pro billing via Razorpay** | Pro plan subscription. | `api/billing/activate-pro`, `integrations/razorpay/*` |
| 03‑13 | Password reset/update + account linking | Auth hardening. | `api/auth/*` |
| 03‑13 | Privacy Policy + Terms of Service | Legal pages. | `privacy-policy`, `terms` |
| 03‑13 | Feedback submission | Feedback form + API. | `components/feedback`, `api/dashboard/feedback` |
| 03‑13 | Chat enhancements | Markdown, loading indicators, styling. | `chat/message-bubble`, `chat/chat-input` |
| 03‑13 | **Web search + page fetch tools** | Live web research in chat. | `lib/ai/web-research*`, `WebCard`, `WebSourcesStrip` |
| 03‑13 | **Admin auth + dashboard** | Admin login, layout, stats API. | `api/admin/*`, admin pages |
| 03‑14 | Web research + free‑tier mode | Tool registry + system‑prompt tuning for free users. | `lib/ai/tool-registry` |
| 03‑14 | **Admin panel** | Dedicated admin dashboard UI. | `admin` routes |
| 03‑14 | Chat route handoff | Session‑storage message handoff across routes. | `api/chat` |
| 03‑16 | **Chat API with Firebase persistence** | `streamText` AI integration, context building, message sanitization. | `api/chat/route.ts` |
| 03‑16 | Chat pages (new/existing, global/project) | Project‑scoped + general chats. | `chat/new`, `chat/[id]`, `projects/[id]/chat/*` |
| 03‑16 | Chat archiving, pinning, multi‑delete | Sidebar selection mode. | `sidebar` |
| 03‑16 | Kimi 2 → Rearvy rebrand (brief) | Temporary rename then reverted. | — |
| 03‑17 | **Demo pages** | Sample metrics, demo chat + integrations. | `demo/*` |
| 03‑17 | **Shopify OAuth callback + claim** | Token exchange, dashboard redirect. | `integrations/shopify/callback` |
| 03‑17 | **Facebook integration** | OAuth, data sync, schema health checks. | `api/integrations/facebook/*` |
| 03‑17 | **Insights dashboard** | List/card/detail components for AI business insights. | `components/insights/*` |

### Era 2 — Web‑app Expansion (2026‑03‑21 → 2026‑04‑30)

| Date | Feature | Description | Key locations |
|---|---|---|---|
| 03‑21 | Search + suggestions on Integrations page | PR #1. | `(dashboard)/integrations` |
| 03‑21 | Speed Insights + Vercel Analytics | Performance monitoring. | `layout`, `@vercel/analytics` |
| 03‑21 | **Auto‑memory saving + notifications** | Auto‑extract user context/goals; notify on corrections. | `lib/ai/memory`, notification system |
| 03‑21 | **WhisperNet** | Content‑monitoring service + dashboard for product mentions/alerts; integrated into Instagram/Shopify/YouTube sync. | `api/whispernet/*`, `lib/whispernet/*` |
| 03‑22 | `buildSystemPrompt` | Dynamic system prompt from user/project/integration context. | `lib/ai/system-prompt.ts` |
| 03‑22 | SEO: robots/sitemap, Google verification | SEO optimization. | `app/robots.ts`, `app/sitemap.ts` |
| 03‑22 | Image upload in chat | File handling, paste images, attachments. | `chat/chat-input` |
| 03‑22 | Marketing landing page | Hero/features/pricing/trust sections. | `app/page.tsx`, `public/*` |
| 03‑23 | **AI memory store** | Persist user context, preferences, goals via chat API + UI. | `MemoryPanel`, `api/.../memory` |
| 03‑23 | **Dashboard settings** | Profile, security, appearance. | `settings` |
| 03‑26 | **Gmail integration** | OAuth callback, token store, sync. | `api/integrations/gmail/*` |
| 03‑30 | Chat attachments + storage | Upload to Firebase Storage. | `api/storage/upload`, `lib/firebase/storage-bucket` |
| 04‑01 → 04‑02 | **Society** (collaboration; later removed) | Societies, auth, profiles, messaging, join requests, admin. | `societies/*` (removed 04‑11) |
| 04‑02 | User profile page + topbar links | Bio/skills/project links. | `profile`, `users/[id]` |
| 04‑06 | New integrations + Firestore JSON templates | Templates for integration schemas. | `firestore-json-templates/*` |
| 04‑06 | **Gmail tools** | Inbox summary, recent messages, settings, disconnect/sync, send. | `api/integrations/gmail/send`, `lib/ai/gmail-*` |
| 04‑07/09 | Microsoft OAuth tenant URLs; Gmail API‑disabled errors | Integration robustness. | `integrations/*` |
| 04‑10/11 | **Firebase auth hardening** | `getIdToken` centralization, redirect fallback, domain canonicalization to `www.rearvy.com`, env‑var enforcement. | `lib/firebase/auth.ts` |
| 04‑11 | NVIDIA_API_KEY gating + model swaps | Chat requires NVIDIA key; default model updates. | `lib/ai/model-router.ts` |
| 04‑11 | Deep‑thinking mode + fast mode | `deepThinking` prop; deferred Firestore writes for streaming. | `chat/*` |
| 04‑12 | **Trading Monitor System** | Guardrails + opinion engine; opinion card, mini chart, confidence, best‑trades API, audio alerts for high‑conviction trades. | `lib/trading/*`, `components/trading/*`, `api/trading/*` |
| 04‑13 | Production scheduler for trading | Cloud Scheduler job → `/api/internal/trading/monitor-jobs/run`. | `scripts/trading/setup-scheduler.mjs` |
| 04‑13 | Research source selection | Symbol relevance + source selection logic. | `lib/trading/research.ts` |
| 04‑13 | Custom model support in chat | UI for custom models. | `chat` |
| 04‑13 | Instagram/Facebook marked "coming soon" | Slug filtering. | `integrations` |
| 04‑15 | **Account data‑deletion** (GDPR) | Data‑delete API + UI. | `api/account/data-delete`, `data-delete` page |
| 04‑15 | **GitHub integration** | OAuth, sync, data management. | `api/integrations/github/*` |
| 04‑21 | **Workspace rebrand** | "Project" → "Workspace"; plans/pricing updated; strategic audit doc. | `projects` |
| 04‑22 | **MemPalace** | Memory recall + conversation capture integration. | `lib/mempalace` (Python pkg present) |
| 04‑22/23 | **Live browser session mgmt + viewer** | Playwright‑based browser sessions, viewer components. | `BrowserCard`, `BrowserLiveViewer`, `LiveBrowserSessionManager` |
| 04‑23 | Web action dialog removal | Simplified chat input/commands. | `chat/ChatInput`, `CommandSuggestions` |
| 04‑29 | **Gmail compose intent detection** | Detect compose intent, refinement API + review card. | `api/ai/refine-email`, `gmail-compose-card` |
| 04‑29 | **Desktop app support (Electron)** | Download page, Electron shell, desktop sign‑in via Google, credential handling. | `desktop-app/main.cjs`, `app/download` |
| 04‑29 | **LinkedIn sync job** | Sync processing + Windows build script. | `integrations/linkedin` |
| 04‑29 | **Sync‑job orchestration + FB auth util** | Job runner, Firebase auth utility. | `lib/sync-jobs`, `lib/firebase/auth` |
| 04‑29 | **Excel workbook processing** | ExcelJS sync utilities. | `integrations/excel/*` |
| 04‑29 | **Browser automation tools** | Credential search, task execution, `BrowserCard`. | `lib/ai/browser*`, `work/browser` |
| 04‑29 | Playwright → devDeps; browser‑use runner | Local/cloud fallback task runner. | `lib/browser-use`, `LiveBrowserSessionManager` |
| 04‑30 | **Chat route w/ tool registry** | Message sanitization, model integration, tools. | `api/chat/route.ts` |
| 04‑30 | **LiveBrowserSessionManager** | Playwright lifecycle + remote command execution. | `lib/cloud-computer/*` |
| 04‑30 | Desktop sign‑in flow | Google auth + credential bridging. | `api/desktop/auth/exchange` |

### Era 3 — Work Automation / Automaton & Desktop Control (2026‑05‑01 → 2026‑05‑23)

| Date | Feature | Description | Key locations |
|---|---|---|---|
| 05‑01 | Browser automation event dispatch + WebSocket URL builder | `.firebaserc` config. | `lib/browser*` |
| 05‑01 | Firestore rules wired to `firebase.json` | Security rules config. | `firebase.json`, `firestore.rules` |
| 05‑01 | Quick URL open + browser task timeout | `open_url` tool, configurable timeouts. | `lib/ai/browser*` |
| 05‑01 | Browser Use Cloud docs | Cloud fallback integration documented. | docs |
| 05‑01 | Session snapshot, keep‑open, command handling | Real‑time browser task state. | `BrowserCard`, `run_task` |
| 05‑02 | **AI agent architecture + tool‑calling + MCP server** | Backend intelligence framework; admin user‑management + data‑export APIs; MCP management routes. | `lib/ai/agent*`, `api/mcp/servers`, `api/agents` |
| 05‑02 | **BrowserFocusChat** | Autonomous browser interaction management. | `components/chat/BrowserFocusChat` |
| 05‑02 | Admin dashboard + user mgmt | Monitoring + data administration. | `api/admin/*` |
| 05‑02 | **ChatContainer + custom markdown** | Chat sessions + browser workspace interactions, specialized block rendering. | `chat/ChatContainer`, `chat/chat-markdown` |
| 05‑02 | **Browser‑use integration UI** | Live viewer, session mgmt. | `BrowserLiveViewer`, `BrowserWorkspacePane` |
| 05‑05 | **Map generation** | Input/output schemas + normalization. | `maps/*`, `ui/map` |
| 05‑05 | **Dashboard infra: automation/assets/meetings/investor** | Modules with Python execution support. | `(dashboard)/work`, `automation/python` |
| 05‑05 | **Background meeting assistant** | Audio recording + transcription. | `api/meetings/*`, `meeting-assistant/*` |
| 05‑05 | Chat API: AI streaming + tool registry + sanitization | Consolidated route. | `api/chat/route.ts` |
| 05‑06/07 | **Blender MCP SSE Bridge** | Bridge scripts + desktop launch, auto‑launch Blender. | `scripts/blender-mcp`, `lib` |
| 05‑07 | **Copilot chat‑feature fixes** (PR #8) | Enter‑to‑send, demo API key handling. | `chat` |
| 05‑08 | **Website re‑initialized** (Next.js + Tailwind + TS baseline) | Turbopack root config, output tracing. | `website/` root config |
| 05‑08 | Comprehensive type defs (DB + trading) | Shared types. | `lib/types` |
| 05‑10 | Desktop structure refactor + protocol handling | `main.cjs` protocol handler. | `desktop-app/main.cjs` |
| 05‑11 | Dependency fixes | `@modelcontextprotocol/sdk`, `exceljs`, `firebase-admin` v13.8. | deps |
| 05‑11 | **Desktop control layer** | Automation actions from desktop. | `desktop-app/main.cjs`, `lib/workflow-executor.cjs` |
| 05‑12 | **Buddy Assistant + Automaton APIs** | Financial insights + user interaction (Buddy/Automaton handler, local server, CSP update). | `api/automaton/*`, `lib/automaton` |
| 05‑12 | Automaton submodule → Rearvy branding; removed from tracking | Submodule migration. | `.gitmodules` (removed) |
| 05‑13 → 05‑19 | Extensive chat/desktop/automation iteration | IPC, session mgmt, error handling, terminal service. | `desktop-app/executor/terminal-service.cjs`, `preload.cjs` |
| 05‑19 | **Session management + error handling refactor** | Desktop runtime. | `desktop-app/main.cjs` |
| 05‑20 | Env‑var handling + URL validation (desktop) | Desktop robustness. | `desktop-app` |
| 05‑21 | **Desktop automation features + UI** | SceneAutopilot, SceneBrowser, SceneChat, SceneVoice interactive components; Maria overlay + poster script. | `components/.../Scene*`, `app/maria-overlay` |
| 05‑21 | **RearvyLogo branding** | Customizable logo component in topbar. | `brand/rearvy-logo` |
| 05‑21 | Assistant alerts system | Notification alerts API. | `api/assistant/alerts`, `lib/assistant-alerts` |
| 05‑23 | **Automaton log relay + origin handling** | Bridge to local server. | `desktop-app` |
| 05‑23 | **Desktop release build** + workflow URL → `rearvy-desktop-releases` | Release pipeline. | `create-release.js`, `.github/workflows/release-desktop.yml` |

### Era 4 — Work Platform Maturation, MCP, Voice & Trading (2026‑05‑26 → 2026‑06‑04)

| Date | Feature | Description | Key locations |
|---|---|---|---|
| 05‑26 | **Source management** (multi‑provider, task handling) | `work/sources` UI + API. | `api/work/sources`, `work/sources` |
| 05‑26 | WhisperNet watchers + summary | File/desktop watchers run/summary. | `api/whispernet/*` |
| 05‑29 | **Knowledge base ingestion pipeline** | Chunk + embed + store; RAG retrievers (cosine, K=5). | `lib/knowledge/{ingestion-pipeline,chunker,embedder,retriever}`, `api/knowledge/*` |
| 05‑29 | **NVIDIA OCR (Nemotron OCR v2)** | Image→text, bbox/confidence, optional RAG ingestion (11 languages). | `lib/ai/nvidia-ocr.ts`, `api/ai/ocr` |
| 05‑29 | **NVIDIA Cosmos media generation** | Image/video generation. | `lib/ai/nvidia-cosmos-video.ts`, `api/ai/generate-media` |
| 05‑29 | **Agents runner** | Persona‑driven agent execution. | `api/agents`, `.github/prompts/*` |
| 05‑29 | **AI orchestrator** | Central reasoning/routing endpoint. | `api/ai/orchestrate` |
| 05‑29 | **Model‑router health/test** | Multi‑provider (NVIDIA/Groq/Together/OpenAI) fast/quality modes. | `lib/ai/model-router.ts`, `api/ai/model-router/*` |
| 05‑29 | **Cloud computer (Browserbase)** | Cloud browser sessions, downloads, artifacts. | `api/cloud-computer/sessions`, `lib/cloud-computer/*` |
| 05‑29 | **Trading AI‑Trader platform** | Register/publish‑signal/market‑intel/copytrade via ai4trade.ai. | `lib/trading/ai-trader-*`, `api/trading/ai-trader/*`, `trading/ai-trader` |
| 05‑29 | **Maria voice/transcription** | Process/transcribe, voice profiles/styles/snippets/dictionary/teams/usage, voice‑agent token. | `api/maria/voice/*`, `api/audio/transcribe` |
| 05‑29 | **MCP servers management** | Server registry UI + API. | `api/mcp/servers`, `work/mcp-servers-section` |
| 05‑29 | **Transactions request/approval** | Intent validation, encryption, audit. | `lib/transactions/*`, `api/transactions/*` |
| 05‑29 | **Billing** | Pro activate, Razorpay orders, redeem codes, verify. | `api/billing/*` |
| 05‑29 | **Calls outbound + meetings** | Outbound calls, meeting start/stop. | `api/calls/outbound`, `api/meetings/*` |
| 05‑29 | **Tracking/analytics collect** | Client+server event collection. | `lib/tracking/*`, `api/tracking/collect` |
| 05‑29 | **Automation Python exec** | Sandbox script execution, runs registry, policies. | `api/automation/python/*`, `lib/automation/*` |
| 05‑29 | **Sensitive memory store** | Encrypted memory. | `lib/sensitive-memory.ts` |
| 05‑29 | **Work platform full surface** | Processes, tasks, automations, listeners, channels, skills, runs, diary, memory, pairing, context, browser. | `api/work/*`, `work/*` pages |
| 05‑29 | **Users / follow / projects invite‑join** | Social collaboration. | `api/users/*`, `api/projects/*` |
| 05‑29 | **Products search, insights recent** | Catalog + insights. | `api/products/search`, `api/insights/recent` |
| 05‑29 | **Internal schedulers/runners** | Work scheduler/runner, sync‑jobs, agent‑events, trading monitor‑jobs, whispernet, maria voice‑agent token. | `api/internal/*` |
| 06‑04 | **Desktop release v0.1.8** | Tagged desktop iteration. | `desktop-app/package.json` |

### Era 5 — Desktop Hardening & Maria (2026‑06‑07 → 2026‑06‑18)

| Date | Feature | Description | Key locations |
|---|---|---|---|
| 06‑07 → 06‑13 | Desktop iteration + IPC cleanup | Maria dragging fixes, indicator‑dot removal, listener cleanup. | `desktop-app/maria-logic.cjs`, `preload.cjs` |
| 06‑13 | **v0.1.13 / v0.1.15** | Maria dragging + version bumps; release script enhanced. | `create-release.js` |
| 06‑14/15 | **Browser‑extension connection simplified** | Removed local Ollama/OpenRouter; consolidated AI providers; Maria bridge race/SSR/clipping fixes; overlay sizing. | `desktop-app`, `lib/ai/model-router.ts` |
| 06‑14 | **v0.1.16** | All package/metadata versions synced to 0.1.16. | root+workspaces |
| 06‑16 | **Cinematic hero section** | Looping video background (separate `cinematic-hero` Vite app + website section). | `cinematic-hero/`, homepage hero |
| 06‑17/18 | **Homepage background video** | Local looping bg video. | `app/page.tsx` |
| 06‑18 | Desktop merge iterations | `main` sync. | — |

### Era 6 — AI‑SEO & Rearvy 3.0 OS Spec (2026‑06‑27 → 2026‑07‑08)

| Date | Feature | Description | Key locations |
|---|---|---|---|
| 06‑27/28 | **Blog makeover (AI + niche SEO)** | Blog refocused on Rearvy AI + Maria knowledge base, niche business SEO. | `app/blog` |
| 06‑29 | Main merge of web + desktop | PR #27. | — |
| 07‑03 | Iteration (K) | — | — |
| 07‑05 | **Rearvy 3.0 "AI Business OS" spec** | `AGENTS.md` rewritten into the 9‑pillar AI Business OS blueprint (AI Brain, Knowledge Base, File System, Agents, Browser Automation, Email, Calendar, Voice, Security/Collaboration). | `AGENTS.md` |
| 07‑05 | **v0.1.17** (tag) | Marks the 3.0 spec milestone. | git tag |
| 07‑05 | Zod record schema compatibility fix | Provider/schema arg adjustments. | `lib/ai/schemas.ts` |
| 07‑05 | Download & action‑plan unit‑test fixes | Test stabilization. | `*.test.*` |
| 07‑08 | **Final merge: AI capabilities + agents + knowledge base + storage** | Integration of AI brain, agent personas, RAG knowledge base, and storage infrastructure. Bumped to **0.1.19**. | `website/src`, `desktop-app`, `lib/knowledge`, `lib/firebase/storage-bucket` |

---

## Capability Summary by Subsystem (current state, `0.1.19`)

- **AI Brain / Orchestration** — `api/ai/orchestrate`, `model-router` (multi‑provider, fast/quality, health checks), JSON‑schema‑enforced tool calling, persona agents (`maria`, `marketing`, `operations`, `research`, `support`).
- **Knowledge Base (RAG)** — `lib/knowledge/ingestion-pipeline` (chunk→embed→store), `retriever` (cosine, K=5), tenant‑isolated Firestore vectors.
- **File System / Storage** — Firebase Storage upload/download, Electron sandboxed FS via `preload.cjs`, streaming.
- **AI Agents** — Persona prompts in `.github/prompts`, `api/agents` runner, MCP server management.
- **Browser Automation** — Desktop Playwright (`maria-logic.cjs`, `LiveBrowserSessionManager`), cloud Browserbase sessions, browser‑use runner, `work/browser`.
- **Email** — Gmail OAuth, compose/send (draft‑only guardrails), classification, refinement API.
- **Calendar** — Google Calendar OAuth + sync.
- **Voice & Audio** — Maria voice profiles/styles/snippets/dictionary/teams, transcription (`api/audio/transcribe`), background meeting assistant.
- **Security/Collaboration** — Firestore rules (`firestore.rules`, `firestore.trading.rules`), JWT verification, audit logging (`lib/audit`), owner‑scoped access, workspace invites.
- **Work Automation (Automaton)** — Processes/Tasks/Automations/Listeners/Sources/Channels/Skills/Runs/Diary/Memory/Pairing.
- **Trading Copilot** — Opinion engine, guardrails, market data, AI‑Trader sync (ai4trade.ai), monitor scheduler.
- **Integrations** — Shopify, YouTube, Instagram (soon), Facebook (soon), LinkedIn, GitHub, Gmail, Google Calendar, Google Analytics, Razorpay, Excel, Website scraper.
- **Desktop Electron** — Main window + Maria overlay/wake windows, auto‑updater, local server, terminal service, workflow executor (FLERB), serial ports, website runtime.
- **Billing/Subscriptions** — Razorpay Pro, redeem codes, account data‑deletion (GDPR), WhisperNet monitoring.

---

## Maturity Notes

- **Production‑grade / working:** Chat & AI orchestration, model router, RAG knowledge base, Work‑Automation platform, all listed integrations, trading subsystem, Maria voice, desktop Electron shell, Firebase rules + audit logging, billing, transactions, MCP, WhisperNet.
- **Partial / external‑dependency:** `cinematic-hero` (standalone Vite marketing demo, not wired into main bundle), cloud‑computer Browserbase (needs external keys), AI‑Trader (depends on ai4trade.ai).
- **Planned (not implemented):** Qlib signal provider (documented Phase 6, not built).

## Notable Architectural Observations

1. **Extend, don't rewrite** (per `AGENTS.md`): the `work/*` automation platform reuses `lib/work/*` across both web API routes and the desktop workflow executor; agent personas live in `.github/prompts`; RAG uses in‑Firestore vectors + cosine similarity rather than a dedicated vector DB.
2. **No formal CHANGELOG exists** — versioning is driven by git tags (only 4) and explicit desktop `package.json` bumps; commit messages are frequently opaque single letters, so feature dating for those is inferred from adjacent descriptive commits.
3. **Two independently versioned apps converge at 0.1.19** — `website` and `desktop-app` were kept in lockstep from v0.1.16 onward.
