# Tester Review — finalize-auto-close-validation
## Task: "Implementation: `finalize.mjs` closes `state.approvalIssueNumber` in addition to task issues"
## Commits: ff2842a, 39b7955, c27962b, e74a1af, 5064ec7

---

## Overall Verdict: PASS

All 519 tests pass. The core behavior is implemented and the critical path has coverage. Two warnings are filed for backlog; two suggestions logged.

---

## Files Actually Read

- `bin/lib/finalize.mjs` — full file (150 lines)
- `bin/lib/github.mjs` — `closeIssue` function (lines 136–142)
- `test/harness.test.mjs` — finalize describe block (lines 239–554)
- `test/e2e.test.mjs` — finalize step (lines 259–266)
- `.team/features/finalize-auto-close-validation/tasks/task-6/artifacts/test-output.txt` — full gate output

---

## Per-Criterion Results

### 1. Core behavior tested: `approvalIssueNumber` is closed
**PASS — direct evidence**

Test at `test/harness.test.mjs:377` ("closes approvalIssueNumber when present and counts it in issuesClosed"):
- State: `approvalIssueNumber: 500`, one task with `issueNumber: 401`
- Asserts `result.issuesClosed === 2` ✓
- Asserts `ghCalls.includes("500")` ✓

Test output line 392: `✔ closes approvalIssueNumber when present and counts it in issuesClosed (277.391083ms)` — confirmed passing.

### 2. Idempotency: already-completed feature does not re-close
**PASS — direct evidence**

Test at `test/harness.test.mjs:508` ("does not re-close issues when feature is already completed (idempotent)"):
- State has `status: "completed"`, `approvalIssueNumber: 700`
- Asserts no gh calls made (log file absent or empty) ✓

Test output line 395: `✔ does not re-close issues when feature is already completed (idempotent) (50.432209ms)` — confirmed passing.

### 3. Dead code: project board update after close
**WARN — incomplete implementation, no test coverage**

`bin/lib/finalize.mjs:124–127`:
```javascript
const projMatch = String(tracking.statusFieldId || "").match(/\d+/);
// Best-effort: move to done on project board
```
`projMatch` is computed and immediately discarded. No project board status update is performed. The comment implies intent that was never implemented. No test covers or guards against this path — if someone adds the implementation incorrectly, there is no regression test to catch it.

### 4. Assertion strength for approval issue close
**WARN — weak assertion**

`test/harness.test.mjs:418–422`:
```javascript
assert.ok(ghCalls.includes("500"), ...);
```
This only checks that the string `"500"` appears somewhere in the gh call log. It does NOT verify:
- The `close` subcommand was invoked (not `comment` or `edit`)
- The comment `"Feature finalized — all tasks complete."` was passed

The comment text is publicly visible on GitHub. A regression dropping or changing it would not be caught.

### 5. Sole-approval-issue scenario (no task issues)
**GAP — untested path**

No test covers a feature with `approvalIssueNumber` but zero tasks with `issueNumber`. In that scenario `issuesClosed` should be `1`. The logic at `finalize.mjs:134–139` would produce the correct result, but no test locks this in.

### 6. Partial `closeIssue` failure handling
**GAP — untested**

The catch blocks at `finalize.mjs:129` and `finalize.mjs:138` silently swallow all errors. No test verifies `issuesClosed` count behavior when one call succeeds and another throws. Not a production risk given the best-effort contract, but unverified.

---

## Findings

🟡 bin/lib/finalize.mjs:124 — Dead code: `projMatch` is computed but never used; project board is silently not updated on finalize despite the `// Best-effort` comment; either implement the update or remove the dead variable to prevent future confusion and silent contract violation
🟡 test/harness.test.mjs:418 — Weak assertion: only checks `ghCalls.includes("500")`, not that `close` subcommand and comment text "Feature finalized — all tasks complete." were passed; add `assert.ok(ghCalls.includes("issue close 500"))` and `assert.ok(ghCalls.includes("Feature finalized"))` to prevent silent regression on the comment body
🔵 test/harness.test.mjs:377 — No test for `approvalIssueNumber` as the sole issue (feature with no tasks having `issueNumber`); add a fixture with `tasks: []` or all tasks missing `issueNumber` and assert `issuesClosed: 1`
🔵 test/harness.test.mjs:377 — No test for partial `closeIssue` failure; the catch block silently swallows errors and `issuesClosed` count in partial-failure scenarios is unverified; add a fake-gh that exits non-zero for one issue to confirm count behaviour

---

## Regression Risk

**Low.** The `approvalIssueNumber` close logic is simple (lines 134–139) and the `issuesClosed: 2` count assertion would detect its removal. The two 🟡 items are test-quality gaps that reduce confidence in the comment contract and the dead-code smell; backlog both. The two 🔵 items are edge cases with low production impact given `closeIssue`'s own null-guard at `github.mjs:138`.
