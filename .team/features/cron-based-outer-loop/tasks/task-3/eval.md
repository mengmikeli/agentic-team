## Parallel Review Findings

🟡 [architect] `.gitignore` (root) — `.team/.cron-lock.lock` is not gitignored; a SIGKILL/OOM mid-run leaves the lock file visible in `git status` until the next tick's stale-PID cleanup — add `.team/.cron-lock.lock` to `.gitignore`
🟡 [architect] `bin/lib/cron.mjs:20` — `readProjectNumber` is an exact duplicate of `outer-loop.mjs:117` (same regex, same null-safety, same return type); two confirmed callers with no shared home — extract to `github.mjs` (which already owns all `PROJECT.md` parsing) before a third copy appears (escalation from prior 🔵 suggestion)
[architect] The two 🟡 findings are backlog items, not merge blockers.
🟡 [engineer] `bin/lib/cron.mjs:128` — `lock.release()` is called unconditionally in `finally`, but `lock.release` is `undefined` on `{ acquired: false }` return values. Safe today only because `process.exit(0)` at line 81 always exits or throws before the `try` block is entered. If a future test mocks `process.exit` as a no-op, the `finally` crashes with `TypeError: lock.release is not a function`. Fix: `if (lock.acquired) lock.release()`.
🟡 [tester] test/cron-tick.test.mjs:408 — Integration test never exercises `util.mjs:133–150` (EEXIST race path) — the only path that fires when two processes actually start simultaneously with no pre-existing lock; add a test that spawns two concurrent `agt cron-tick` processes without a pre-written lock to exercise the atomic write race
[tester] The primary gap (🟡): the **EEXIST concurrent-write-race** path in `util.mjs:136–147` is the only code path active when two `cron-tick` processes start *simultaneously* without a pre-existing lock. The integration test pre-writes the file, so this path is never entered. The logic is correct on review, but unprotected against regression.
🟡 [security] `bin/lib/cron.mjs:124` — Raw `err.message` from `runSingleFeature` is posted to the GitHub issue comment. If the agent process throws with a message containing a file path, environment variable, or API response fragment, it surfaces in a public GitHub issue. Sanitize/truncate before posting (e.g., `err.message.slice(0, 300).replace(/[^\x20-\x7e]/g, '?')`).
[simplicity] **PASS** — with one 🟡 backlog item.
🟡 [simplicity] `bin/lib/cron.mjs:20` — `readProjectNumber` duplicates `outer-loop.mjs:117`; extract to `util.mjs` or `github.mjs` before a third caller appears
[simplicity] The `readProjectNumber` duplication is a 🟡 DRY concern (not a veto category), so this is **PASS**. The eval has been appended to `.team/features/cron-based-outer-loop/tasks/task-3/eval.md`.
🔵 [architect] `bin/lib/cron.mjs:128` — `lock.release()` called unconditionally in `finally` but `lock.release` is `undefined` on non-acquired lock objects; safe today because `process.exit(0)` at line 81 always exits or throws before `try` is entered, but a future test mocking `process.exit` as a no-op would crash here — use `lock.release?.()` to harden
🔵 [engineer] `test/cron-tick.test.mjs:424` — Test hardcodes `.cron-lock.lock`, coupling it to `util.mjs:100`'s internal `.lock` suffix convention. Acceptable (fails visibly if the suffix changes), but noted.
🔵 [tester] test/cron-tick.test.mjs:408 — CLI integration test has no negative assertion that `runSingleFeature` was skipped; the subprocess test relies solely on exit code and log message (the unit test's throwing sentinel covers this for the mocked path only)
🔵 [security] `bin/lib/cron.mjs:141` — No upper bound on `--interval`; `--interval 99999` produces `*/99999 * * * *` which is invalid cron syntax and would be silently ignored by cron. Add a reasonable cap (e.g., 1440 minutes = 1 day).
🔵 [simplicity] `bin/lib/cron.mjs:57,70` — `PROJECT.md` parsed twice per invocation (`readTrackingConfig` + `readProjectNumber`); consider combining reads if performance matters at scale

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**