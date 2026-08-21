# Contributing to Rearvy

Thank you for your interest in contributing to **Rearvy** — the world's first AI Business Operating System!

We welcome contributions from developers, researchers, designers, and business operators. Whether you are building a new connector, improving browser automation routines, fixing bugs, or expanding our documentation, this guide will help you get started quickly.

---

## 🌟 Code of Conduct

By participating in the Rearvy project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all community members with respect and professionalism.

---

## 🏗️ Architecture Overview

Rearvy is structured as a monorepo with clean separation between the web platform and the native desktop runtime:

* **`website/`**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Vercel AI SDK, and Firebase SDK. Contains the web workspace, business dashboard, and cloud APIs.
* **`desktop-app/`**: Electron shell providing sandboxed local filesystem access, Playwright / `browser-use` automation, and native OS bridges.
* **`schemas/` & `firestore-json-templates/`**: Database definitions, bounded connector schemas, and validation contracts.

---

## 🚀 Local Development Setup

### 1. Prerequisites
* **Node.js**: `v20.x` or higher
* **npm**: `v10.x` or higher
* **Git**
* (Optional) **Python 3.11+** if developing custom `browser-use` sub-agent scrapers.

### 2. Clone & Install
```bash
git clone https://github.com/mutalvita-cyber/rearvy2.0.git
cd rearvy2.0

# Install all workspace dependencies across root, website, and desktop-app
npm run install:all
```

### 3. Configure Environment Variables
Copy `.env.local.example` to `.env.local` at the root and fill in the required API keys (such as `NVIDIA_API_KEY`, `ASSEMBLYAI_API_KEY`, etc.):

```bash
cp .env.local.example .env.local
```

### 4. Run Development Servers
```bash
# Run web workspace only (http://localhost:3000)
npm run dev:web

# Run desktop app only
npm run dev:desktop

# Run both concurrently
npm run dev:both
```

---

## 🧪 Validation & Testing

Before submitting a pull request, ensure all validation checks pass:

```bash
# 1. Typecheck the Next.js codebase
npm run typecheck

# 2. Run the test suite (780+ unit and integration tests)
npm run test

# 3. Lint the codebase
npm run lint

# 4. Run complete active validation
npm run check:active
```

---

## 🔌 Contributing New Connectors & Agent Skills

Rearvy uses structured JSON manifests to integrate external SaaS platforms and APIs into AI agent reasoning.

1. Review the manifest specifications in `schemas/` and `components/business/publisher-connectors-panel.tsx`.
2. Ensure every new connector:
   - Contains a valid bounded capability schema (`inputSchema`, `outputSchema`).
   - Requires explicit user approval for destructive/write actions (`approvalRequired: true`).
   - Never logs or exposes customer credentials or authentication tokens.
3. Add corresponding unit tests under `website/src/lib/` or `website/src/components/`.

---

## 📦 Pull Request Guidelines

1. **Fork the repo** and create a feature branch (`git checkout -b feature/amazing-feature`).
2. **Follow existing styling & architecture**: Do not introduce ad-hoc CSS frameworks or rewrite working architecture.
3. **Write tests**: Add unit tests covering new features or bug fixes.
4. **Commit messages**: Use clear, conventional commit messages:
   - `feat: add Google Sheets connector brief template`
   - `fix: resolve token usage meter refresh debounce`
   - `docs: update self-hosting quickstart guide`
5. **Open a Pull Request**: Submit against the `main` branch with a clear description of the problem solved and test results.

---

## 🛡️ Security Disclosures

If you discover a security vulnerability, please do **NOT** open a public issue. Review our [Security Policy](SECURITY.md) to report vulnerabilities privately.

---

## 💬 Community & Discussions

* **GitHub Discussions**: Feature ideas, architectural proposals, and Q&A.
* **Issues**: Bug reports and structured feature requests.

Thank you for helping build the future of autonomous business operations! 🚀
