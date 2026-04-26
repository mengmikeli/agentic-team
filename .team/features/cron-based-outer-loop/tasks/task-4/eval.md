## Parallel Review Findings

[simplicity veto] No 🔴 critical findings. Two 🟡 warnings for the backlog:
🟡 [product] `.team/features/cron-based-outer-loop/tasks/*/artifacts/` — No `test-output.txt` stored in any task's artifact directory; claimed test counts (553 tests) cannot be independently verified from the artifact trail alone — store test runner output as a task artifact in future runs.
[product] The prior 🟡 findings from earlier runs (args leakage, Unicode sanitization gap, stale-item stranding) are all confirmed closed in run_3. Eval written to `tasks/task-4/eval.md`.
🟡 [tester] `cron.mjs:86` — `listProjectItems` called bare inside the outer `try` with no inner catch; if the GitHub API throws (network failure, auth expiry), the error propagates as an unhandled rejection with no `console.error` log — the `finally` block still releases the lock, but the failure is invisible in the cron log; add a test where `listProjectItems` throws and assert `console.error` is invoked with a useful message
🟡 [tester] `test/cron-tick.test.mjs:399` — Stale+ready coexistence: dispatch priority not asserted; after stale recovery, item #3 (mutated to `"ready"`) appears first in `readyItems` and gets dispatched ahead of item #4 (originally `"Ready"`), but the test only asserts `runCalled === true` — a regression that changes dispatch ordering would pass silently; add an assertion on which `issueNumber` was dispatched
[tester] - Prior 🟡 findings from runs 1–2 (commentIssue guard, Unicode sanitization, args leakage, lock-release spies, console-restore in try/finally) confirmed closed
[tester] - No critical findings — two new 🟡 backlog items added
[security] Two prior 🟡 security findings are **closed** in run_3:
🟡 [simplicity] `bin/lib/cron.mjs:101` — `staleItem.status = "ready"` mutates the input array element to populate the ready pool via a filter 5 lines later; coupling is non-obvious — collect recovered items into an explicit variable and merge with `readyItems`
🟡 [simplicity] `bin/lib/cron.mjs:20` — `readProjectNumber` duplicates `outer-loop.mjs:117` body-for-body (same regex, same try/catch, same contract); extract to shared utility to avoid split maintenance (carry-forward)
🔵 [architect] `bin/lib/github.mjs:275` — `setProjectItemStatus` calls `readTrackingConfig()` with implicit `process.cwd()`; if cwd changes mid-run, all status transitions silently return false while pre-flight passed with an explicit path — pass tracking config as a parameter
🔵 [architect] `bin/lib/cron.mjs:60` — pre-flight errors use `process.exit()` directly, breaking the async interface contract and requiring `process.exit` monkey-patching in every test — consider throwing instead
🔵 [architect] `bin/lib/cron.mjs:86` — `_listProjectItems` is called without `await` with no documentation; an async fixture would silently produce a `Promise` in `items`, breaking `filter` — add a JSDoc comment on the sync requirement
🔵 [engineer] `bin/lib/cron.mjs:86` — `_listProjectItems(projectNumber)` called without `await`; no comment/JSDoc signals the synchronous contract; an injected async stub would return a Promise and `items.filter` would throw `TypeError` (carry-forward from run_2 engineer eval)
🔵 [engineer] `bin/lib/cron.mjs:101` — `staleItem.status = "ready"` mutates the input object in-place to include recovered items in the ready pool; works correctly but relies on an undocumented contract that `_listProjectItems` objects are mutable
🔵 [product] `bin/lib/cron.mjs:89–103` — Stale recovered items are always retried immediately in the same tick regardless of why they were killed; no spec prohibition but may surprise operators if a feature hits resource limits repeatedly — file backlog item for optional retry-count cap.
🔵 [tester] `test/cron-tick.test.mjs:409` — All three stale-recovery tests use `status: "In Progress"` (space format); the `s === "in-progress"` (hyphen) branch at `cron.mjs:93` has no stale-scenario test; add one fixture item with `status: "in-progress"` (hyphen)
🔵 [tester] `cron.mjs:118` — No test for `item.title` being `null` or `undefined`; the `|| ""` guard is correct but untested
🔵 [security] `bin/lib/cron.mjs:118` — Unicode bidirectional control characters (U+200E, U+200F, U+202A–U+202E, U+2066–U+2069) are not stripped from the issue title before LLM prompt injection; used in known prompt-obfuscation attacks — extend the regex to include `\u200e\u200f\u202a-\u202e\u2066-\u2069`
🔵 [security] `bin/lib/cron.mjs:144` — `err.message` posted verbatim to GitHub issues may expose internal file paths in shared/public repos — consider capping to first line and 200 chars: `(err.message || String(err)).split('\n')[0].slice(0, 200)`
🔵 [simplicity] `bin/lib/cron.mjs:42` — `args` accepted but never read; SPEC guarantees flags are not forwarded — drop the "for now" annotation or remove the parameter
🔵 [simplicity] `test/cron-tick.test.mjs:526` — inline tracking config is identical to the `TRACKING_CONFIG` constant at line 23; use the shared constant (carry-forward from run_2)

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**