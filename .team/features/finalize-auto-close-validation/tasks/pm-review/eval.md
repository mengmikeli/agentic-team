# PM Review — finalize-auto-close-validation

**Role:** Product Manager
**Task reviewed:** Test: calling `finalize` on an already-completed feature does not re-close issues
**Verdict:** PASS

---

## Files Opened and Read

- `.team/features/finalize-auto-close-validation/SPEC.md` (full file)
- `.team/features/finalize-auto-close-validation/tasks/task-1/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-2/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-3/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-4/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-5/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-5/artifacts/test-output.txt` (lines 387–396, 1308–1315)
- `.team/features/finalize-auto-close-validation/tasks/task-4/eval.md` (full file)
- `bin/lib/finalize.mjs` (full file, 150 lines)
- `test/harness.test.mjs` (lines 508–554)

---

## Per-Criterion Results

### 1. SPEC.md Done When — "Test: calling `finalize` on an already-completed feature does not re-close issues"

**PASS — direct evidence.**

Test at `test/harness.test.mjs:508–554`:
- Fixture has `status: "completed"`, one task with `issueNumber: 601`, `approvalIssueNumber: 700`
- Calls `agt-harness finalize` via CLI
- Asserts `result.finalized === true` and `result.note === "already finalized"` (lines 546–547)
- Asserts no `gh` calls were made: checks that the fake-gh log file is absent or empty (lines 549–550)

The fake `gh` binary appends every invocation to a log file. An empty log proves no issue-close operations reached the OS level. This directly satisfies the criterion.

Production guard at `bin/lib/finalize.mjs:26–33` — early return before any lock acquisition or `closeIssue` calls:
```js
if (state.status === "completed") {
  console.log(JSON.stringify({
    finalized: true,
    feature: state.feature,
    note: "already finalized",
  }));
  return;
}
```

Test output (test-output.txt line 395):
```
✔ does not re-close issues when feature is already completed (idempotent) (50.994166ms)
```

Confirmed PASS.

### 2. Coverage of both issue types (task issue + approval issue)

**PASS.**

The test fixture includes both `issueNumber: 601` (task) and `approvalIssueNumber: 700` (approval). The single "no gh calls" assertion covers both issue types — if either were closed, the log would be non-empty. Implicit but adequate coverage for the stated requirement.

### 3. No regressions — all existing tests continue to pass

**PASS — direct evidence from gate (task-5).**

test-output.txt lines 1308–1311:
```
ℹ tests 519
ℹ pass 519
ℹ fail 0
```

Gate handshake verdict: PASS, exit code 0.

### 4. Scope discipline

**PASS.**

The task boundary is a single new test for the idempotency path. The implementation:
- Added no new production logic (the `status === "completed"` guard pre-existed at `finalize.mjs:26–33`)
- Added one test case at `test/harness.test.mjs:508–554`

No unrelated behavior was changed, no extra files created. Scope is clean.

---

## Findings

🟡 test/harness.test.mjs:547 — `result.note === "already finalized"` asserts an undocumented API contract not specified in SPEC.md; if consumers parse finalize JSON output they will depend on this field — add `note` field to finalize contract documentation or SPEC so the shape is intentional, not incidental → add to backlog

🔵 test/harness.test.mjs:519 — The `approvalIssueNumber: 700` in the fixture is present but plays no distinct role beyond increasing the implied issue count; consider a variant fixture without `approvalIssueNumber` to confirm the no-gh-calls assertion still holds when only a task issue is present

🔵 .team/features/finalize-auto-close-validation/tasks/task-[1-4]/handshake.json — All four review tasks show `compoundGate.layers: ["fabricated-refs"]` with verdict WARN; this is a recurring pattern across reviews for this feature and may indicate reviewers are citing file paths that don't resolve at gate-check time — investigate root cause to eliminate false positives in future reviews

---

## Overall Verdict

**PASS**

The acceptance criterion is met with direct evidence:
1. Test exists at `test/harness.test.mjs:508` and passes (test-output.txt:395) ✓
2. No `gh` calls made on already-completed feature — asserted via stub log check ✓
3. Both task issue and approval issue are implicitly covered by the no-calls assertion ✓
4. All 519 tests pass, no regressions ✓

The one 🟡 item is a documentation gap (undocumented API contract), not a correctness issue. The 🔵 items are optional improvements. Recommend merge.
