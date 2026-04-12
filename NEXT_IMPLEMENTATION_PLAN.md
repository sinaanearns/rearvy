# Next Implementation Plan (April 2026)

This plan moves Trading Copilot from "MVP code ready" to "production-ready and observable".

## Goals

1. Validate end-to-end trading opinion and monitor behavior in real user flows.
2. Deploy scheduler-backed monitor execution safely.
3. Add visibility (logs and metrics) before broader rollout.
4. Gate rollout with explicit launch criteria.

## Phase 1: Validation Sprint (Priority: P0)

Target: 1-2 days

### Tasks

- Run local smoke tests for opinion generation in chat.
- Verify monitor create/stop flows and Firestore persistence.
- Validate monitor updates are posted back to chat when action changes.
- Confirm guardrails: max 3 active monitors per user, cooldown behavior, safe fallback to Hold.

### Deliverables

- Completed checklist with pass/fail notes.
- Captured API samples for create/list/patch monitor endpoints.
- Confirmed Firestore document examples for active and stopped monitors.

### Exit Criteria

- All P0 smoke checks pass.
- No blocking errors in chat route, monitor APIs, or monitor runner path.

## Phase 2: Production Infrastructure (Priority: P0)

Target: 1 day

### Tasks

- Deploy Firestore composite indexes for trading monitors.
- Merge and deploy trading Firestore security rules.
- Configure and validate `INTERNAL_API_SECRET` across app runtime and runner trigger.
- Create/update Cloud Scheduler job via `npm run trading:setup-scheduler`.
- Run one manual cycle via `npm run trading:run-cycle` and verify updates.

### Deliverables

- Scheduler job active at 1-minute cadence.
- Rules and indexes deployed in target Firebase project.
- One successful production-like monitor cycle captured in logs.

### Exit Criteria

- Runner endpoint authenticates only with internal token.
- Monitor cycle completes without auth/index errors.

## Phase 3: Observability and Reliability (Priority: P1)

Target: 1-2 days

### Tasks

- Add structured logs for monitor lifecycle: created, polled, changed, paused, stopped.
- Add lightweight counters (opinions generated, monitor updates, runner failures).
- Add alerts for: failure rate > 5% (10m), runner duration > 30s, auth failures.
- Document runbook steps for top incidents.

### Deliverables

- Dashboard with core monitor health indicators.
- Alert channels configured and tested.
- Short incident runbook in repository docs.

### Exit Criteria

- Team can detect and triage failures within 10 minutes.

## Phase 4: Controlled Rollout (Priority: P1)

Target: 2-3 days

### Tasks

- Enable feature for a small internal cohort first.
- Review generated opinions and monitor updates for quality and safety.
- Measure latency and cost impact under real usage.
- Decide go/no-go for wider release using launch criteria below.

### Deliverables

- Cohort feedback summary.
- Cost/latency snapshot.
- Final launch decision note.

### Exit Criteria

- No critical safety/compliance issues.
- Stable monitor runner performance across cohort traffic.

## Launch Criteria

- End-to-end tests and smoke checks pass for all P0 scenarios.
- Scheduler and runner are stable for at least 24 hours.
- Alerts and runbook validated with at least one dry run.
- Compliance statement remains true: recommendations only, no execution.

## Suggested Command Sequence

```bash
npm run lint
npm run build
npm run dev
npm run trading:setup-scheduler
npm run trading:run-cycle
```

## Immediate Next Actions (This Week)

1. Execute Phase 1 smoke checklist and record outcomes.
2. Deploy Phase 2 infra changes in staging/production.
3. Complete observability minimums in Phase 3 before broad rollout.

## Execution Log (April 13, 2026)

### Completed in this cycle

- Added this phased implementation roadmap and linked it from `IMPLEMENTATION_STATUS.md`.
- Cleared production build blockers in trading-related paths:
	- `src/components/data-cards/card-router.tsx` (safe type guard for trading opinion payloads)
	- `src/components/insights/trading-project-insights.tsx` (null-safe auth user token retrieval)
	- `src/lib/trading/monitor-jobs.ts` (timeframe/action validation when parsing Firestore docs)
- Fixed internal runner URI mismatch in scheduler/cycle scripts:
	- `scripts/trading/run-monitor-cycle.mjs`
	- `scripts/trading/setup-scheduler.mjs`
- Added executable Phase 1 smoke runner:
	- `scripts/trading/phase1-smoke.mjs`
	- npm command: `npm run trading:smoke-phase1`
- Cleaned remaining trading-scope lint warning:
	- `src/app/api/trading/insights/best-trades/route.ts`
- Upgraded smoke runner to auto-bootstrap Firebase ID token (via temporary test user) when token is not pre-provided.
- Added structured monitor-cycle error reporting (`result.errors`) for faster diagnosis:
	- `src/lib/trading/monitor-jobs.ts`
- Added structured lifecycle logs for monitor create and state changes:
	- `src/app/api/trading/monitors/route.ts`
	- `src/app/api/trading/monitors/[monitorId]/route.ts`
- Added operations and rollout artifacts:
	- `TRADING_OPERATIONS_RUNBOOK.md`
	- `TRADING_ROLLOUT_CHECKLIST.md`
- Added non-interactive gcloud auth helper for scheduler setup:
	- `scripts/trading/auth-gcloud-from-env.mjs`
	- npm command: `npm run trading:auth-gcloud`
- Added demo-only trading validation page for UI lifecycle evidence:
	- `src/app/demo/trading-opinion/page.tsx`
- Fixed trading monitor card auth headers so Start/Stop Monitor work in UI:
	- `src/components/data-cards/trading-opinion-card.tsx`

### Current baseline

- Build: `npm run build` passes.
- Lint: `npm run lint` currently reports warning-heavy output (177 warning/error lines matched by console scan).
- Phase 1 smoke (latest): `4 passed, 0 skipped, 0 failed`.
- Trading-scope lint subset: clean (no warnings) for trading APIs, libs, hooks, and trading insight components.
- Phase 2 run-cycle (latest): `status=ok`, `jobsProcessed=0`, `errored=1`, with explicit index-building precondition message.
- Phase 2 run-cycle (latest): `status=ok`, `jobsProcessed=0`, `errored=0`.
- Phase 1 UI evidence (latest): trading opinion card rendered, Start Monitor created a live monitor, and Stop Monitor returned it to inactive state.

### Smoke check notes (automated subset)

- Pass: internal monitor endpoint rejects missing internal token (401).
- Pass: internal monitor endpoint accepts valid internal token (200).
- Pass: trading monitor list endpoint rejects missing user auth (401).
- Pass: authenticated monitor validation flow rejects Hold monitor creation (400).

### UI validation notes

- Demo-only page: `/demo/trading-opinion`
- Rendered an actionable Buy card for BTC/USD on H1.
- Start Monitor created a live monitor and showed `Active monitor`.
- Stop Monitor returned the card to `Not monitoring`.

### Latest hardening note

- `scripts/trading/phase1-smoke.mjs` now:
	- loads `.env.local` automatically for local runs,
	- defaults to `http://localhost:3000` (safe local target),
	- respects last-value-wins behavior for duplicate keys in `.env.local`,
	- can create a temporary Firebase auth user to run authenticated checks.

- `scripts/trading/run-monitor-cycle.mjs` now:
	- loads `.env.local` automatically,
	- defaults to `http://localhost:3000` unless overridden.

- `scripts/trading/setup-scheduler.mjs` now:
	- loads `.env.local` automatically,
	- supports `NEXT_PUBLIC_FIREBASE_PROJECT_ID` fallback for project resolution.

### Next execution slice (immediate)

1. Wait for the new Firestore index to finish building, then re-run `npm run trading:run-cycle` until `errored=0`.
2. Install Google Cloud SDK (`gcloud`) and run `npm run trading:setup-scheduler`.
3. Execute UI smoke flow: opinion card render, start monitor, stop monitor, and chat update verification.

## Phase Completion Status

### Phase 1: Validation Sprint (P0)

- Status: Complete.
- Completed:
	- Automated API smoke checks fully passing.
	- UI flow validation captured on demo trading page (card render, start monitor, stop monitor, state updates).

### Phase 2: Production Infrastructure (P0)

- Status: In progress.
- Completed:
	- Firestore indexes deployed with Firebase CLI.
	- Manual cycle command works and returns structured diagnostics.
- Completed:
	- Trading monitor runner produced zero-error cycle after index availability resolved.
- Blocked:
	- Scheduler provisioning is blocked by IAM/API enablement permissions on `cloudscheduler.googleapis.com` for the currently authenticated gcloud account (`firebase-adminsdk-fbsvc@rearvy-74c50.iam.gserviceaccount.com`).

### Phase 3: Observability and Reliability (P1)

- Status: Implemented baseline.
- Completed:
	- Structured cycle error output in runner results.
	- Structured lifecycle logs for monitor create/state-change.
	- Runbook created: `TRADING_OPERATIONS_RUNBOOK.md`.

### Phase 4: Controlled Rollout (P1)

- Status: Prepared.
- Completed:
	- Rollout checklist and staged criteria created: `TRADING_ROLLOUT_CHECKLIST.md`.
- Remaining:
	- Execute staged rollout in production cohorts after Phase 2 blockers clear.
