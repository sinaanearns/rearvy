---
description: "AssemblyAI guidance for Rearvy's Clicky and desktop/local-server integration"
applyTo:
  - "desktop-app/**/*"
  - "website/src/app/clicky/**/*"
  - "website/src/app/clicky-listener/**/*"
---

# AssemblyAI Integration — Coding Agent Instructions

You are helping integrate AssemblyAI into Rearvy. Keep the implementation server-side where possible and prefer the existing desktop/local-server architecture over adding direct client-side API calls.

## Operating rules
- Always fetch https://www.assemblyai.com/docs/llms.txt before writing AssemblyAI code.
- Verify the current docs for the chosen mode and model before recommending request parameters.
- Use the raw `Authorization` header for STT and LLM Gateway requests; do not add a `Bearer` prefix unless the docs for that specific product require it.
- Never expose `ASSEMBLYAI_API_KEY` in browser code, renderer code, or committed files.
- Keep the key in `.env.local` and read it from desktop/local API handlers only.

## Rearvy-specific guidance
- Prefer the desktop local API as the proxy for uploads, token minting, and transcription polling.
- For Clicky, keep the wake-word listener lightweight and route transcription through the desktop server instead of wiring AssemblyAI directly into the client.
- If the visual Clicky panel is disabled, preserve voice-only behavior and do not reintroduce a UI dependency just to support speech.
- Match any new AssemblyAI flow to the repo’s existing app split: website UI in `/website`, desktop runtime and local API in `/desktop-app`.

## Implementation preference
- Use the official SDK when it reduces risk or avoids hand-rolled upload/polling logic.
- If raw HTTP is needed, keep the request flow explicit and separate upload, submit, and poll steps.
- For browser or renderer audio capture, proxy through server code rather than sending secrets from the client.