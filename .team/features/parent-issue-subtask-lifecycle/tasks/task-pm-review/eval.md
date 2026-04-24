## PM Review — `agt finalize` closes parent approval issue

**Reviewer role:** Product Manager
**Task:** `agt finalize` closes the parent approval issue (confirm this already works or fix it)
**Run:** pm-review (post-gate)

---

## Overall Verdict: PASS

---

## Per-Criterion Results

### 1. Implementation exists and is correct

**Result: PASS**

**Evidence:**
- `bin/lib/finalize.mjs:133-139` — Explicit block handles approval issue closing:
  ```js
  if (freshState.approvalIssueNumber) {
    try {
      closeIssue(freshState.approvalIssueNumber, "Feature finalized — all tasks complete.");
      issuesClosed++;
    } catch { /* best-effort */ }
  }
  ```
- The block runs after all task issues are closed and before the JSON output is emitted.
- `closeIssue` at `bin/lib/github.mjs:189` correctly passes the number to `gh issue close`.

### 2. Test coverage is present and meaningful

**Result: PASS (with one weak assertion flagged)**

**Evidence — strong test (`test/harness.test.mjs:377`):**
- Creates a state with `approvalIssueNumber: 500` and one task with `issueNumber: 401`.
- Uses a real fake-gh binary (shell script logging calls to a file).
- Asserts `result.issuesClosed === 2` (both task and approval issue counted).
- Asserts `ghCalls.includes("500")` — the gh CLI was actually invoked with the approval number.
- This is the definitive test for the feature.

**Evidence — integration test (`test/integration.test.mjs:217`):**
- Creates state with `approvalIssueNumber: 999`.
- Asserts `finalized: true`, `STATE.json.status === "completed"`, and correct summary metrics.
- **Weakness:** line 244 only asserts `typeof result.issuesClosed === "number"` — does not verify the count is ≥ 1. Would pass even if `issuesClosed` were 0. Covered by the harness test above, so not a blocker.

### 3. Tests pass in gate output

**Result: PASS**

**Evidence from `task-5/artifacts/test-output.txt`:**
- Line 414: `✔ closes approvalIssueNumber when present and counts it in issuesClosed (289.621041ms)` — PASSED.
- Line 487: `✔ finalize marks state completed and reports issuesClosed when approvalIssueNumber is set (789.981334ms)` — PASSED.
- Gate exit code: 0 (task-5 handshake `"verdict": "PASS"`).

### 4. issuesClosed is reported in output

**Result: PASS**

**Evidence:** `finalize.mjs:141-146` — `issuesClosed` is included in the JSON output. The harness test asserts `result.issuesClosed === 2` (approval issue + 1 task issue).

---

## Findings

🟡 test/integration.test.mjs:244 — Integration test asserts only `typeof result.issuesClosed === "number"`; removing the approval-close block from `finalize.mjs` leaves this test green (issuesClosed would be 0, which is still a number); strengthen to `assert.ok(result.issuesClosed >= 1)` or `assert.equal(result.issuesClosed, 1)` since there are no task issueNumbers in that fixture — log as backlog item, covered by harness test

🔵 bin/lib/finalize.mjs:124-128 — Dead code: `projMatch` is computed but never used (comment says "Best-effort: move to done on project board"); either implement or remove — scope debris, no functional impact

---

## Files Read

- `bin/lib/finalize.mjs` (full file, 150 lines)
- `bin/lib/github.mjs:188-194` (closeIssue function)
- `test/harness.test.mjs:377-426` (closes approvalIssueNumber test)
- `test/integration.test.mjs:217-286` (finalize closes approval issue suite)
- `task-5/artifacts/test-output.txt` (lines 409-418, 486-490)
- `task-5/handshake.json` (gate verdict)
- `task-4/eval.md` (prior review findings)
