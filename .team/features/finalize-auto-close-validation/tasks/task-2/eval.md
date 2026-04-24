## Parallel Review Findings

🟡 [architect] `test/harness.test.mjs:277` — No test covers `gh` exit non-zero: because `closeIssue` return value is discarded at `finalize.mjs:123`, a failing `gh` still increments `issuesClosed`; add a failure-path test (stub `gh` exits 1) to prevent the counter from silently misreporting — or fix the counter logic first
🟡 [architect] `test/harness.test.mjs:277` — No mixed-status test (one `passed` + one `skipped` task in the same finalize run); a condition inversion in the ternary at `finalize.mjs:119` would go undetected — add a two-task test asserting both comment strings appear in the `gh` log
[architect] The task's goal is met. The capturing-stub approach is architecturally correct — it directly verifies `gh` CLI invocations rather than just counting calls. 516/516 tests pass. The two 🟡 findings are backlog items: the failure-path gap and the missing mixed-status coverage. Neither blocks merge since they arise from pre-existing `closeIssue` counter logic, not from anything introduced by this task.
🟡 [engineer] `test/harness.test.mjs:377` — Test 3 uses a non-capturing `gh` stub; comment routing regressions for the 2-task case (wrong string sent for `passed`) would not be detected — add capturing stub + comment-text assertions
🟡 [engineer] `bin/lib/finalize.mjs:128` — `issuesClosed++` fires unconditionally regardless of `closeIssue()` return value; pre-existing bug already in backlog from task-1 review
🟡 [product] `test/harness.test.mjs:317` — Stub only asserts comment text appears *somewhere* in captured `gh` args but does not assert the correct issue number (301 or 302) was targeted; a regression where the wrong issue is closed would not be detected — add `assert.ok(ghCalls.includes("issue close 301"))` alongside the existing text check
🟡 [product] `bin/lib/finalize.mjs:128` — `issuesClosed++` fires unconditionally after `closeIssue()`; return value is discarded; the output `issuesClosed` inflates on `gh` failure — pre-existing issue already flagged in task-1 review; confirm backlog entry exists before feature merge
🟡 [tester] `test/harness.test.mjs:379` — 2-task test uses a non-capturing `gh` stub (silent exit-0 only); `issuesClosed: 2` passes but per-task comment content is unverifiable — switch to a capturing stub (same pattern as lines 280–283) and add comment-text assertions for both tasks
🟡 [tester] `test/harness.test.mjs:377` — No test for `gh` failure path: `closeIssue` returns `false` on non-zero gh exit and never throws, so `issuesClosed++` at `finalize.mjs:128` fires unconditionally — add a test with a stub that exits non-zero and assert `issuesClosed: 0` (would currently fail, exposing pre-existing bug already in backlog)
🟡 [security] `bin/lib/finalize.mjs:123` — `closeIssue()` return value discarded; `issuesClosed++` fires unconditionally in `try` block — change to `if (closeIssue(task.issueNumber, comment)) issuesClosed++;` to prevent inflated count on `gh` non-zero exit
🟡 [security] `bin/lib/finalize.mjs:58` — `_write_nonce` checked for presence only (`!state._write_nonce`); anyone with filesystem write access can forge STATE.json — backlog: add HMAC-signed state writes
[security] - Two 🟡 findings are pre-existing and already flagged in the prior parallel review; no new critical issues introduced
🟡 [simplicity] test/harness.test.mjs:277 — Three new tests repeat identical boilerplate (fake-gh setup, STATE.json write, execFileSync, JSON parse, cleanup); extract a shared `runFinalizeWithFakeGh(dir, tasks)` helper to halve the line count and surface intent
🟡 [simplicity] test/harness.test.mjs:278 — `mkdtempSync` and `tmpdir` are first used here but imported at lines 464–465; move to the top-of-file import block
🟡 [simplicity] test/harness.test.mjs:306 — Inline JSON extraction (`lines.split…filter(Boolean)…JSON.parse`) duplicates the logic already in `harnessJSON`; extend `harnessJSON` to accept an optional `env` object to eliminate both raw `execFileSync` calls
🟡 [simplicity] bin/lib/finalize.mjs:124 — Dead no-op block: `projMatch` computed but never used; `readTrackingConfig()` pays filesystem I/O on every finalize while delivering nothing; remove until project-board integration is real (pre-existing — already in backlog)
[simplicity] **Summary:** The tests are correct and verify the exact comment strings. The 🟡 items are all maintenance-debt: the three new tests tripled the setup boilerplate instead of sharing it, and the imports land 180 lines after their first use. No blocking issues.
🔵 [architect] `test/harness.test.mjs:286` — Feature dirs `comment-passed-test` and `comment-skipped-test` are created in the shared `testDir` but never cleaned up; only `fakeBinDir` is removed in the `finally` block — extend cleanup to remove the feature dir, or use a per-test tmpdir
🔵 [architect] `test/harness.test.mjs:278` — `mkdtempSync`/`tmpdir` first used here but imported at line 464; move to the top-of-file import block (pre-existing, flagged by parallel review)
🔵 [product] `test/harness.test.mjs:278` — `mkdtempSync`/`tmpdir` used at lines 278–279 and 328–329 but imported at the bottom of the test file; move to top of file with other imports
🔵 [tester] `test/harness.test.mjs:377` — No mixed-status test (1 `passed` + 1 `skipped` in same finalize run) verifying both comment templates dispatch correctly in a single call
🔵 [security] `test/harness.test.mjs:282` — `ghLogFile` path embedded in double-quoted shell heredoc; safe for OS tmpdir paths but fragile if path ever contained `"` or `$` — use a positional argument or env var instead
🔵 [simplicity] test/harness.test.mjs:277 — Neither comment-checking test asserts the issue *number* passed to `gh`; the stub already logs `$@`, so `assert.ok(ghCalls.includes("301"))` would guard argument-order regressions at no cost

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs