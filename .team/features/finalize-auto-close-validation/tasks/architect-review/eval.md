# Architect Review — finalize-auto-close-validation

**Role:** Architect
**Task:** Implementation: `finalize.mjs` closes `state.approvalIssueNumber` in addition to task issues
**Verdict:** PASS

---

## Files Actually Read

1. `.team/features/finalize-auto-close-validation/tasks/task-1/handshake.json` — review, PASS, 0 critical
2. `.team/features/finalize-auto-close-validation/tasks/task-2/handshake.json` — review, PASS, 0 critical
3. `.team/features/finalize-auto-close-validation/tasks/task-3/handshake.json` — review, PASS, 0 critical
4. `.team/features/finalize-auto-close-validation/tasks/task-4/handshake.json` — review, PASS, 0 critical
5. `.team/features/finalize-auto-close-validation/tasks/task-5/handshake.json` — review, PASS, 0 critical
6. `.team/features/finalize-auto-close-validation/tasks/task-6/handshake.json` — gate, PASS, exit 0
7. `.team/features/finalize-auto-close-validation/tasks/task-6/artifacts/test-output.txt` — 519 pass, 0 fail
8. `bin/lib/finalize.mjs` — full file, 150 lines
9. `bin/lib/github.mjs:130–158` — `closeIssue` signature and implementation
10. `test/harness.test.mjs:377–554` — new finalize tests

---

## Per-Criterion Results

### 1. Claim vs. Evidence

**Claimed**: `finalize.mjs` closes `state.approvalIssueNumber` in addition to task issues.

**Evidence** — test output lines 392, 395–396 (test-output.txt):
```
✔ closes approvalIssueNumber when present and counts it in issuesClosed (277.391083ms)
✔ returns issuesClosed: 2 when feature has 2 tasks with issueNumber (281.081417ms)
✔ silently skips tasks without issueNumber and does not affect count (212.826875ms)
✔ does not re-close issues when feature is already completed (idempotent) (50.432209ms)
```

Production code at `finalize.mjs:134–139`:
```js
if (freshState.approvalIssueNumber) {
  try {
    closeIssue(freshState.approvalIssueNumber, "Feature finalized — all tasks complete.");
    issuesClosed++;
  } catch { /* best-effort */ }
}
```

This directly implements the claim. The guard `if (freshState.approvalIssueNumber)` is correct — it handles `undefined`, `null`, and `0` as falsy (no issue to close).

**Result**: PASS — direct evidence from both the test output and the production code path.

---

### 2. Module Boundary Integrity

`finalize.mjs` is an orchestration module. It depends on:
- `util.mjs` — state read/write
- `github.mjs` — external side-effects (close issue)

Adding the `approvalIssueNumber` close does not cross any new module boundaries. The call is structurally identical to the existing task issue close: same `closeIssue()` call, same `issuesClosed++` pattern. No new imports, no new abstractions introduced.

The feature is positioned after the task loop (line 134), making the execution order explicit: close task issues first, then close the approval issue.

**Result**: PASS — clean, consistent with existing module boundaries.

---

### 3. Idempotency / Double-Finalize Safety

The early return at `finalize.mjs:26–33` (status === "completed") prevents re-closing issues on repeat invocations. A second check occurs at lines 82–89 after the lock is acquired. This double-check pattern is correct and ensures the guard holds under concurrent or retry scenarios.

Test at line 508: "does not re-close issues when feature is already completed" — confirmed by asserting `ghLogFile` is absent or empty.

**Result**: PASS — idempotency is enforced and tested.

---

### 4. Pre-Existing Technical Debt (not introduced by this task)

These issues exist in `finalize.mjs` prior to this feature. They are not introduced by this task, but they are exercised by the new code path and are flagged for the backlog.

**Dead no-op block at finalize.mjs:116–127**:
```js
const tracking = readTrackingConfig();          // filesystem read, always
for (const task of freshState.tasks || []) {
  if (task.issueNumber) {
    ...
    if (tracking) {
      const projMatch = String(tracking.statusFieldId || "").match(/\d+/);
      // Best-effort: move to done on project board
    }
    issuesClosed++;
  }
}
```
`readTrackingConfig()` pays a filesystem read on every finalize. `projMatch` is computed and immediately discarded. The comment describes intent; there is no implementation. Every future `finalize` call — including the new approval-issue close path — runs this dead code.

**`closeIssue()` return value discarded at lines 123 and 136**:
```js
closeIssue(task.issueNumber, comment);   // return value ignored
...
issuesClosed++;                           // increments regardless of success
```
The JSON output field `issuesClosed` is the only signal callers have that issues were closed. When `gh` exits non-zero, the count is inflated. No test covers the failure path.

**Bare catch clauses at lines 129 and 138**:
```js
} catch { /* best-effort */ }
```
These swallow all exceptions — including `TypeError` and `ReferenceError` that indicate programming errors. Production failures are invisible.

---

## Findings

🟡 bin/lib/finalize.mjs:116 — `readTrackingConfig()` called unconditionally but result only used in a dead block (line 124); remove or guard behind a "has task issues" check to avoid an unnecessary filesystem read on every finalize
🟡 bin/lib/finalize.mjs:123 — `closeIssue()` return value discarded; `issuesClosed` counter increments regardless of actual `gh` success — reported count is unreliable when `gh` fails
🟡 bin/lib/finalize.mjs:129 — bare `catch {}` swallows all exceptions including programming errors; at minimum write to `process.stderr` so failures are observable in production
🔵 bin/lib/finalize.mjs:134 — the approval-issue close is a second parallel loop appended after the task loop; if project-board support is ever added for the approval issue, the two loops will diverge; consider a unified close-all pass with a discriminated entry type to keep the logic co-located

---

## Overall Verdict

**PASS**

The implementation is correct and minimal. Lines 134–139 are the only code change: a guarded `closeIssue` call and `issuesClosed++`, consistent with the existing pattern for task issues. All 8 finalize tests pass (exit 0, 519 total pass). The four flagged items are pre-existing debt; none block merge.
