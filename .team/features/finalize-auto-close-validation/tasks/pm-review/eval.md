# PM Review — finalize-auto-close-validation

**Role:** Product Manager
**Task reviewed:** Implementation: `finalize.mjs` closes `state.approvalIssueNumber` in addition to task issues
**Verdict:** PASS

---

## Files Opened and Read

- `.team/features/finalize-auto-close-validation/SPEC.md` (full file)
- `.team/features/finalize-auto-close-validation/tasks/task-1/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-2/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-3/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-4/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-5/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-6/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-6/artifacts/test-output.txt` (full file, 1316 lines)
- `.team/features/finalize-auto-close-validation/tasks/pm-review/eval.md` (full file — prior review)
- `.team/features/finalize-auto-close-validation/STATE.json` (full file)
- `bin/lib/finalize.mjs` (full file, 150 lines)
- `test/harness.test.mjs` (finalize section, lines 239–554 via grep)

---

## Per-Criterion Results

### 1. Implementation: `finalize.mjs` closes `state.approvalIssueNumber` in addition to task issues

**PASS — direct evidence.**

`bin/lib/finalize.mjs:134–139`:
```js
if (freshState.approvalIssueNumber) {
  try {
    closeIssue(freshState.approvalIssueNumber, "Feature finalized — all tasks complete.");
    issuesClosed++;
  } catch { /* best-effort */ }
}
```

The block is placed *after* the task-issue loop (line 117), operates on the same `issuesClosed` counter, and is included in the final JSON output at line 146. The guard (`if (freshState.approvalIssueNumber)`) correctly makes it conditional — no approval issue means no close attempt.

### 2. Test coverage for the approval-issue close

**PASS — direct evidence.**

`test/harness.test.mjs:377` ("closes approvalIssueNumber when present and counts it in issuesClosed"):
- Fixture: `{ issueNumber: 401 }` (task) + `approvalIssueNumber: 500`
- Asserts `result.issuesClosed === 2` (line 416) — task + approval
- Asserts `ghCalls.includes("500")` (line 420) — proves the approval issue number was actually sent to the gh CLI stub

Test output, line 392:
```
✔ closes approvalIssueNumber when present and counts it in issuesClosed (277.391083ms)
```

Confirmed PASS.

### 3. Full Done When checklist — all 7 criteria

Evidence from test-output.txt lines 388–396 (the finalize suite):

| # | Criterion | Test name | Result |
|---|---|---|---|
| 1 | `issuesClosed: 2` for 2 tasks | "returns issuesClosed: 2 when feature has 2 tasks with issueNumber" | ✔ |
| 2 | Correct comments per status | "posts correct comment to passed task issue" / "posts status-specific comment to skipped task issue" | ✔ (×2) |
| 3 | Closes `approvalIssueNumber`, reflected in count | "closes approvalIssueNumber when present and counts it in issuesClosed" | ✔ |
| 4 | Tasks without `issueNumber` skipped silently | "silently skips tasks without issueNumber and does not affect count" | ✔ |
| 5 | Already-completed idempotency | "does not re-close issues when feature is already completed (idempotent)" | ✔ |
| 6 | Implementation in `finalize.mjs` | `finalize.mjs:134–139` — code present and exercised | ✔ |
| 7 | All existing tests pass | `ℹ tests 519 / ℹ pass 519 / ℹ fail 0` (test-output.txt:1308–1311) | ✔ |

### 4. Scope discipline

**PASS.**

The implementation adds exactly one block (6 lines, `finalize.mjs:134–139`) to an existing function. No new files created. No unrelated behavior changed. The Out of Scope items (project board updates, `agt run` issue creation) are not touched.

### 5. STATE.json consistency

**FLAG — process gap, not a correctness issue.**

STATE.json at the time of review shows:
- `task-6` ("Implementation: finalize.mjs closes approvalIssueNumber"): `"status": "in-progress"`
- `task-7` ("All existing finalize tests continue to pass"): `"status": "pending"`
- Feature `status`: `"executing"`

The implementation is functionally complete and the gate passed, but the harness state has not been advanced past task-6 yet. The gate artifact in FS task-6 exists and validates the gate passed, but the implementation task itself hasn't been transitioned to "passed" in STATE.json. This means `agt finalize` will reject the feature until these tasks are advanced — which is correct behavior.

This is a process gap, not an implementation bug. The builder must transition task-6 → passed and task-7 → passed before finalize can be called.

---

## Findings

🟡 .team/features/finalize-auto-close-validation/STATE.json:94 — task-6 status is "in-progress" and task-7 is "pending"; the builder must transition both tasks to "passed" before `agt finalize` will accept the feature — this is a harness process step, not a code defect, but the feature cannot be closed without it; add to backlog if not addressed this session

🔵 bin/lib/finalize.mjs:125 — `const projMatch = String(tracking.statusFieldId || "").match(/\d+/)` is assigned but never used (no body follows); this pre-existing dead code lives in the function modified by this change — flag for cleanup in a future backlog item

🔵 test/harness.test.mjs:420 — approval-issue close test only asserts `ghCalls.includes("500")` (the issue number), not the specific close comment; no assertion verifies the comment sent to the approval issue is `"Feature finalized — all tasks complete."` — add a stricter assertion to make the comment contract testable

---

## Overall Verdict

**PASS**

All 7 SPEC Done When criteria are met with direct evidence:
1. Implementation code exists at `bin/lib/finalize.mjs:134–139` ✓
2. Dedicated test for approval-issue close exists and passes (`test/harness.test.mjs:377`) ✓
3. `issuesClosed` count correctly reflects approval issue (`result.issuesClosed === 2`) ✓
4. Full test suite: 519 tests, 0 failures ✓
5. Scope boundary respected — only the approval-issue close block was added ✓

The 🟡 item is a harness state management process step (transition tasks to passed), not a defect in the implementation. The implementation itself is correct and the gate confirms it. Recommend merge once the builder advances STATE.json task-6 and task-7.
