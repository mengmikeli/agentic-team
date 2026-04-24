# Engineer Review — finalize-auto-close-validation

**Role:** Engineer
**Task:** Test: `finalize` also closes `state.approvalIssueNumber` when present, and `issuesClosed` reflects it
**Date:** 2026-04-24

---

## Files Actually Opened and Read

- `.team/features/finalize-auto-close-validation/tasks/task-1/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-2/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-3/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-3/artifacts/test-output.txt`
- `.team/features/finalize-auto-close-validation/tasks/task-1/eval.md`
- `.team/features/finalize-auto-close-validation/tasks/task-3/eval.md`
- `bin/lib/finalize.mjs` (full file, 151 lines)
- `bin/lib/github.mjs` (closeIssue, commentIssue)
- `test/harness.test.mjs` (lines 1–30, 377–466)

---

## Overall Verdict: PASS

The implementation is correct and the tests exercise the claimed behaviour. Two pre-existing
warnings remain in backlog; no critical issues introduced by this task.

---

## Per-Criterion Results

### 1. Correctness — does the code do what the spec says?

**PASS — direct evidence.**

`finalize.mjs:133–139`:
```js
if (freshState.approvalIssueNumber) {
  try {
    closeIssue(freshState.approvalIssueNumber, "Feature finalized — all tasks complete.");
    issuesClosed++;
  } catch { /* best-effort */ }
}
```

- Guard is truthiness check on `approvalIssueNumber` — correct; `0` and `null` are both falsy.
- `closeIssue` is called with the stored number and a non-empty comment.
- `issuesClosed++` fires only inside the truthiness guard — it will not double-count absent values.
- The block is appended *after* the task-issue loop, so a feature with one task issue and one
  approval issue correctly produces `issuesClosed === 2`.

Test at `test/harness.test.mjs:377–426` confirms:
- State has `{ tasks: [{ issueNumber: 401 }], approvalIssueNumber: 500 }`
- Result: `issuesClosed === 2` ✔
- `ghCalls` log includes `"500"` ✔

Gate output (`test-output.txt:392`):
```
✔ closes approvalIssueNumber when present and counts it in issuesClosed (285.479625ms)
```
All 517 tests pass, 0 failures.

### 2. Test coverage — are failure paths handled?

**WARN — success-path only.**

The test uses a stub that always exits 0. `closeIssue()` returns a boolean but the return value is
discarded at `finalize.mjs:136`; `issuesClosed++` fires unconditionally. The same bug exists for
task-issue closes at line 128 and is already in the backlog. No new test covers the failure path
for the approval issue.

### 3. Test assertion precision

**WARN — comment body not verified.**

The test asserts `ghCalls.includes("500")` but does not assert that the comment
`"Feature finalized — all tasks complete."` was passed to `gh`. The capturing stub logs all `$@`
args, so a line like:
```
assert.ok(ghCalls.includes("Feature finalized — all tasks complete."), ...)
```
would cost nothing and would catch a regression that silently drops the comment. This gap is unique
to the new approval-issue test; the prior `passed`/`skipped` tests do assert comment text.

### 4. Pre-existing dead code (not introduced here)

**WARN (pre-existing, backlog only).**

`finalize.mjs:124–127`: `projMatch` is computed from `tracking.statusFieldId` and immediately
discarded. `readTrackingConfig()` at line 116 pays a filesystem read on every finalize for no
effect. These lines were present before this task; both are in the backlog.

---

## Findings

🟡 test/harness.test.mjs:419 — Assertion only checks `ghCalls.includes("500")`; add `assert.ok(ghCalls.includes("Feature finalized — all tasks complete."))` to match the pattern established by the passed/skipped tests
🟡 bin/lib/finalize.mjs:136 — `closeIssue()` return value discarded; `issuesClosed++` fires unconditionally even on `gh` failure — pre-existing; already in backlog from task-issue close at line 128
🔵 test/harness.test.mjs:419 — Prefer `ghCalls.includes("issue close 500")` over `ghCalls.includes("500")` to rule out the number appearing in an unrelated gh argument
