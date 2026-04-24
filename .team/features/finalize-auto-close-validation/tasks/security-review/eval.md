# Security Review — finalize-auto-close-validation

**Role:** Security specialist
**Task:** Implementation: `finalize.mjs` closes `state.approvalIssueNumber` in addition to task issues
**Verdict:** PASS (with backlog items)

---

## Files Opened and Read

- `bin/lib/finalize.mjs` (full file, 150 lines)
- `bin/lib/github.mjs` (lines 1–158)
- `test/harness.test.mjs` (lines 377–426 — the new approvalIssueNumber test)
- `.team/features/finalize-auto-close-validation/tasks/task-6/artifacts/test-output.txt` (gate output)
- `.team/features/finalize-auto-close-validation/tasks/task-6/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/security-review/eval.md` (prior review, task-5 scope)

---

## Per-Criterion Results

### 1. Gate claim verified against test output

**PASS — direct evidence.**

Gate handshake (task-6) reports exit code 0, verdict PASS. Test output lines 392–396:
```
✔ closes approvalIssueNumber when present and counts it in issuesClosed (277.391083ms)
✔ returns issuesClosed: 2 when feature has 2 tasks with issueNumber (281.081417ms)
✔ silently skips tasks without issueNumber and does not affect count (212.826875ms)
✔ does not re-close issues when feature is already completed (idempotent) (50.432209ms)
```
519 tests pass, 0 fail.

### 2. New code path — approvalIssueNumber closing (lines 133–139)

**PASS — core behavior confirmed.**

`finalize.mjs:134–139` adds:
```js
if (freshState.approvalIssueNumber) {
  try {
    closeIssue(freshState.approvalIssueNumber, "Feature finalized — all tasks complete.");
    issuesClosed++;
  } catch { /* best-effort */ }
}
```

The test at `test/harness.test.mjs:377–426` creates a capturing `gh` stub, sets `approvalIssueNumber: 500` in STATE.json, and asserts `issuesClosed === 2` and that `ghCalls.includes("500")`. This directly proves `gh issue close 500` was invoked. The comment is hardcoded — no user-controlled content in the approval issue comment.

### 3. No shell injection — confirmed

**PASS — code path traced.**

`closeIssue` at `github.mjs:137–142`:
```js
export function closeIssue(number, comment) {
  if (!number) return false;
  const args = ["issue", "close", String(number)];
  if (comment) args.push("--comment", comment);
  return runGh(...args) !== null;
}
```

`runGh` uses `spawnSync("gh", args, {...})` with `args` as an array — no shell string interpolation, no shell metacharacter risk. Even if `approvalIssueNumber` contained special characters, they would be passed as a single argument to `gh`, not interpreted by a shell.

### 4. Idempotency guard remains intact

**PASS — verified ordering.**

The new closing code is at lines 133–139, which executes only after:
- Tamper check (`_written_by === WRITER_SIG`) at line 21
- Pre-lock idempotency check (`state.status === "completed"`) at line 26
- Lock acquisition at line 69
- Post-lock re-check (`freshState.status === "completed"`) at line 82

An already-completed feature exits at line 82 before reaching line 133. The idempotency test at line 508 in the test file confirms `gh` is not called for already-completed features.

### 5. Integer type guard missing on `approvalIssueNumber` — NEW INSTANCE

**WARN — same pattern as pre-existing `task.issueNumber:118`.**

`finalize.mjs:134`: guard is `if (freshState.approvalIssueNumber)` (truthy). A crafted STATE.json with `approvalIssueNumber: "not-a-number"` passes the truthy check and reaches `closeIssue("not-a-number", ...)`. `closeIssue` has `if (!number) return false` but this won't catch non-empty strings. `gh issue close not-a-number` will fail (non-zero exit), `runGh` returns null, `closeIssue` returns false — but the `try {}` block does not check the return value and `issuesClosed++` fires anyway. No injection (spawnSync array form), but the count is inflated by 1 on invalid input.

The test only exercises `approvalIssueNumber: 500` (valid integer) — the invalid string path is untested.

### 6. `issuesClosed++` unconditional for approvalIssueNumber — NEW INSTANCE

**WARN — same pattern as pre-existing line 128.**

`finalize.mjs:137`: `issuesClosed++` fires unconditionally inside the `try {}` block, regardless of `closeIssue`'s return value. `closeIssue` never throws (catches internally, returns false on failure). This means the reported `issuesClosed` count represents "issues for which close was attempted" not "issues successfully closed".

### 7. Dead code in tracking block — pre-existing

**SUGGESTION — unchanged from prior review.**

`finalize.mjs:116–127`: `readTrackingConfig()` is called on every finalize (filesystem read). The result `tracking` is only consulted to extract `projMatch` via regex, which is then discarded unused. The block serves no purpose. Not a security issue, but misleads future reviewers about project board status being updated.

### 8. STATE.json tamper detection is not cryptographic — pre-existing

**WARN — pre-existing structural constraint, no change.**

`finalize.mjs:21–24` gates on `state._written_by === "at-harness"`. This is a plaintext string field. Any filesystem-write-capable actor can craft STATE.json with `_written_by: "at-harness"` and reach all downstream logic. Contrast with `approval.json`, which uses HMAC signing. For a developer-local tool this is acceptable, but the idempotency guard and early exits can be bypassed by file manipulation.

---

## Findings

🟡 bin/lib/finalize.mjs:134 — `approvalIssueNumber` has no integer type guard; a crafted STATE.json with `approvalIssueNumber: "abc"` passes the truthy check, reaches `gh issue close abc` (fails silently), but still increments `issuesClosed` — add `Number.isInteger(freshState.approvalIssueNumber)` guard; mirrors pre-existing finding on `task.issueNumber:118`
🟡 bin/lib/finalize.mjs:137 — `issuesClosed++` fires unconditionally; `closeIssue` return value is not checked; count inflates when `gh` fails — change to `if (closeIssue(...)) issuesClosed++`; mirrors pre-existing finding on line 128
🟡 bin/lib/finalize.mjs:118 — `task.issueNumber` has no integer type guard (pre-existing, unresolved)
🟡 bin/lib/finalize.mjs:128 — `issuesClosed++` unconditional for task issues (pre-existing, unresolved)
🟡 bin/lib/finalize.mjs:21 — STATE.json tamper detection relies on a plaintext `_written_by` string with no cryptographic backing; filesystem-write-capable actor can bypass (pre-existing structural constraint)
🔵 bin/lib/finalize.mjs:124 — Dead code: `readTrackingConfig()` is called and `projMatch` computed but neither is used; remove or complete the block (pre-existing)

---

## Overall Verdict

**PASS**

No critical findings. The new `approvalIssueNumber` closing block (lines 133–139) introduces no new attack surface: `closeIssue` uses `spawnSync` in array form (no shell injection), the comment is hardcoded (no user-controlled content), and the idempotency guard at lines 26 and 82 prevents double-closing. The test at `test/harness.test.mjs:377–426` uses a capturing `gh` stub and directly verifies `issuesClosed === 2` and that gh was called with issue number 500.

The two new 🟡 findings (`finalize.mjs:134` and `:137`) are the same pre-existing patterns from lines 118 and 128 applied to the new code path. They should be added to the backlog alongside the existing items.
