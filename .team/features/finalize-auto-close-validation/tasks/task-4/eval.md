## Parallel Review Findings

🟡 [architect] `bin/lib/finalize.mjs:124` — `projMatch` is computed but never used; remove the dead code or implement the project-board status update it was meant to enable
🟡 [architect] `bin/lib/finalize.mjs:129` — bare `catch {}` swallows programming errors alongside network errors; log to stderr at debug level or narrow the catch scope to expected failure modes
🟡 [engineer] `bin/lib/finalize.mjs:125` — `projMatch` assigned but never read; dead code implying unfinished board-status update; remove the assignment or implement the intended operation
🟡 [product] `test/harness.test.mjs:468` — "Silently skips" is not verified; the test uses a `echo ok; exit 0` gh stub with no call log, so there is no assertion that `gh` was never invoked for `t2`, and `stderr` is never checked; use a logging stub (matching the `comment-passed-test` pattern) and assert gh was not called for the no-issueNumber task — add to backlog
🟡 [tester] `test/harness.test.mjs:499` — "Silently skips" is claimed in the test name but only the count is asserted; add a check that no unexpected output lines appear for t2 to lock in the silence contract
🟡 [tester] `test/harness.test.mjs:468` — No `gh-calls.log` pattern (unlike peer finalize tests at ~lines 305 and 356); the `issuesClosed: 1` assertion proves the counter guard works but does not directly confirm `gh` was never invoked for t2 — inconsistent with peer test style
[tester] **Verdict: PASS** — All 518 tests pass. The core assertion (`issuesClosed: 1`) adequately detects removal of the production guard at `finalize.mjs:118`. The two 🟡 items are test-quality gaps (not production safety issues — `closeIssue` has its own null-guard at `github.mjs:138` as a backstop) and should go to backlog. Eval written to `.team/features/finalize-auto-close-validation/tasks/tester-review/eval.md`.
🟡 [security] bin/lib/finalize.mjs:118 — `task.issueNumber` has no integer type guard; a crafted STATE.json with a non-integer string passes the truthy check and silently reaches `gh issue close "bad-value"` — add `Number.isInteger(task.issueNumber)` before the truthy check (pre-existing, unresolved from task-3 review)
🟡 [security] bin/lib/finalize.mjs:128 — `issuesClosed++` fires unconditionally; `closeIssue` return value is discarded; count inflates when `gh` exits non-zero — change to `if (closeIssue(task.issueNumber, comment)) issuesClosed++;` (pre-existing, unresolved from task-3 review)
[security] The two 🟡 warnings are **pre-existing debt** that were already flagged in the task-3 security review and remain unresolved. No new injection surface was introduced. The primary injection concern (shell injection via STATE.json values) is already blocked by `spawnSync`'s array argument form.
🔵 [architect] `test/harness.test.mjs` (new test) — the fake `gh` binary accepts all commands unconditionally; consider capturing invocations to assert `gh issue close 201` was called exactly once and never called for the task without `issueNumber`
🔵 [tester] `test/harness.test.mjs:468` — Missing edge case: all tasks lack `issueNumber` → `issuesClosed` should be 0; no test covers this boundary
🔵 [tester] `test/harness.test.mjs:479` — Only `status: "passed"` + no `issueNumber` is exercised; the `status: "skipped"` + no `issueNumber` combination is not in the matrix
🔵 [security] test/harness.test.mjs:470 — Non-capturing stub cannot verify `gh issue close 201` was actually invoked nor that `gh` was not called at the OS level for the no-issueNumber task; replace with a capturing stub and assert `ghCalls.includes("issue close 201")`
🔵 [simplicity] test/harness.test.mjs:468 — The 5 `fakeBinDir`-based finalize tests each duplicate ~30 lines of identical setup/exec/parse boilerplate; a local helper `runFinalize(featureName, tasks)` would cut each test to ~10 lines and reduce cognitive load across the block
🔵 [simplicity] test/harness.test.mjs:501 — Test name claims "silently skips" but no assertion verifies absence of warning output in `out`; add `assert.ok(!out.includes("⚠"), ...)` to make the silence claim concrete rather than implicit

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs