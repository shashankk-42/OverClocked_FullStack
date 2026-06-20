# Active Task

Task 8: Close MVP and Ship Market-Ready (`In Progress` — Phase 0 complete)

## Status

Task 8 is operative. Phase 0 (critical-path unblocks) is complete as of May 7, 2026.

Use these as the current source of truth:
1. `.AI/tasks/TASK-8-plan.md` (authoritative checklist)
2. `AGENT.md` (implementation and context-sync workflow contract)
3. `.AI/context/index.md`
4. `.AI/context/codebase-and-runtime.md`
5. `.AI/context/gaps-and-next-steps.md`
6. `.AI/context/work-history.md`

Archive notes:
- `.AI/tasks/TASK-6-plan.md` and `.AI/tasks/TASK-7-plan.md` are retained as historical execution evidence.

## Phase 0 Status — Complete

- 0.1 Stable encryption key + rotation pathway: `Done` (6 tests; central service in `app/auth/encryption.py`)
- 0.2 Cluster split module + schema: `Done` (10 tests; module in `app/clustering/cohesion.py`; runtime wiring into `event_clusterer.py` is the remaining sub-item)
- 0.3 90-day retention purge worker: `Done` (7 tests; module + worker entry point shipped)
- 0.4 High-impact outlet versioning trigger: `Done` (10 tests; pure module + summary_worker integration)
- 0.5 Real hCaptcha + reputation decay: `Done` (12 tests; both wired into the runtime; retention worker now also runs reputation decay)

Full backend suite green: `209 passed` (was 159 at Phase 0 start).

## Remaining Blockers / Next Order

1. **Phase 0.2 follow-up**: wire cohesion measurement + split execution into `src/backend/workers/event_clusterer.py` so the new tables actually get rows. Pure logic and schema are ready.
2. **Phase 1**: Production infrastructure
   - 1.1 Multi-stage Docker images
   - 1.2 Compose hardening (healthchecks, resource limits, prod overlay)
   - 1.3 Nginx + TLS
   - 1.4 Secrets + database hosting + backup verification cron
   - 1.5 CI/CD beyond safety gate (build + deploy + dependabot + pip-audit)
   - 1.6 Sentry + alert tuning
   - 1.7 Runbooks (incident, rollback, dr-restore, oncall, deploy)
3. **Phase 2**: Frontend polish + test harness
   - 2.1 Vitest + Playwright harness (block all 2.x work until this lands)
   - 2.2 Fix DashboardSettingsPanel save (currently no-op)
   - 2.3 Backend filter + outlet endpoints (unblocks 2.4–2.6)
   - 2.4 Time-window + scope filters
   - 2.5 Version selector + update badge
   - 2.6 Outlet profile page
   - 2.7 Paywall + snippet enforcement (UI)
   - 2.8 Story timeline IST markers
4. **Phase 3**: Publish-yield investigation + tuning (`scripts/analyze_yield.py`)
5. **Final acceptance**: DOD checklist (9 criteria in TASK-8-plan.md)

## Acceptance Gap

Definition of Done is in `TASK-8-plan.md` §Definition of Done. All 9 criteria must be true to ship.
