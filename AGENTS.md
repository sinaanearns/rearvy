# AGENTS — AI coding assistant instructions for Rearvy

Purpose
-------
This file tells AI coding agents how to quickly be productive in this repository. Keep guidance minimal, link to authoritative docs, and prefer running local checks before making changes.

Quick facts
-----------
- Stack: Next.js (App Router) + React + TypeScript, Firebase, Vercel AI + NVIDIA integration.
- **IMPORTANT**: App and website are now SEPARATED into `/website` and `/desktop-app` with independent development
- Dev commands (from root `package.json`): `npm run dev:web` (website), `npm run dev:desktop` (app), `npm run dev:both` (both)
- Old commands are replaced: Use `npm run dev:web` instead of old `npm run dev`
- Each app has its own `package.json`, dependencies, and node_modules
- Use `npm run install:all` to install all dependencies at once


Where to look first
-------------------
- Project overview & environment variables: [README.md](README.md)
- **NEW: App/Website separation**: [SEPARATION_QUICKSTART.md](SEPARATION_QUICKSTART.md) and [SEPARATION_SETUP.md](SEPARATION_SETUP.md)
- Trading-related design and runbooks: [TRADING_MANIFEST.md](TRADING_MANIFEST.md), [TRADING_SETUP.md](TRADING_SETUP.md), [TRADING_OPERATIONS_RUNBOOK.md](TRADING_OPERATIONS_RUNBOOK.md), [TRADING_COPILOT_GUIDE.md](TRADING_COPILOT_GUIDE.md)


Agent workflow guidance
----------------------
- Read this file and the top-level `README.md` before making changes.
- Reproduce locally when possible: run `npm install` then `npm run dev` to start the Next.js app.
- Run linters and tests where applicable: `npm run lint`.

- When editing auth or OAuth flows, verify redirect URIs and environment variables listed in `README.md`.

Safety & secrets
----------------
- Do not hard-code secrets or add private keys to the repo. Use `.env.local` for local development and CI/deploy variables for production.

Known quirks & quick hints
-------------------------
- Firebase Google sign-in may require handling redirect results in the client to reliably continue after auth redirects.
- `localhost` is not interchangeable with `127.0.0.1` for OAuth redirect registrations; ensure the exact origin is registered.

If you need more focused agent behavior
---------------------------------------
Propose new, smaller customization files if you want agents to have different behavior for: frontend-only work, backend/admin tasks, trading automation, desktop packaging, or AssemblyAI-specific work. Example commands to create next:

- `/create-instruction frontend` — narrow instructions for UI work
- `/create-skill trading` — automation for trading scripts and runbooks

Keep edits here minimal and link to other docs for details. See [AssemblyAI instructions](.github/instructions/assemblyai.instructions.md) for the repository-specific AssemblyAI workflow.
