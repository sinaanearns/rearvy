<div align="center">

# ⚡ Rearvy- The Open AI Business Operating System

**The open-source, actionable replacement for Claude Cowork and ChatGPT Work.**  
*An autonomous AI executive that manages businesses, automates browser operations, understands company knowledge, and executes real work across connected systems.*

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-786%20passing-brightgreen.svg)](website/src)
[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org)
[![Electron](https://img.shields.io/badge/Electron-Desktop_Runtime-47848F?logo=electron)](https://www.electronjs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Quickstart](#-quick-start) • [Why Rearvy?](#-the-open-source-replacement-for-claude-cowork--chatgpt-work) • [Architecture](#-architecture) • [Features](#-core-capabilities) • [B2B Ecosystem](#-b2b-partner-ecosystem) • [Contributing](#-contributing) • [Security](#-security)

</div>

---

## 🌟 What is Rearvy?

Rearvy is the **open-source alternative and replacement for Claude Cowork / Computer Use and ChatGPT Work / Enterprise**.

While conversational chatbots act like a *"brain in a jar"* (giving advice but leaving you to do all the manual copy-pasting, tab-switching, and data entry), **Rearvy is an AI operator with hands, memory, and native execution**.

### 🔄 The Open-Source Replacement for Claude Cowork & ChatGPT Work

| Capability | ChatGPT Work / Claude Projects | Rearvy (Open AI Business OS) |
| :--- | :--- | :--- |
| **Execution Model** | **Advisory only** — Generates text/code; you manually execute it. | **Action & Execution** — Opens browsers, fills forms, clicks buttons, and finishes tasks. |
| **Computer & Browser Automation** | Sandboxed or raw developer APIs with no turn-key business interface. | **Turnkey Desktop & Cloud Runners** — Playwright + `browser-use` with live visual previews. |
| **Company Memory** | Ephemeral chats lost in sidebars; loose document uploads. | **Structured Company Knowledge Base** — Bounded RAG, connector briefs, and organizational memory. |
| **Scheduled Operations** | **Reactive only** — Only runs when you type a prompt in front of your screen. | **24/7 Autonomous Background Workers** — Runs scheduled daily/hourly scraping, triage, and syncs. |
| **Model Independence** | Locked to a single proprietary vendor (OpenAI or Anthropic). | **Multi-Model Orchestrator** — Use Claude 3.7 for logic, DeepSeek R1 for reasoning, or local Ollama/NVIDIA. |
| **Data Privacy & Control** | Closed-source SaaS with multi-tenant cloud storage. | **100% Open-Source & Self-Hostable** — Runs locally on your machine with Bring-Your-Own-Keys (BYOK). |

---

### Core Pillars
Rearvy unifies:
* 🤖 **Autonomous Multi-Agent Execution** (Research, Operations, Marketing, Finance)
* 🌐 **Desktop & Cloud Browser Automation** (Form filling, live scraping behind logins via Playwright & `browser-use`)
* 📚 **Organizational Knowledge Base** (Multi-tenant RAG + Firestore memory)
* ⚡ **24/7 Autonomous Cloud Sandboxes** (Scheduled background runners without keeping your laptop on)
* 🤝 **Verified B2B Partner Perks Hub** (Stripe, Mercury, Bright Data, HubSpot, and dev infrastructure discounts)
* 💻 **Native Desktop Shell** (Sandboxed local filesystem access with Electron IPC)

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Git**

### 2. Clone & Install
```bash
# Clone the repository
git clone https://github.com/sinaanearns/rearvy2.0.git
cd rearvy2.0

# Install all dependencies across root, website, and desktop-app
npm run install:all
```

### 3. Configure Environment
```bash
# Copy sample environment configuration
cp .env.local.example .env.local
```
Add your preferred LLM provider keys (e.g. `NVIDIA_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) and optional `ASSEMBLYAI_API_KEY`.

### 4. Run Development Servers
```bash
# Launch both Web Platform and Desktop App concurrently:
npm run dev:both

# Or run separately:
npm run dev:web       # Next.js Web Workspace (http://localhost:3000)
npm run dev:desktop   # Electron Desktop Client
```

---

## 🏗️ Architecture

Rearvy is organized as a clean monorepo with strict separation of concerns:

```
rearvy2.0/
├── website/                  # Next.js 15 App Router (Web platform, AI APIs, Business Dashboard)
│   ├── src/app/              # App Router routes & API endpoints
│   ├── src/components/       # UI components & Business Panels (Perks, Cloud Compute, Connectors)
│   └── src/lib/              # AI SDK integration, RAG, connector brief generator, normalizers
├── desktop-app/              # Electron Desktop Shell & Native IPC runtime
│   ├── main.cjs              # Electron main process & IPC handlers
│   └── preload.cjs           # Sandboxed IPC bridge
├── schemas/                  # Bounded connector manifests & data schemas
├── docs/                     # Runbooks, trading manifests & guides
├── CONTRIBUTING.md           # Contribution guidelines & coding standards
├── LICENSE                   # Apache 2.0 Open Source License
└── package.json              # Monorepo orchestration scripts
```

---

## ⚡ Core Capabilities

### 1. 🧠 Multi-Model AI Orchestrator
- Leverages the Vercel AI SDK with structural JSON-first outputs.
- Model-agnostic: Route complex reasoning to Claude 3.7 Sonnet, high-speed logic to DeepSeek R1, multi-modal tasks to Gemini 2.0, or local on-prem inference via Ollama / NVIDIA NIM.
- Mandatory `assumptions[]` and `confidence_score` validation before executing long-running workflows.

### 2. 🌐 Headless Browser & Desktop Automation
- Autonomous web navigation, form filling, and price tracking powered by Playwright and `browser-use`.
- Automated credential masking in logs and video recordings.
- Works on non-API websites and supplier portals.

### 3. 📚 Company Knowledge Base (RAG)
- Multi-tenant Firestore document indexing.
- Context-aware RAG strictly bounded to top relevant citations ($K=5$) to preserve token efficiency.
- Zero cross-tenant data leakage.

### 4. ⚡ 24/7 Cloud Compute & Sandboxes
- Deploy scheduled background agent jobs that run 24/7 in dedicated cloud sandboxes.
- Real-time execution telemetry and streaming live worker logs.

### 5. 🤝 B2B Partner Perks & Verified Ecosystem
- Direct integrations with exclusive member perks:
  - **Stripe**: $500 fee-free payment processing credits
  - **Mercury**: $250 cash bonus + zero-fee USD/EUR treasury accounts
  - **Bright Data**: $250 proxy & web scraping credits for headless agents
  - **HubSpot**: Up to 75% off year 1 CRM & sales software
  - **OpenRouter & DeepSeek**: $50 AI reasoning token credits
- One-click Connector Brief generator to integrate any SaaS tool with your Rearvy agents.

---

## 🧪 Validation & Testing

Rearvy maintains a strict enterprise test suite:

```bash
# Run unit & integration tests (786 tests passing)
npm run test

# Perform TypeScript compile check
npm run typecheck

# Run linter
npm run lint

# Full CI pre-flight check
npm run check:active
```

---

## 📦 Desktop Packaging

Build signed native desktop binaries:

```bash
# Windows Installer (.exe / NSIS)
npm run app:build:win

# macOS Package (.dmg / .app)
npm run app:build:mac
```

---

## 🤝 Contributing

We love contributions! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

To propose a new SaaS connector or agent ability:
1. Check existing schemas in `schemas/`.
2. Follow our [Connector Request Template](.github/ISSUE_TEMPLATE/connector_request.md).
3. Submit a PR with unit tests.

---

## 🛡️ Security

For vulnerability disclosures, please review our [Security Policy](SECURITY.md) or email `security@rearvy.com`. Please **do not** open public issues for sensitive security reports.

---

## 📄 License

Rearvy is open-source software licensed under the [Apache License, Version 2.0](LICENSE).

&copy; 2026 Rearvy Inc. & Contributors. Built for autonomous AI business operations.
