# Rearvy 2.0

Rearvy is a Next.js + Supabase app for AI-assisted business insights across Shopify and YouTube data.

## Stack

- Next.js (App Router) + React + TypeScript
- Supabase (auth, Postgres, RLS)
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

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `INTEGRATION_ENCRYPTION_KEY` (32-byte hex)
- `NEXT_PUBLIC_APP_URL`

## Google OAuth setup

This app uses two separate Google auth flows, and each one needs its own redirect URI configuration.

Firebase app sign-in:

- Login and signup use the Firebase client SDK.
- Enable Google in Firebase Authentication.
- In the Google Cloud OAuth client used by Firebase, add this redirect URI:

```text
https://<NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN>/__/auth/handler
```

- With the current Firebase config in this workspace, that URI is:

```text
https://rearvy-74c50.firebaseapp.com/__/auth/handler
```

- In Firebase Authentication, add each app host you use to Authorized domains, including `localhost` for local development.

Google integrations:

- YouTube and Google Analytics use `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- Their callback URLs are built from `NEXT_PUBLIC_APP_URL` and must be registered exactly in Google Cloud.
- With `NEXT_PUBLIC_APP_URL=http://localhost:3000`, add:

```text
http://localhost:3000/api/integrations/youtube/callback
http://localhost:3000/api/integrations/google-analytics/callback
```

- Add the production equivalents too if you run the app on a deployed domain.

Shopify:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_WEBHOOK_SECRET`

YouTube:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Sync worker:

- `SYNC_WORKER_SECRET` (used by internal sync worker route)

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
```

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
