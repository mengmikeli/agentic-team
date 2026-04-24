## Parallel Review Findings

🟡 [architect] `bin/lib/finalize.mjs:116` — `readTrackingConfig()` called unconditionally but result only used in a dead block (line 124); remove or guard behind a "has task issues" check to avoid an unnecessary filesystem read on every finalize
🟡 [architect] `bin/lib/finalize.mjs:123` — `closeIssue()` return value discarded; `issuesClosed` counter increments regardless of actual `gh` success — reported count is unreliable when `gh` fails
🟡 [architect] `bin/lib/finalize.mjs:129` — bare `catch {}` swallows all exceptions including programming errors; at minimum write to `process.stderr` so failures are observable in production
[architect] The feature is correctly implemented. Lines 134–139 add a minimal, guarded `closeIssue` call for `approvalIssueNumber` that is structurally identical to the existing task-issue close pattern. All 519 tests pass (exit 0). The three 🟡 findings are pre-existing debt in `finalize.mjs` — not introduced by this task — and go to the backlog. No critical issues found.
🟡 [engineer] `bin/lib/finalize.mjs:122` — `closeIssue` return value is discarded; `issuesClosed++` runs unconditionally even when gh fails (closeIssue returns false); change to `if (closeIssue(task.issueNumber, comment)) issuesClosed++` so the counter reflects successes not attempts
🟡 [engineer] `bin/lib/finalize.mjs:135` — Same: approval issue close also discards return value; `issuesClosed++` fires even on failure
🟡 [product] `.team/features/finalize-auto-close-validation/STATE.json:94` — task-6 status is `"in-progress"` and task-7 is `"pending"`; the builder must transition both tasks to `"passed"` before `agt finalize` will accept the feature — process gap, not a code defect, but the feature cannot be closed until resolved; add to backlog if not addressed this session
[product] The one 🟡 is a harness process step (STATE.json task advancement), not a correctness gap in the implementation. The implementation itself is correct, in scope, and verified by the gate.
🟡 [tester] `bin/lib/finalize.mjs:124` — Dead code: `projMatch` is computed but never used; project board is silently not updated on finalize despite the `// Best-effort` comment; either implement the update or remove the dead variable to prevent future confusion and silent contract violation
🟡 [tester] `test/harness.test.mjs:418` — Weak assertion: only checks `ghCalls.includes("500")`, not that the `close` subcommand and comment text `"Feature finalized — all tasks complete."` were passed; add `assert.ok(ghCalls.includes("issue close 500"))` and `assert.ok(ghCalls.includes("Feature finalized"))` to prevent silent regression on the comment body
🟡 [security] bin/lib/finalize.mjs:134 — `approvalIssueNumber` has no integer type guard; a crafted STATE.json with `approvalIssueNumber: "abc"` passes the truthy check, reaches `gh issue close abc` (fails silently), but still increments `issuesClosed` — add `Number.isInteger(freshState.approvalIssueNumber)` guard; mirrors pre-existing finding on `task.issueNumber:118`
🟡 [security] bin/lib/finalize.mjs:137 — `issuesClosed++` fires unconditionally; `closeIssue` return value is not checked; count inflates when `gh` fails — change to `if (closeIssue(...)) issuesClosed++`; mirrors pre-existing finding on line 128
🟡 [security] bin/lib/finalize.mjs:118 — `task.issueNumber` has no integer type guard (pre-existing, unresolved)
🟡 [security] bin/lib/finalize.mjs:128 — `issuesClosed++` unconditional for task issues (pre-existing, unresolved)
🟡 [security] bin/lib/finalize.mjs:21 — STATE.json tamper detection relies on a plaintext `_written_by` string with no cryptographic backing; filesystem-write-capable actor can bypass (pre-existing structural constraint)
[security] The two new 🟡 findings (`:134` type guard, `:137` unconditional count) are the same pre-existing patterns from lines 118 and 128 now applied to `approvalIssueNumber`. No new attack surface introduced. Eval written to `.team/features/finalize-auto-close-validation/tasks/security-review/eval.md`.
🔵 [architect] `bin/lib/finalize.mjs:134` — approval-issue close is a second parallel loop appended after the task loop; if project-board support is added for approval issues, the two loops will diverge; consider a unified close-all pass with a discriminated entry type
🔵 [engineer] `bin/lib/finalize.mjs:124` — Dead code: `projMatch` declared and assigned but never read; project board status update was not implemented; remove to reduce misleading noise
🔵 [engineer] `bin/lib/finalize.mjs:129,138` — `catch {}` blocks are unreachable — `closeIssue` cannot throw (`runGh` catches `spawnSync` internally); clarify with a comment or remove
🔵 [product] `bin/lib/finalize.mjs:125` — `const projMatch = ...` is assigned but never used (no body follows the variable); pre-existing dead code in the function modified by this change — flag for cleanup in a future backlog item
🔵 [product] `test/harness.test.mjs:420` — approval-issue close test only asserts `ghCalls.includes("500")` (issue number only); no assertion verifies the specific comment sent to the approval issue is `"Feature finalized — all tasks complete."` — add stricter assertion to make the comment contract testable
🔵 [tester] `test/harness.test.mjs:377` — No test for `approvalIssueNumber` as the sole issue (feature with no tasks having `issueNumber`); add a fixture with all tasks missing `issueNumber` and assert `issuesClosed: 1`
🔵 [tester] `test/harness.test.mjs:377` — No test for partial `closeIssue` failure; the catch block silently swallows errors and `issuesClosed` count in partial-failure scenarios is unverified
🔵 [security] bin/lib/finalize.mjs:124 — Dead code: `readTrackingConfig()` is called and `projMatch` computed but neither is used; remove or complete the block (pre-existing)
🔵 [simplicity] `bin/lib/finalize.mjs:124-127` — Dead code pre-existing before this change: `projMatch` is assigned and never read; the entire `if (tracking) { ... }` block is a no-op. Delete the block; it implies project-board status updates occur but none do.
🔵 [simplicity] `bin/lib/finalize.mjs:116` — `readTrackingConfig()` is called solely to feed the dead block above; if that block is deleted, this call (and potentially the import) can be removed, reducing unnecessary I/O on finalize.

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs