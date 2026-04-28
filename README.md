# Rearvy 2.0

Rearvy is a Next.js + Firebase app for AI-assisted business insights across Shopify and YouTube data.

## Stack

- Next.js (App Router) + React + TypeScript
- Firebase (Authentication, Firestore, Admin SDK)
- Vercel AI SDK + OpenAI

## Local setup

1. Install dependencies:

```bash
npm install
```

1. Copy env vars and fill values:

```bash
cp .env.example .env.local
```

1. Start dev server:

```bash
npm run dev
```

## Desktop app packaging

Rearvy can be shipped as a Windows desktop installer using Electron. The desktop app opens the hosted Rearvy web app by default, so private backend secrets are not bundled into the installer.

```bash
npm run desktop:dev
npm run desktop:build:win
```

`desktop:build:win` creates a Windows installer in a timestamped `desktop-release/` subfolder and stages copies at:

```text
public/downloads/Rearvy-win-x64.exe
public/downloads/Rearvy-<version>-win-x64.exe
```

The website download page is available at `/download`. If you host the installer outside this repo, set `NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL` to the installer URL before building/deploying the web app.

## Live browser setup

Rearvy's browser automation now runs through a real Playwright-controlled
Chromium session plus a WebSocket frame stream. The UI does not embed external
sites with iframes.

Set it up once:

```bash
npm install
npm run playwright:install
```

Configure the WebSocket port in both server and client env when needed:

```text
REARVY_BROWSER_WS_PORT=3201
NEXT_PUBLIC_BROWSER_WS_PORT=3201
```

The browser session API lives under `/api/browser/session` and the live frame
stream is served over WebSocket from `/browser-stream` on the configured port.

Example flow:

```bash
# 1. Create a live browser session
curl -X POST http://localhost:3000/api/browser/session \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.google.com"}'

# 2. Type into the Google search box and submit
curl -X POST http://localhost:3000/api/browser/session/<SESSION_ID>/command \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      { "action": "type", "target": "textarea[name=\"q\"]", "value": "OpenAI" },
      { "action": "click", "target": "Google Search" }
    ]
  }'

# 3. Click a result
curl -X POST http://localhost:3000/api/browser/session/<SESSION_ID>/command \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "command": { "action": "click", "target": "OpenAI" } }'
```

## Required environment variables

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT`
- `NVIDIA_API_KEY`
- `INTEGRATION_ENCRYPTION_KEY` (32-byte hex)
- `NEXT_PUBLIC_APP_URL`

## Google OAuth setup

This app uses two separate Google auth flows, and each one needs its own redirect URI configuration.

Firebase app sign-in:

- Login and signup use the Firebase client SDK.
- Enable Google in Firebase Authentication.
- In Firebase Authentication -> Settings -> Authorized domains, add every hostname you use to open the app.
- `localhost` does not cover `127.0.0.1`, and neither one covers a LAN IP like `192.168.1.25`.
- In the Google Cloud OAuth client used by Firebase, add this redirect URI:

```text
https://<NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN>/__/auth/handler
```

- With the current Firebase config in this workspace, that URI is:

```text
https://www.rearvy.com/__/auth/handler
```

- For local development with this repo, the common entries are `localhost` and `127.0.0.1`.

Google integrations:

- Gmail, YouTube, and Google Analytics use `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- New Google connections reuse a single shared callback URL per hostname, so one Google Cloud redirect can cover all three integrations on that host.
- Enable the Gmail API in the Google Cloud project that owns `GOOGLE_CLIENT_ID` before trying a Gmail sync.
- If Gmail sync returns `GMAIL_API_DISABLED`, open Google Cloud Console -> APIs & Services -> Library, enable `Gmail API`, wait a few minutes, and retry.
- If your Google Cloud OAuth client is registered against a different host than `NEXT_PUBLIC_APP_URL`, set `GOOGLE_OAUTH_REDIRECT_ORIGIN` to the exact origin you registered.
- Register the exact hostname you actually open the app on. With the app running at `http://localhost:3000`, add:

```text
http://localhost:3000/api/integrations/google-analytics/callback
```

- Add the production callback too if you run the app on Rearvy production:

```text
https://www.rearvy.com/api/integrations/google-analytics/callback
```

- `rearvy.com` currently redirects to `www.rearvy.com`, so register the `www` hostname in Google Cloud for production OAuth callbacks.
- The redirect URI sent to Google is built from `GOOGLE_OAUTH_REDIRECT_ORIGIN` when set, then `NEXT_PUBLIC_APP_URL`, then the request origin.
- Legacy per-provider callback routes still exist, but new authorization requests use the shared callback above.
- For Google Analytics integration, ensure both Google Analytics Admin API and Google Analytics Data API are enabled in the same Google Cloud project as `GOOGLE_CLIENT_ID`.
- If GA4 connect/sync returns `GA4_API_DISABLED`, open the activation URL shown in the app, enable the API, wait a few minutes, and retry.

GitHub integration:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- Register this OAuth callback URI in the GitHub OAuth App:

```text
https://<NEXT_PUBLIC_APP_URL>/api/integrations/github/callback
```

- GitHub connect uses `read:user`, `user:email`, `read:org`, and `repo` so Rearvy can read repository metadata, recent issues, and pull requests for connected accounts.

Shopify:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_WEBHOOK_SECRET`

GitHub:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

YouTube:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- Enable YouTube Data API v3 in the same Google Cloud project that owns `GOOGLE_CLIENT_ID` before attempting a YouTube sync.
- If YouTube sync returns `YOUTUBE_API_DISABLED`, open the activation URL shown in the app, enable the API, wait a few minutes, and retry.

Sync worker:

- `SYNC_WORKER_SECRET` (used by internal sync worker route)

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## AI chat troubleshooting

- The main chat and demo chat require `NVIDIA_API_KEY` on the server runtime.
- The default chat model is `google/gemma-4-31b-it` via NVIDIA Integrate API.
- If chat fails with a server error, verify `NVIDIA_API_KEY` is present in your deployment environment and redeploy.

## Database migrations

Migrations live in `supabase/migrations`.

To run all migrations against Supabase Postgres:

```bash
node run_migrations.mjs <DATABASE_PASSWORD>
```

Or:

```bash
SUPABASE_DB_PASSWORD=<DATABASE_PASSWORD> node run_migrations.mjs
```

## Integration sync behavior

- OAuth callbacks enqueue durable sync jobs.
- Jobs retry with backoff on failure.
- An internal worker route processes due jobs: `POST /api/internal/sync-jobs/run`.
