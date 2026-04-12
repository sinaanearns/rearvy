# Trading Rollout Checklist

Use this checklist for controlled rollout (Phase 4).

## Stage 0: Internal Only

- [ ] Enable for internal testers only
- [ ] Collect feedback on opinion quality and monitor usefulness
- [ ] Confirm no misleading recommendation phrasing

## Stage 1: Small Cohort (5-10%)

- [ ] Allow selected production users
- [ ] Watch runner error rate and latency for 24h
- [ ] Review monitor lifecycle logs for anomalies
- [ ] Confirm no spike in support tickets

## Stage 2: Medium Cohort (25-50%)

- [ ] Increase rollout segment gradually
- [ ] Compare cost per monitor cycle against baseline
- [ ] Validate alerting and runbook response time

## Stage 3: Full Release

- [ ] Confirm all launch criteria satisfied
- [ ] Remove temporary rollout restrictions
- [ ] Announce feature availability and safety statement

## Launch Criteria

- [ ] Phase 1 smoke checks fully pass
- [ ] Scheduler stable for 24 hours
- [ ] Alerts tested with at least one drill
- [ ] Recommendations-only compliance statement verified

## Metrics to Track During Rollout

1. Monitor cycles per minute
2. Runner duration p95
3. Runner error rate
4. Monitor action-change notification rate
5. User-reported false positives
