## Parallel Review Findings

🟡 [product] `.team/.../task-16/eval.md` — The pre-existing eval.md was a stale copy from task-4 (failure path revert), not an evaluation of task-16 (concurrent lock). Process hygiene issue — now overwritten with the correct review.
🟡 [tester] `bin/lib/util.mjs:93-94` — `isPidAlive` returns `false` on EPERM (process exists, different user), which would falsely break a legitimate cross-user lock. Fix: `return err.code !== 'ESRCH'`
🟡 [tester] `test/cron-tick.test.mjs` — Lock release not asserted on failure-path mock tests (3c, 4, 4b, 4e). Only no-ready-items and real-lockFile tests verify release.
🟡 [tester] `test/cron-tick.test.mjs` — Path sanitization regex (`cron.mjs:159`) has no test. Could leak filesystem paths to GitHub issue comments.
🟡 [tester] Prior eval.md was stale (from task-4, 18 tests vs current 26).
🟡 [security] `bin/lib/util.mjs:115-117` — TOCTOU race in stale-lock recovery: two processes detecting a dead PID simultaneously can both `unlinkSync` and both acquire the lock. Negligible probability with 30-min cron intervals + `timeout: 0`. **Backlog:** replace `unlinkSync` + re-loop with atomic `rename`.
🟡 [simplicity] `bin/lib/util.mjs:89` + `bin/lib/daemon.mjs:22` — `isPidAlive` duplicated across two modules (identical 6-line bodies). Predates this task; backlog item.
🔵 [architect] `bin/lib/util.mjs:102` — `maxRetries=200` (10s cap) is decoupled from the `timeout` parameter; future callers with timeout >10s would silently exit early. Not triggered today.
🔵 [architect] `bin/lib/cron.mjs:128` — `process.exit` interception is fragile for exits from event handlers/unawaited paths. Pre-existing, backlog candidate for `child_process.fork` isolation.
🔵 [architect] `test/cron-tick.test.mjs:196` — Stale lock PID `2^30` works but `Number.MAX_SAFE_INTEGER` would be more self-documenting.
🔵 [engineer] `bin/lib/cron.mjs:129` — process.exit interceptor treats all exit codes (including 0) as failures. Defensible design but worth a comment for maintainers.
🔵 [engineer] `bin/lib/util.mjs:115` — Stale lock detection relies on PID liveness; PID recycling is a theoretical (but practically negligible) limitation.
🔵 [engineer] `test/cron-tick.test.mjs:144` — No true concurrent race test (two `cmdCronTick` via `Promise.all`). The `wx` flag provides OS-level atomicity so this is low priority.
🔵 [product] `test/cron-tick.test.mjs` — No test exercises true concurrent racing (e.g., two `cmdCronTick` calls via `Promise.all`). The existing test acquires the lock manually first, then calls `cmdCronTick`. Low risk since `lockFile` uses atomic `writeFileSync({ flag: "wx" })`.
🔵 [tester] 3 suggestions for additional edge-case coverage (TOCTOU in release, listProjectItems throwing, both recovery ops throwing).
🔵 [security] `bin/lib/cron.mjs:128-132` — `process.exit` monkey-patching is pragmatic but fragile; document the assumption that inner code uses the global.
🔵 [security] `bin/lib/cron.mjs:159` — Error path sanitization regex misses `/opt`, `/srv`, `/data` prefixes. Low risk.
🔵 [security] `bin/lib/util.mjs:153-159` — Lock release swallows all errors silently. Acceptable given stale-lock recovery exists.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**