# AGENTS — AI coding assistant instructions for Rearvy

Purpose
-------
This file tells AI coding agents how to quickly be productive in this repository. Keep guidance minimal, link to authoritative docs, and prefer running local checks before making changes.

Quick facts
-----------
- Stack: Next.js (App Router) + React + TypeScript, Firebase, Vercel AI + NVIDIA integration.
- Dev commands (from `package.json`): `npm install`, `npm run dev`, `npm run build`, `npm run start`, `npm run lint`.
- Desktop: `npm run desktop:dev`, `npm run desktop:build:win` (electron builder).
- Browser automation helpers: `npm run browser-use:install` and `npm run browser-use:setup`.

Where to look first
-------------------
- Project overview & environment variables: [README.md](README.md)
- Trading-related design and runbooks: [TRADING_MANIFEST.md](TRADING_MANIFEST.md), [TRADING_SETUP.md](TRADING_SETUP.md), [TRADING_OPERATIONS_RUNBOOK.md](TRADING_OPERATIONS_RUNBOOK.md), [TRADING_COPILOT_GUIDE.md](TRADING_COPILOT_GUIDE.md)
- Desktop packaging scripts: `scripts/desktop/*`
- Browser automation tooling: `scripts/browser-use`, `scratch/browser-use` and `public/` assets for downloads

Agent workflow guidance
----------------------
- Read this file and the top-level `README.md` before making changes.
- Reproduce locally when possible: run `npm install` then `npm run dev` to start the Next.js app.
- Run linters and tests where applicable: `npm run lint`.
- For changes touching browser automation, run `npm run browser-use:install` and follow `scripts/browser-use` setup.
- When editing auth or OAuth flows, verify redirect URIs and environment variables listed in `README.md`.

Safety & secrets
----------------
- Do not hard-code secrets or add private keys to the repo. Use `.env.local` for local development and CI/deploy variables for production.
- The desktop build intentionally does not bundle server secrets. Avoid moving secret logic into desktop-packaged code.

Known quirks & quick hints
-------------------------
- Firebase Google sign-in may require handling redirect results in the client to reliably continue after auth redirects.
- `localhost` is not interchangeable with `127.0.0.1` for OAuth redirect registrations; ensure the exact origin is registered.

If you need more focused agent behavior
-------------------------------------
Propose new, smaller customization files if you want agents to have different behavior for: frontend-only work, backend/admin tasks, trading automation, or desktop packaging. Example commands to create next:

- `/create-instruction frontend` — narrow instructions for UI work
- `/create-skill trading` — automation for trading scripts and runbooks

Keep edits here minimal and link to other docs for details.
