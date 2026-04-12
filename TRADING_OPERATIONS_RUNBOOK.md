# Trading Operations Runbook

This runbook covers day-2 operations for Trading Copilot monitor execution.

## Scope

- Internal runner endpoint: /api/internal/trading/monitor-jobs
- Monitor collection group: users/{userId}/trading_monitors
- Scheduler trigger cadence: every 1 minute

## Alert Thresholds

Use these thresholds for alerts:

1. Runner error rate > 5% over 10 minutes.
2. Runner duration > 30s for 3 consecutive runs.
3. Unauthorized internal runner calls > 3 in 10 minutes.
4. Monitor job errors > 0 with recurring identical message for 15 minutes.

## Fast Triage Steps

1. Run one manual cycle:
   - npm run trading:run-cycle
2. Inspect runner result payload:
   - Check result.errored and result.errors
3. If error says index is building:
   - Wait for index status to become enabled in Firestore console
   - Retry manual cycle
4. If error says unauthorized token:
   - Compare INTERNAL_API_SECRET in app runtime and scheduler header
5. If no jobs processed unexpectedly:
   - Verify monitors exist with isActive=true and nextPollAt <= now

## Known Failure Patterns

### Missing index or index still building

Symptoms:
- result.errors contains FAILED_PRECONDITION with index URL

Actions:
1. Deploy indexes: npx -y firebase-tools@latest deploy --only firestore:indexes
2. Open index URL and wait for status to become enabled
3. Re-run manual cycle

### Internal token mismatch

Symptoms:
- /api/internal/trading/monitor-jobs returns 401 even with header

Actions:
1. Ensure one canonical INTERNAL_API_SECRET value
2. Update scheduler header token to match runtime token
3. Re-run manual cycle

### Scheduler toolchain unavailable

Symptoms:
- setup command fails with gcloud not found

Actions:
1. Install Google Cloud SDK (gcloud)
2. Authenticate gcloud and set project
3. Re-run npm run trading:setup-scheduler

## Verification Checklist

- npm run build succeeds
- npm run trading:smoke-phase1 reports all checks pass
- npm run trading:run-cycle returns status ok with no recurring errors
- Scheduler job exists and is enabled

## Escalation

Escalate when:

- Error rate remains above threshold for 30 minutes
- Repeated token mismatch after secret sync
- Index enabled but runner still failing with query errors
