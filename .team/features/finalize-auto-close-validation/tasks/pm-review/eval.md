# PM Review — finalize-auto-close-validation

**Role:** Product Manager
**Task reviewed:** Test: `finalize` also closes `state.approvalIssueNumber` when present, and `issuesClosed` reflects it
**Verdict:** PASS

---

## Files Opened and Read

- `.team/features/finalize-auto-close-validation/tasks/task-1/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-2/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-3/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-1/eval.md`
- `.team/features/finalize-auto-close-validation/tasks/task-2/eval.md`
- `.team/features/finalize-auto-close-validation/tasks/task-3/artifacts/test-output.txt` (lines 387–394, 1306–1313)
- `bin/lib/finalize.mjs` (full file, 150 lines)
- `test/harness.test.mjs` (lines 377–455)

---

## Per-Criterion Results

### 1. Does the test verify `approvalIssueNumber` is closed?

**PASS — direct evidence.**

Test (harness.test.mjs:419–422) reads the captured `gh` log and asserts:
```js
assert.ok(
  ghCalls.includes("500"),
  `expected issue 500 to be closed in gh calls, got:\n${ghCalls}`,
);
```

The STATE fixture has `approvalIssueNumber: 500`. The stub logs all `$@` args. Issue 500 appearing in the log proves `closeIssue(500, ...)` was invoked.

Production code at `bin/lib/finalize.mjs:134–139` is the logic under test:
```js
if (freshState.approvalIssueNumber) {
  try {
    closeIssue(freshState.approvalIssueNumber, "Feature finalized — all tasks complete.");
    issuesClosed++;
  } catch { /* best-effort */ }
}
```
This path is exercised by the test. Confirmed PASS.

### 2. Does `issuesClosed` reflect the approval issue?

**PASS — direct evidence.**

Test (harness.test.mjs:416) asserts:
```js
assert.equal(result.issuesClosed, 2);
```

STATE has 1 task with `issueNumber: 401` and `approvalIssueNumber: 500`. Count of 2 = 1 task + 1 approval. If the approval close branch were absent, count would be 1 and the assertion would fail. Confirmed PASS.

Test output confirms:
```
✔ closes approvalIssueNumber when present and counts it in issuesClosed (285.479625ms)
```

### 3. Are all 517 tests passing?

**PASS — direct evidence from task-3 gate.**

test-output.txt:1306–1313:
```
ℹ tests 517
ℹ pass 517
ℹ fail 0
```

Gate handshake (task-3) verdict: PASS, exit code 0. No regressions introduced.

### 4. Scope discipline — is this within the agreed task boundary?

**PASS.**

The task says to add one test for the `approvalIssueNumber` close behavior. The implementation:
- Added production code at `finalize.mjs:133–139` (the close block for approval issue)
- Added the corresponding test at `harness.test.mjs:377–426`

No unrelated behavior was changed. No feature flags, no refactoring of unrelated code. Scope is clean.

---

## Findings

🟡 test/harness.test.mjs:419 — `ghCalls.includes("500")` will pass if "500" appears anywhere in the log (e.g. in a comment body); strengthen to `ghCalls.includes("issue close 500")` to verify the command format, not just the number
🟡 bin/lib/finalize.mjs:137 — `issuesClosed++` fires even when `closeIssue()` returns false (pre-existing — already in backlog from task-1 and task-2 reviews); confirm backlog entry exists before merge
🔵 test/harness.test.mjs:382 — The approval-close test does not assert the comment text passed to issue 500 ("Feature finalized — all tasks complete."); adding this assertion would give full behavioural coverage for the approval close path, consistent with the comment-checking tests above it

---

## Overall Verdict

**PASS**

Both acceptance criteria are met with direct test evidence:
1. `approvalIssueNumber` is closed (gh log contains "500") ✓
2. `issuesClosed` reflects it (count === 2 = 1 task + 1 approval) ✓

All 517 tests pass. The two 🟡 items are pre-existing or minor hardening; neither is a correctness gap for the stated requirement. The 🔵 is optional improvement. Recommend merge.
