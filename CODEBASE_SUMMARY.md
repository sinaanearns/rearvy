# Rearvy 2.0 — In-Depth Codebase Summary

> **Generated:** April 2026  
> **App Name:** Rearvy — AI-Powered Business Advisor  
> **Version:** 0.1.0

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Directory Structure](#3-project-directory-structure)
4. [Core Application (`src/app`)](#4-core-application-srcapp)
   - [Pages & Routing](#41-pages--routing)
   - [API Routes](#42-api-routes)
5. [UI Components (`src/components`)](#5-ui-components-srccomponents)
6. [Business Logic Library (`src/lib`)](#6-business-logic-library-srclib)
   - [AI Engine](#61-ai-engine)
   - [Firebase Layer](#62-firebase-layer)
   - [Integrations](#63-integrations)
   - [Chat System](#64-chat-system)
   - [Trading Copilot](#65-trading-copilot)
   - [WhisperNet](#66-whispernet)
   - [Memory & Insights](#67-memory--insights)
   - [Billing & Plans](#68-billing--plans)
   - [Utilities](#69-utilities)
7. [Database Schema (Firestore)](#7-database-schema-firestore)
8. [Authentication Flow](#8-authentication-flow)
9. [AI Chat Architecture](#9-ai-chat-architecture)
10. [Integration Sync Architecture](#10-integration-sync-architecture)
11. [Trading Copilot System](#11-trading-copilot-system)
12. [WhisperNet System](#12-whispernet-system)
13. [Environment Variables](#13-environment-variables)
14. [Build & Development Commands](#14-build--development-commands)

---

## 1. Project Overview

**Rearvy** is a full-stack SaaS application that acts as an **AI-powered business advisor**. It connects to a user's data sources (Shopify, YouTube, Instagram, Gmail, Google Analytics, GitHub, Razorpay, Excel, and custom website tracking) and lets users interact with their data through a natural-language AI chat interface.

Key capabilities:
- **AI Chat with Business Data** — Ask plain-English questions about revenue, orders, customers, content performance, and more.
- **Multi-Platform Integrations** — OAuth-based sync from 11+ platforms, stored in Firestore.
- **Trading Copilot** — AI-generated buy/sell/hold signals with professional trader signal aggregation.
- **WhisperNet** — Monitors YouTube and Instagram content for product mentions and forecasts their inventory/sales impact.
- **Memory System** — The AI learns and remembers user preferences, goals, and business facts across sessions.
- **Projects** — Organize chats and data into project workspaces with custom templates.
- **Admin Dashboard** — Platform-level administration interface.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Frontend** | React 19, TypeScript 5, Tailwind CSS 4 |
| **UI Components** | Shadcn/UI, Radix UI, Lucide React |
| **AI SDK** | Vercel AI SDK v6 (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) |
| **LLM Provider** | NVIDIA Integrate API (hosts Kimi K2.5 & Gemma 4 31B) |
| **Auth** | Firebase Authentication (Google OAuth + Email/Password) |
| **Database** | Cloud Firestore (primary datastore for all app data) |
| **File Storage** | Firebase Storage (chat attachments) |
| **Server SDK** | Firebase Admin SDK |
| **Charts** | Lightweight Charts v5 |
| **Notifications** | Sonner (toast library) |
| **Date Handling** | date-fns v4 |
| **Validation** | Zod v4 |
| **Encryption** | Node.js `crypto` (AES-256-GCM for OAuth tokens) |
| **Spreadsheet Parsing** | xlsx (SheetJS) |
| **HTTP** | undici |
| **Deployment** | Vercel (frontend + API routes) |
| **Analytics** | Vercel Analytics + Vercel Speed Insights |

---

## 3. Project Directory Structure

```
rearvy2.0/
├── src/
│   ├── app/                    # Next.js App Router (pages + API routes)
│   │   ├── (auth)/             # Auth-specific pages (login, signup, callback)
│   │   ├── (dashboard)/        # Main authenticated app pages
│   │   ├── admin/              # Admin panel layout and pages
│   │   ├── api/                # All API route handlers
│   │   ├── dashboard/          # Dashboard redirect/entry
│   │   ├── demo/               # Public demo pages
│   │   ├── features/           # Marketing/feature landing pages
│   │   ├── privacy/            # Privacy policy
│   │   ├── terms/              # Terms of service
│   │   ├── layout.tsx          # Root layout (providers, fonts, analytics)
│   │   ├── page.tsx            # Landing/marketing homepage
│   │   ├── globals.css         # Global Tailwind CSS styles
│   │   ├── robots.ts           # robots.txt generation
│   │   └── sitemap.ts          # Sitemap generation
│   │
│   ├── components/             # React UI components
│   │   ├── admin/              # Admin-specific components
│   │   ├── auth/               # Login/signup forms
│   │   ├── chat/               # Chat interface components
│   │   ├── data-cards/         # AI response card renderers
│   │   ├── feedback/           # Feedback submission widget
│   │   ├── insights/           # Insights display
│   │   ├── landing/            # Homepage/marketing components
│   │   ├── layout/             # Navigation, sidebar, headers
│   │   ├── projects/           # Project management components
│   │   ├── ui/                 # Base Shadcn/Radix UI primitives
│   │   ├── auth-provider.tsx   # Firebase auth context provider
│   │   └── theme-provider.tsx  # Dark/light theme provider
│   │
│   ├── hooks/
│   │   ├── use-auth-context.ts # Auth state hook
│   │   └── use-monitor-status.ts # Trading monitor polling hook
│   │
│   ├── lib/                    # Core business logic
│   │   ├── ai/                 # AI engine, models, tools, prompts
│   │   ├── billing/            # Subscription plan logic
│   │   ├── chat/               # Chat session management
│   │   ├── firebase/           # Firebase client + admin setup, schema
│   │   ├── insights/           # Insight generation
│   │   ├── integrations/       # All 11 integration connectors
│   │   ├── tracking/           # Website event tracking
│   │   ├── trading/            # Trading research + monitor engine
│   │   ├── whispernet/         # Product mention monitoring engine
│   │   ├── utils/              # Shared constants, encryption, formatting
│   │   ├── admin-auth.ts       # Admin panel authentication helpers
│   │   ├── memory-events.ts    # Memory event hooks
│   │   ├── memory-store.ts     # Memory CRUD operations
│   │   ├── plans.ts            # Subscription plan definitions
│   │   └── utils.ts            # General utility functions (cn helper)
│   │
│   └── types/
│       ├── database.ts         # TypeScript types for all Firestore docs
│       └── trading.ts          # Trading-specific TypeScript types
│
├── public/                     # Static assets
├── scripts/                    # Trading CLI scripts (smoke tests, scheduler)
├── firestore-json-templates/   # Firestore document templates
├── firestore.indexes.json      # Firestore composite index definitions
├── firestore.trading.rules     # Firestore security rules for trading
├── firebase.json               # Firebase project configuration
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── vercel.json                 # Vercel deployment configuration
└── *.md                        # Documentation and planning files
```

---

## 4. Core Application (`src/app`)

### 4.1 Pages & Routing

The app uses Next.js 15 App Router with route groups for layout separation.

#### Public Routes
| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Marketing homepage |
| `/login` | `app/(auth)/login` | Firebase login (Google + Email/Password) |
| `/signup` | `app/(auth)/signup` | Account creation |
| `/callback` | `app/(auth)/callback` | OAuth callback handler |
| `/demo` | `app/demo` | Public AI chat demo |
| `/features` | `app/features` | Feature showcase pages |
| `/privacy` | `app/privacy` / `app/privacy-policy` | Privacy policy |
| `/terms` | `app/terms` | Terms of service |
| `/data-delete` | `app/data-delete` | GDPR data deletion page |

#### Authenticated Dashboard Routes (under `(dashboard)` group)
| Route | Purpose |
|---|---|
| `/chat` | New chat page |
| `/chat/[chatId]` | Existing chat session |
| `/chats` | Chat history list |
| `/insights` | AI-generated business insights |
| `/integrations` | Manage connected platforms |
| `/projects` | Project workspace management |
| `/join-project` | Join a project by invite |
| `/settings` | User settings (profile, AI model, memory) |
| `/profile` | Public profile page |
| `/users` | User directory (for group/shared chats) |
| `/whispernet` | WhisperNet product monitoring dashboard |
| `/feedback` | Submit feedback / feature requests |

#### Admin Routes (under `/admin`)
- Separate layout with admin authentication
- Platform-level user and data management

### 4.2 API Routes

All API routes live under `src/app/api/` and are Next.js Route Handlers.

#### Chat APIs
| Route | Method | Purpose |
|---|---|---|
| `/api/chat` | `POST` | Main AI chat stream (authenticated users) |
| `/api/chat/demo` | `POST` | Public demo chat (limited tools) |
| `/api/chat/[chatId]` | `GET/PATCH/DELETE` | Chat session CRUD |
| `/api/chat/join` | `POST` | Join a shared/group chat |

#### Integration OAuth & Sync APIs
| Route | Purpose |
|---|---|
| `/api/integrations/shopify/install` | Initiate Shopify OAuth install |
| `/api/integrations/shopify/callback` | Shopify OAuth callback + shop claim |
| `/api/integrations/shopify/sync` | Trigger Shopify data sync |
| `/api/integrations/shopify/webhooks` | Shopify webhook receiver |
| `/api/integrations/google-analytics/connect` | Initiate GA4 OAuth |
| `/api/integrations/google-analytics/callback` | GA4 OAuth callback |
| `/api/integrations/google-analytics/sync` | GA4 data sync |
| `/api/integrations/youtube/connect` | YouTube OAuth |
| `/api/integrations/youtube/callback` | YouTube OAuth callback |
| `/api/integrations/youtube/sync` | YouTube data sync |
| `/api/integrations/github/connect` | GitHub OAuth |
| `/api/integrations/github/callback` | GitHub OAuth callback |
| `/api/integrations/github/sync` | GitHub data sync |
| `/api/integrations/gmail/connect` | Gmail OAuth |
| `/api/integrations/gmail/callback` | Gmail OAuth callback |
| `/api/integrations/gmail/sync` | Gmail data sync |
| `/api/integrations/instagram/connect` | Instagram OAuth |
| `/api/integrations/instagram/callback` | Instagram OAuth callback |
| `/api/integrations/excel/upload` | Excel file upload + parse |
| `/api/integrations/razorpay/connect` | Razorpay API key connect |
| `/api/integrations/razorpay/sync` | Razorpay payment sync |
| `/api/integrations/website/connect` | Website tracking connect |
| `/api/integrations/facebook/connect` | Facebook OAuth |
| `/api/integrations/facebook/callback` | Facebook OAuth callback |

#### Shared Google Callback
| Route | Purpose |
|---|---|
| `/api/integrations/google/callback` | Shared Google OAuth callback (handles Gmail, YouTube, GA4) |

#### Other APIs
| Route | Method | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | Various | Auth helpers |
| `/api/account/profile` | `GET/PATCH` | User profile management |
| `/api/account/delete` | `DELETE` | Account deletion + GDPR |
| `/api/dashboard` | `GET` | Dashboard data aggregation |
| `/api/insights` | `GET/POST` | AI insight generation |
| `/api/projects` | `GET/POST` | Project CRUD |
| `/api/projects/[id]` | `GET/PATCH/DELETE` | Single project ops |
| `/api/users` | `GET` | User search for collaboration |
| `/api/billing` | Various | Subscription management |
| `/api/tracking` | `POST` | Website event ingestion |
| `/api/trading/monitors` | `GET/POST/PATCH` | Trading monitor management |
| `/api/admin/*` | Various | Admin-only platform management |
| `/api/webhooks/shopify` | `POST` | Shopify webhook processing |
| `/api/internal/sync-jobs/run` | `POST` | Internal sync job worker |
| `/api/internal/trading/monitor-jobs/run` | `GET/POST` | Trading monitor scheduler |
| `/api/whispernet/*` | Various | WhisperNet processing |

---

## 5. UI Components (`src/components`)

### Chat Components (`components/chat/`)
The chat interface is the core of the app. Key components:
- **`chat-container.tsx`** — Main chat orchestration component. Manages message state, streaming, tool results, and renders the full chat UI.
- **`message-bubble.tsx`** — Renders individual chat messages with Markdown, code highlighting, and special headers for AI tool responses (e.g. "💡 Trading Opinion").
- **`chat-input.tsx`** — Textarea with file attachment, slash commands, and submit logic.
- **`chat-header.tsx`** — Chat title, model selector, and chat settings.
- **`model-selector.tsx`** — Dropdown to switch between Gamma (Gemma 4 31B) and Kimi K2.5 models.
- **`chat-history-sidebar.tsx`** — Sidebar listing past chats grouped by project.

### Data Cards (`components/data-cards/`)
These components render rich AI tool response cards — replacing plain text with visual, interactive outputs:
- **`card-router.tsx`** — Routes tool result data to the correct card component.
- **`collections-card.tsx`** — Sales collections summary (revenue table, trend charts).
- **`revenue-card.tsx`** — Revenue breakdown card.
- **`orders-card.tsx`** — Order list and status summary.
- **`products-card.tsx`** — Product performance table.
- **`youtube-card.tsx`** — YouTube channel/video stats card.
- **`instagram-card.tsx`** — Instagram account and post stats.
- **`google-analytics-card.tsx`** — GA4 metrics card.
- **`trading-opinion-card.tsx`** — Trading signal card with Buy/Sell/Hold badge, entry/stop/target levels, and a Start/Stop Monitor button.
- **`whispernet-card.tsx`** — WhisperNet analysis result (mention detection + forecast).

### Layout Components (`components/layout/`)
- **`sidebar.tsx`** — Main navigation sidebar with links to all dashboard sections.
- **`header.tsx`** — Top navigation bar.
- **`dashboard-layout.tsx`** — Authenticated app shell wrapping all dashboard pages.

### Auth Components (`components/auth/`)
- Login form (Google SSO + Email/Password)
- Signup form with onboarding

---

## 6. Business Logic Library (`src/lib`)

### 6.1 AI Engine

Located at `src/lib/ai/`.

#### `models.ts`
Defines all available LLM models and selection logic:
- **`CHAT_MODEL_OPTIONS`** — Built-in models:
  - `gamma` → `google/gemma-4-31b-it` (balanced, vision-capable via `meta/llama-3.2-11b-vision-instruct`)
  - `kimi-k2.5` → `moonshotai/kimi-k2-instruct` (fast)
- **Custom models** — Users can define custom NVIDIA model IDs, encoded into a `custom:<source>:<model>` ID scheme.
- `resolveChatModelTier()` — Selects model tier from request.
- `resolveChatProviderModel()` — Returns the actual NVIDIA model string, switching to a vision model when image input is detected.

#### `system-prompt.ts`
Builds the AI's system prompt dynamically for each request:
- `loadSystemPromptContext()` — Fetches user profile, connected integrations, monitored websites, top memories, and project context from Firestore.
- `buildSystemPrompt()` — Assembles a context-rich prompt string that:
  - Tells the AI the user's business name, type, currency, and timezone.
  - Lists connected integrations so the AI only references available data.
  - Injects the user's top 5 memories (sorted by importance).
  - Includes project context and project template add-ons.
  - Supports two modes: `fast` (minimal prompt for instant replies) and `deep` (full context).
  - Configures web research mode: `tools` (use `searchWeb`/`fetchWebPage`), `prefetched` (server-fetched research injected), or `none`.
  - Includes detailed instructions for trading signal aggregator mode.

#### `tools/` — AI Tool Registry
The AI has access to **35+ tools** organized by domain:

| Category | Tools |
|---|---|
| **E-commerce** | `getCollectionsOverview`, `getCollectionsBreakdown`, `getRevenue`, `getRevenueBreakdown`, `getOrders`, `getOrderDetails`, `getTopProducts`, `getProductDetails`, `getInventoryStatus` |
| **Analytics** | `comparePerformance`, `getCustomerMetrics` |
| **YouTube** | `getYouTubeChannelStats`, `getTopYouTubeVideos`, `getYouTubeVideoPerformance`, `getYouTubeComments` |
| **Instagram** | `getInstagramAccountStats`, `getTopInstagramPosts`, `getInstagramPostPerformance`, `getInstagramComments` |
| **Google Analytics** | `getGoogleAnalyticsOverview`, `getGoogleAnalyticsTopPages`, `getGoogleAnalyticsTrafficSources` |
| **Website Tracking** | `getWebsiteOverview`, `getTopPages`, `getTrafficSources` |
| **Gmail** | `getGmailInboxSummary`, `getRecentGmailMessages`, `searchGmailMessages`, `getGmailSettings` |
| **Reviews** | `getProductReviews`, `getReviewSummary` |
| **Web Research** | `searchWeb`, `fetchWebPage` |
| **Memory** | `searchMemories`, `saveMemory` |
| **Utility** | `getIntegrationStatus`, `getCurrentDate`, `getRecentInsights` |
| **WhisperNet** | `runWhispernetAnalysis` |
| **Trading** | `getTradingOpinion`, `getBestTradeOpportunity`, `getVerifiedTraderSignals` |

Each tool is a factory function taking a `ToolContext` (containing `userId`, `adminDb` Firestore handle, and plan info) and returns a Vercel AI SDK `tool()` object with a Zod schema for inputs and an `execute` function.

#### `message-parts.ts`
Handles conversion between Vercel AI SDK message format and Firestore storage format:
- `normalizeIncomingMessagesForModel()` — Reconstructs complete message history from stored parts for the model.
- `buildStoredUserMessageParts()` — Serializes user message content (text + image attachments) for Firestore.
- `messageHasImageParts()` — Detects if a message contains image attachments (triggers vision model selection).

#### `smart-commands.ts`
Handles slash commands (`/sku`, `/profit`, `/ltv`, `/roas`, `/save`, `/warn`, `/gross`, `/net`). Parses user messages, injects formatted instruction blocks into the system prompt for specific output formats.

#### `sanitize.ts`
Strips internal tool names and JSON payloads from assistant responses before they are stored or shown to users.

#### `web-research-intent.ts`
Classifies whether a user message requires web research. Used to decide whether to pre-fetch web content server-side before streaming.

#### `free-tier-web-research.ts`
Builds pre-fetched web research context (search + fetch top results) injected into the system prompt for free-tier users who may not have the web research tools enabled live.

#### `schemas.ts`
Zod schemas for validating AI tool input/output shapes.

#### `system-prompts/`
Directory of specialized system prompt templates for different project types.

### 6.2 Firebase Layer

Located at `src/lib/firebase/`.

| File | Purpose |
|---|---|
| `client.ts` | Firebase client SDK initialization (auth, Firestore client) |
| `server.ts` | Firebase Admin SDK initialization (server-side) |
| `admin.ts` | Exports `adminDb` (Admin Firestore) and `adminAuth` for server use |
| `auth.ts` | Auth helper functions (verify tokens, create sessions) |
| `middleware.ts` | `requireAuth()` middleware — verifies Firebase ID tokens in API routes |
| `firestore.ts` | Typed Firestore helpers (read/write wrappers with type safety) |
| `schema.ts` | All Firestore collection names (`COLLECTIONS`) and TypeScript interface definitions for every document type |
| `storage-bucket.ts` | Firebase Storage bucket helpers for chat attachments |
| `trading-monitors-schema.ts` | Firestore schema for trading monitor documents |

### 6.3 Integrations

Located at `src/lib/integrations/`. Each integration follows the same pattern:
1. **OAuth file** — Handles token exchange, storage, refresh
2. **Sync file** — Fetches data from external API, upserts to Firestore

| Integration | Files | Data Collected |
|---|---|---|
| **Shopify** | `shopify/` | Products, orders, customers, product reviews |
| **YouTube** | `youtube/` | Channel stats, videos, comments, analytics |
| **Instagram** | `instagram/` | Account stats, posts, comments, analytics |
| **Facebook** | `facebook/` | Pages, posts, comments, analytics |
| **Google Analytics** | `google-analytics/` | Sessions, pageviews, traffic sources, top pages |
| **Gmail** | `gmail/` | Messages (with AI classification), threads |
| **GitHub** | `github/` | Repos, issues, pull requests |
| **Razorpay** | `razorpay/` | Payments |
| **Excel** | `excel/` | Spreadsheet data as structured rows |
| **Website** | `website/` | Custom event tracking (sessions, pageviews, events) |
| **Facebook (OAuth)** | `facebook/` | Facebook page + post data |

#### Shared OAuth Infrastructure
- `google-oauth.ts` — Shared Google OAuth flow (handles YouTube, GA4, Gmail with one callback URL)
- `excel-oauth.ts` — Excel file OAuth/upload handler
- `oauth-session.ts` — Temporary OAuth state storage in Firestore during OAuth flows

#### Sync Jobs (`sync-jobs.ts`)
A durable job queue built on Firestore:
- OAuth callbacks enqueue sync jobs rather than syncing inline.
- Jobs have retry logic with exponential backoff.
- The internal worker route (`POST /api/internal/sync-jobs/run`) processes due jobs.
- Job statuses: `pending`, `running`, `completed`, `failed`.

#### `schema-health.ts`
Validates and repairs Firestore documents when schema migrations occur (e.g. adds missing fields with defaults).

### 6.4 Chat System

Located at `src/lib/chat/`.

| File | Purpose |
|---|---|
| `client-chat-sessions.ts` | Client-side chat session management (create, list, update) |
| `system-chats.ts` | Creates system-managed chats (e.g. onboarding) |
| `direct-messages.ts` | Direct message between users |
| `attachments.ts` | Chat attachment metadata helpers |
| `attachment-storage.ts` | Upload/download via Firebase Storage |

### 6.5 Trading Copilot

Located at `src/lib/trading/`.

| File | Purpose |
|---|---|
| `research.ts` | Market research data fetching (price, indicators, recent news) |
| `opinion-engine.ts` | Core AI logic — takes market data, returns Buy/Sell/Hold recommendation with entry/stop/target levels |
| `market-data.ts` | Real-time market data fetching from configured provider |
| `monitor-jobs.ts` | Trading monitor polling engine (Firestore-backed scheduler) |
| `guardrails.ts` | Safety limits — max 3 monitors per user, min 60s polling interval, never execute real trades |
| `price-format.ts` | Price and percentage formatting utilities |

**API endpoints for trading monitors:**
- `POST /api/trading/monitors` — Create a monitor (enforces 3-monitor limit)
- `GET /api/trading/monitors?chatId=XXX` — List monitors for a chat
- `PATCH /api/trading/monitors/{id}` — Stop/resume a monitor
- `GET /api/internal/trading/monitor-jobs/run` — Health check
- `POST /api/internal/trading/monitor-jobs/run` — Process due monitor jobs

**AI Tools:**
- `getTradingOpinion` — Research a specific asset and return a structured opinion
- `getBestTradeOpportunity` — Scan for the best current trade setup across assets
- `getVerifiedTraderSignals` — Fetch from the `trader_signals` Firestore collection (populated by verified professional traders)

### 6.6 WhisperNet

Located at `src/lib/whispernet/`.

WhisperNet monitors YouTube and Instagram content for mentions of the user's products and forecasts sales/inventory impacts.

| File | Purpose |
|---|---|
| `core.ts` | Core detection engine — fuzzy and exact matching of product names/aliases in video titles, descriptions, captions, and transcripts |
| `service.ts` | High-level service — orchestrates processing jobs, writes detections and forecasts to Firestore |

**How it works:**
1. User creates a **Watcher** for a product (with aliases, required keywords, excluded phrases, fuzzy matching config).
2. WhisperNet scans new YouTube videos and Instagram posts from connected accounts.
3. Detections are stored as `WhisperNetMention` documents in Firestore.
4. For each detection, a forecast is generated (`WhisperNetForecast`) estimating incremental units/revenue over 48 hours.
5. High-severity detections generate `WhisperNetAlert` notifications.
6. The AI tool `runWhispernetAnalysis` can trigger on-demand analysis from chat.

**Forecasting model inputs:**
- Detection confidence and source (title > description > transcript > comment)
- Creator reach (views, impressions)
- Baseline sales velocity (last 7/30 days)
- Inventory snapshot and low-inventory threshold
- Stockout risk assessment

### 6.7 Memory & Insights

#### Memory System (`memory-store.ts`, `memory-events.ts`)
The AI can remember facts about the user's business across chat sessions:
- `saveMemoryRecord()` — Creates or updates a memory in the `memories` Firestore collection.
- `extractAutoMemoryCandidate()` — Analyzes AI responses to automatically extract important facts for auto-saving.
- Memories have `importance` (1-10) and `memory_type` (`preference`, `fact`, `goal`, `decision`).
- The top 5 active memories (by importance) are injected into every system prompt.
- The AI tool `saveMemory` lets the AI explicitly save memories, and `searchMemories` lets it retrieve them.

#### Insights (`src/lib/insights/`)
AI-generated periodic business insights stored in the `insights` Firestore collection. Surfaced on the `/insights` dashboard page.

### 6.8 Billing & Plans

Located at `src/lib/plans.ts` and `src/lib/billing/`.

Currently, Rearvy offers a single **Free plan** with full feature access:
- Unlimited workspaces and core dashboards
- Chat with business data
- Web research tools and alerts
- Project templates and collaboration
- Priority support

The plan system is designed for future expansion (the `SubscriptionPlan` type is `"free"` today but is referenced throughout the codebase for feature-gating).

### 6.9 Utilities

| File | Purpose |
|---|---|
| `utils/constants.ts` | App name, route constants, chat config (model names, max steps, summary thresholds) |
| `utils/encryption.ts` | AES-256-GCM encryption/decryption for OAuth tokens stored in Firestore |
| `utils/formatting.ts` | Date, currency, and number formatting helpers |
| `utils/url.ts` | URL construction helpers (OAuth redirect URIs, callback URLs) |
| `utils.ts` | `cn()` Tailwind class merging helper (clsx + tailwind-merge) |
| `admin-auth.ts` | Admin panel auth verification |

---

## 7. Database Schema (Firestore)

All data is stored in Cloud Firestore. Collections are defined in `src/lib/firebase/schema.ts`.

### Core Collections
| Collection | Document Type | Description |
|---|---|---|
| `profiles` | `Profile` | User profiles (name, email, business name/type, plan, timezone, currency) |
| `projects` | `Project` | Project workspaces |
| `project_templates` | — | Template definitions with system prompt add-ons |
| `chats` | `Chat` | Chat sessions (with optional project linkage, forking, group support) |
| `messages` | `Message` | Individual chat messages with stored AI tool parts |
| `memories` | — | User business memories (importance-ranked, auto-saved by AI) |
| `insights` | — | AI-generated business insights |

### Integration Collections
| Collection | Description |
|---|---|
| `integrations` | Connected platform OAuth records (encrypted tokens) |
| `integration_sync_jobs` | Durable sync job queue |
| `products` | Synced product catalog (Shopify) |
| `orders` | Synced order history |
| `product_reviews` | Product review data |
| `razorpay_payments` | Razorpay payment records |
| `excel_workbooks` | Uploaded Excel workbooks |
| `excel_rows` | Parsed Excel row data |
| `github_repos` | GitHub repository data |
| `github_issues` | GitHub issue data |
| `github_pull_requests` | GitHub PR data |

### Social & Content Collections
| Collection | Description |
|---|---|
| `youtube_channels` | YouTube channel metadata and stats |
| `youtube_videos` | Individual video data |
| `youtube_comments` | Video comments |
| `youtube_analytics` | Time-series analytics snapshots |
| `instagram_accounts` | Instagram account metadata |
| `instagram_posts` | Post data |
| `instagram_comments` | Post comments |
| `instagram_analytics` | Time-series analytics snapshots |
| `facebook_pages` | Facebook page data |
| `facebook_posts` | Facebook post data |
| `facebook_comments` | Post comments |
| `facebook_analytics` | Facebook analytics |
| `gmail_messages` | Synced Gmail messages (with AI classification) |
| `gmail_threads` | Gmail thread metadata |

### Website Tracking Collections
| Collection | Description |
|---|---|
| `websites` | Connected website configurations |
| `website_sessions` | User session data |
| `website_pageviews` | Individual pageview events |
| `website_events` | Custom tracking events |

### WhisperNet Collections
| Collection | Description |
|---|---|
| `whispernet_watchers` | Product watcher configurations |
| `whispernet_content_items` | Indexed YouTube/Instagram content |
| `whispernet_mentions` | Detected product mentions |
| `whispernet_forecasts` | Sales impact forecasts per mention |
| `whispernet_alerts` | Generated alerts for critical detections |
| `whispernet_processing_jobs` | Async processing job records |

### Trading Collections
| Collection | Description |
|---|---|
| `trader_signals` | Verified professional trader signals (buy/sell/hold records) |

### Other Collections
| Collection | Description |
|---|---|
| `business_metrics` | Aggregated business KPI snapshots |
| `feedback_submissions` | User-submitted bug reports / feature requests |
| `profile_follow_requests` | Follow/collaboration request records |
| `chat_requests` | Chat join requests |

---

## 8. Authentication Flow

Rearvy uses **Firebase Authentication** exclusively.

### Sign-In Methods
1. **Google OAuth** via Firebase client SDK (`signInWithPopup` / `signInWithRedirect`)
2. **Email/Password** via Firebase client SDK

### Auth Flow
1. User signs in client-side via Firebase Auth.
2. Firebase issues an **ID Token** (JWT).
3. For all protected API routes, the client sends `Authorization: Bearer <idToken>` in the request header.
4. Server-side: `requireAuth()` middleware in `src/lib/firebase/middleware.ts` calls `adminAuth.verifyIdToken()` to validate the token.
5. If valid, the `userId` is extracted and used for all Firestore queries.
6. On first login, a `Profile` document is created in the `profiles` Firestore collection.

### Admin Auth
- Admin routes use a separate verification layer (`admin-auth.ts`) that checks whether the authenticated user has an admin role.

---

## 9. AI Chat Architecture

The main chat endpoint is `POST /api/chat/route.ts`. Here is the full request lifecycle:

```
Client sends: { messages, chatId, aiModel, responseMode }
       │
       ▼
1. requireAuth() — verify Firebase ID token
       │
       ▼
2. Load chat from Firestore, verify user ownership + project membership
       │
       ▼
3. resolveChatModelTier() — determine which model to use
       │
       ▼
4. Check for slash commands (detectAndProcessCommand)
       │
       ▼
5. loadSystemPromptContext() — fetch profile, integrations, websites, memories, project from Firestore
       │
       ▼
6. buildSystemPrompt() — assemble context-rich system prompt
       │
       ▼
7. createToolRegistry() — instantiate all AI tools with userId + adminDb
       │
       ▼
8. normalizeIncomingMessagesForModel() — reconstruct full message history from stored parts
       │
       ▼
9. messageHasImageParts() → if true, use vision model variant
       │
       ▼
10. streamText() via Vercel AI SDK
    - Provider: NVIDIA (via @ai-sdk/openai compatible endpoint)
    - Model: resolved provider model string
    - Max tool steps: 5 (CHAT_CONFIG.MAX_TOOL_STEPS)
    - Tools: full registry of 35+ tools
    - stopWhen: stepCountIs(MAX_TOOL_STEPS)
       │
       ▼
11. onFinish callback:
    a. sanitizeAssistantText() — strip internal tool names
    b. extractAutoMemoryCandidate() — auto-extract facts
    c. Save assistant message to Firestore (with tool parts)
    d. Save user message to Firestore
    e. Auto-generate chat title if first message
    f. If memory candidate found, saveMemoryRecord()
       │
       ▼
12. Stream response back to client (SSE/data stream)
```

### Conversation Summarization
When `MAX_MESSAGES_BEFORE_SUMMARY` (10) messages accumulate, the system generates a summary of the conversation and stores it. This keeps context window usage efficient.

### Message Storage
Each message is stored in Firestore with:
- `role`: `user` | `assistant`
- `content`: plain text summary
- `parts`: full structured parts (text, tool-call, tool-result, image) for exact model reconstruction

---

## 10. Integration Sync Architecture

Each integration follows a **connect → sync → tools** lifecycle:

### Connect Phase
1. User clicks "Connect" on the integrations page.
2. App redirects to the OAuth provider with a state parameter stored in Firestore (`oauth-session.ts`).
3. Provider redirects back to the callback route.
4. Callback exchanges code for tokens.
5. Tokens are **AES-256-GCM encrypted** (`utils/encryption.ts`) before storage.
6. An `Integration` document is created in Firestore.
7. A sync job is **enqueued** (not run inline) via `sync-jobs.ts`.

### Sync Phase
1. The internal worker (`POST /api/internal/sync-jobs/run`) polls for due jobs.
2. For each due job, the corresponding sync function runs.
3. Data is upserted to Firestore using the integration's collection(s).
4. `last_synced_at` and `sync_cursor` are updated to enable incremental syncing.
5. On failure, the job is retried with exponential backoff.

### Tool Access Phase
When the AI chat receives a question:
1. The tool registry looks up the user's `Integration` documents for the relevant provider.
2. If found and `status === "active"`, the tool decrypts the access token and makes live API calls.
3. If the token is expired, the tool attempts a refresh before failing.
4. Results are formatted and returned to the AI, which summarizes them in natural language.

---

## 11. Trading Copilot System

### Overview
The Trading Copilot provides AI-generated trade recommendations, never executes real trades. It operates in two modes:
1. **Opinion Mode** — On-demand analysis for a specific asset in chat.
2. **Monitor Mode** — Continuous background monitoring with configurable polling intervals.

### Core Rules (Guardrails)
- Maximum 3 active monitors per user.
- Minimum 60-second polling interval.
- No real trades executed — recommendations only.
- Falls back to **Hold** on any uncertainty.
- All opinions are audit-logged in Firestore.

### Trading Opinion Card
When the AI calls `getTradingOpinion`, the UI renders a `TradingOpinionCard` component with:
- **Action badge**: Buy / Sell / Hold (color-coded)
- **Asset & timeframe**
- **Entry price, Stop Loss, Take Profit**
- **Confidence level**
- **Rationale** from market research
- **Start Monitor / Stop Monitor** button

### Trader Signal Aggregator Mode
When users ask about "what professional traders are doing", the AI switches to **signal-aggregator mode**:
- Calls `getVerifiedTraderSignals` first.
- Reports trader activity, confidence level, and consensus.
- Never adds its own price predictions.
- Outputs a `trade-chart` code block with the strongest consensus trade.
- If no verified activity: `"No confirmed professional trader signals at this time."`

---

## 12. WhisperNet System

WhisperNet is a competitive intelligence tool for Shopify store owners who also have YouTube/Instagram integrations.

### Setup
1. User creates a **Watcher** for a product with:
   - Product title and handle
   - Aliases (alternate names)
   - Required keywords (must appear near mention)
   - Excluded phrases (filter out false positives)
   - Fuzzy match toggle
   - Low inventory threshold (units)

### Detection Engine (`core.ts`)
- Scans text fields in priority order: `title` > `description` > `caption` > `transcript` > `comment`
- Exact match: straightforward substring search
- Fuzzy match: Levenshtein-distance-based matching for typos and variations
- Produces a detection with `confidence` (0–1), `matchedPhrase`, `contextWindow`, and `reasons`

### Forecasting
For each detection, a 48-hour forecast is generated:
- **Baseline**: average sales velocity from last 7/30 days
- **Multiplier**: based on detection confidence × creator reach
- **Stockout risk**: compares projected additional units to current inventory
- **Confidence band**: lower/upper bound estimates

### Alerts
- `info` — Low confidence detection, minor impact
- `warning` — Medium confidence or medium stockout risk
- `critical` — High confidence + high stockout risk (restock immediately)

---

## 13. Environment Variables

### Firebase (Client-Side)
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

### Firebase (Server-Side)
```
FIREBASE_SERVICE_ACCOUNT      # JSON service account key (base64 or raw JSON)
```

### AI
```
NVIDIA_API_KEY                # NVIDIA Integrate API key (for all LLM calls)
```

### Security
```
INTEGRATION_ENCRYPTION_KEY    # 32-byte hex key for AES-256-GCM token encryption
NEXT_PUBLIC_APP_URL           # Production URL (used for OAuth redirects)
SYNC_WORKER_SECRET            # Secret for internal sync worker API calls
INTERNAL_API_SECRET           # Secret for internal trading monitor API calls
```

### Google (OAuth for Gmail, YouTube, GA4)
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_ORIGIN  # Optional: override OAuth redirect origin
```

### Shopify
```
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
SHOPIFY_WEBHOOK_SECRET
```

### GitHub
```
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
```

---

## 14. Build & Development Commands

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm run start:prod

# Lint the codebase
npm run lint

# Trading scripts
npm run trading:auth-gcloud      # Authenticate with Google Cloud from env vars
npm run trading:smoke-phase1     # Phase 1 smoke tests for trading system
npm run trading:run-cycle        # Manually run a trading monitor cycle
npm run trading:setup-scheduler  # Set up Cloud Scheduler for monitor polling
```

### Key Configuration Files
| File | Purpose |
|---|---|
| `next.config.ts` | Next.js configuration (API rewrites, CORS headers) |
| `tsconfig.json` | TypeScript settings (`@/` path alias → `./src/`) |
| `eslint.config.mjs` | ESLint rules (extends `eslint-config-next`) |
| `firebase.json` | Firebase hosting + Firestore rules configuration |
| `firestore.indexes.json` | Composite Firestore index definitions |
| `vercel.json` | Vercel deployment configuration |
| `components.json` | Shadcn/UI component configuration |
| `postcss.config.mjs` | PostCSS configuration for Tailwind CSS v4 |

---

*This document was generated from static code analysis of the Rearvy 2.0 repository. It reflects the state of the codebase as of April 2026.*
