## Parallel Review Findings

🟡 [architect] `bin/lib/finalize.mjs:137` — `closeIssue` return value discarded for `approvalIssueNumber` path; `issuesClosed++` fires unconditionally on `gh` failure — same pre-existing bug as `finalize.mjs:123`; fix both together when addressing the backlog item
🟡 [architect] `test/harness.test.mjs:419` — `ghCalls.includes("500")` is a substring check; a call to issue `5001` would satisfy it; replace with `ghCalls.includes("issue close 500")` to assert both command and number
[architect] All 517 tests pass. The implementation is correct — `approvalIssueNumber` is closed when present and counted in `issuesClosed`. The test uses the capturing-stub pattern (same as the prior comment-routing tests) to directly verify the `gh` CLI invocation. No new architectural debt introduced. The two 🟡 items are backlog: the `issuesClosed` counter is a pre-existing discard bug now consistently extended to the new path, and the substring assertion is weak but not wrong.
🟡 [engineer] test/harness.test.mjs:419 — Assertion only checks `ghCalls.includes("500")`; add comment-text assertion to match the pattern the passed/skipped tests establish — a regression silently dropping the comment arg would be invisible
🟡 [engineer] bin/lib/finalize.mjs:136 — `closeIssue()` return value discarded for approval issue; `issuesClosed++` fires unconditionally on `gh` failure — pre-existing; already in backlog from line 128 (task-issue close)
🟡 [product] test/harness.test.mjs:419 — `ghCalls.includes("500")` passes if "500" appears anywhere in the log (e.g. in a comment body); strengthen to `ghCalls.includes("issue close 500")` to verify command format, not just the number
🟡 [product] bin/lib/finalize.mjs:137 — `issuesClosed++` fires unconditionally when `closeIssue()` returns false (pre-existing — already in backlog from task-1/task-2); confirm backlog entry exists before merge
[product] The 🟡 on line 419 is the only gap with practical risk: a bug that puts "500" in the wrong argument position would not be caught. This is backlog, not a blocker. Both 🟡 items are pre-existing or minor. Recommend merge.
🟡 [tester] test/harness.test.mjs:418 — Comment string for approval issue not asserted; `ghCalls.includes("500")` verifies targeting but not content — add `assert.ok(ghCalls.includes("Feature finalized — all tasks complete."))` to the same test
🟡 [tester] test/harness.test.mjs:377 — No test for `approvalIssueNumber` in isolation (`tasks: []`); approval-only `issuesClosed: 1` path is untested — add a case with empty tasks and `approvalIssueNumber: 500`
[tester] The two 🟡 gaps (comment string unasserted, approval-only path untested) are real coverage holes but don't block merge — the primary claim is proven. Both go to backlog.
🟡 [security] bin/lib/finalize.mjs:137 — `issuesClosed++` fires unconditionally after `closeIssue(freshState.approvalIssueNumber)`; return value discarded; counter inflates when `gh` exits non-zero — change to `if (closeIssue(...)) issuesClosed++;` (new code repeating pre-existing pattern from line 128)
🟡 [security] bin/lib/finalize.mjs:134 — `approvalIssueNumber` has no integer type guard; a non-numeric string passes the truthy check and `closeIssue`'s null guard, silently reaching `gh issue close "bad-value"` — add `Number.isInteger(freshState.approvalIssueNumber)` before use
🟡 [simplicity] test/harness.test.mjs:277 — Four tests repeat identical fakeBinDir setup, STATE.json write, execFileSync, JSON-parse, and cleanup (~260 lines); extract a `runFinalizeWithFakeGh(stateData, opts)` helper or extend `harnessJSON` to accept `{ env }` to eliminate duplication and surface per-test intent
🟡 [simplicity] test/harness.test.mjs:428 — `returns issuesClosed: 2` uses a silent non-capturing gh stub; comment content and issue numbers are unverifiable — replace with the capturing-stub pattern used in the other three tests
🟡 [simplicity] test/harness.test.mjs:515 — `mkdtempSync` and `tmpdir` imported at lines 515–516 but first used at line 278 (237 lines before declaration); move to the top-of-file `import { ... } from "fs"` / `import { ... } from "os"` blocks
🟡 [simplicity] bin/lib/finalize.mjs:124 — Dead no-op block: `projMatch` computed but never used; `readTrackingConfig()` pays filesystem I/O on every finalize delivering nothing; remove until project-board integration is real (pre-existing — backlog)
🔵 [architect] `test/harness.test.mjs:386` — Feature dir `approval-close-test` created in shared `testDir` but never cleaned up in the `finally` block (only `fakeBinDir` is removed); extend cleanup to include the feature dir
🔵 [architect] `test/harness.test.mjs:377` — No explicit test for `approvalIssueNumber` absent (falsy/undefined); negative case is covered only implicitly by the 2-task test at line 428; add a case with `approvalIssueNumber: null` to make the guard explicit
🔵 [engineer] test/harness.test.mjs:419 — Prefer `ghCalls.includes("issue close 500")` over `ghCalls.includes("500")` to guard against the number appearing in an unrelated gh argument position
🔵 [product] test/harness.test.mjs:382 — Approval-close test does not assert the comment text passed to issue 500; consistent with the comment-checking tests above it, adding `assert.ok(ghCalls.includes("Feature finalized"))` would give full behavioural coverage
🔵 [tester] bin/lib/finalize.mjs:134 — `if (freshState.approvalIssueNumber)` is falsy-guarded; `approvalIssueNumber: 0` would silently skip the close — use `!= null` if zero is a theoretically valid issue number
🔵 [security] test/harness.test.mjs:419 — Approval-close test only checks `ghCalls.includes("500")`; `"500"` could match a comment body — strengthen to `ghCalls.includes("issue close 500")`
🔵 [security] test/harness.test.mjs:282 — `ghLogFile` path interpolated into shell heredoc without quoting; fragile if tmpdir ever contains `"` or `$` — pass via env var instead (test-only, safe in practice)
🔵 [simplicity] test/harness.test.mjs:286 — Feature dirs `comment-passed-test`, `comment-skipped-test`, `approval-close-test`, `issue-close-test` created in shared `testDir` but never cleaned up in `finally`; extend cleanup or use per-test tmpdir
🔵 [simplicity] test/harness.test.mjs:419 — `ghCalls.includes("500")` passes for any string containing "500" (e.g. issue 5001); change to `ghCalls.includes("issue close 500")` to verify subcommand and number together

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs