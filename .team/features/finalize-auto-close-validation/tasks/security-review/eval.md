# Security Review — finalize-auto-close-validation

**Role:** Security specialist
**Task:** Test: calling `finalize` on an already-completed feature does not re-close issues
**Verdict:** PASS (with backlog items)

---

## Files Opened and Read

- `.team/features/finalize-auto-close-validation/tasks/task-5/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-5/artifacts/test-output.txt`
- `.team/features/finalize-auto-close-validation/tasks/security-review/eval.md` (prior review, task-4 scope)
- `bin/lib/finalize.mjs` (full file, 150 lines)
- `bin/lib/github.mjs` (lines 1–170)
- `bin/lib/util.mjs` (full file)
- `test/harness.test.mjs` (lines 508–554 — the new idempotency test)

---

## Per-Criterion Results

### 1. Gate claim verified against test output

**PASS — direct evidence.**

Gate handshake (task-5) reports exit code 0, verdict PASS. Test output line 395:
```
✔ does not re-close issues when feature is already completed (idempotent) (50.994166ms)
```
519 tests pass, 0 fail.

### 2. Idempotent early-exit is correctly ordered relative to tamper detection

**PASS — code path confirmed.**

`finalize.mjs:21–24` checks `_written_by !== WRITER_SIG` before reaching the early-exit at lines 26–33. A crafted STATE.json must at minimum pass the tamper check before the idempotency guard fires. The test correctly sets `_written_by: "at-harness"` (line 534) to satisfy this. No security regression introduced: the exit order is tamper-check → idempotency-check, not reversed.

### 3. Early exit makes zero gh calls — capturing stub verifies it

**PASS — stronger coverage than prior tasks in this series.**

The test at `test/harness.test.mjs:509–513` writes a capturing stub:
```sh
#!/bin/sh
echo "$@" >> "${ghLogFile}"
echo ok
exit 0
```
The assertion at lines 549–550 reads the log file and asserts it is empty (or absent). This directly proves that `gh` was never invoked, covering both `task.issueNumber: 601` and `approvalIssueNumber: 700` present in the state fixture (lines 524–525, 527). This is a meaningful improvement over the non-capturing stubs used in prior tasks in this series.

### 4. TOCTOU protection for concurrent finalize calls

**PASS — double-check present, ordered correctly.**

`finalize.mjs:69` acquires the file lock. After lock acquisition, `finalize.mjs:82–89` re-reads state and checks `freshState.status === "completed"` before proceeding. If two concurrent callers both initially see a non-completed state, only the first to acquire the lock will write `status: "completed"` (line 91); the second will hit the post-lock early-exit. The idempotency guard thus works at both the pre-lock (line 26) and post-lock (line 82) layers.

### 5. Pre-existing: `task.issueNumber` has no integer type guard

**WARN — unresolved from task-3 and task-4 security reviews.**

`finalize.mjs:118`: guard is `if (task.issueNumber)` (truthy). A non-integer string like `"abc"` passes the truthy check and reaches `closeIssue("abc", comment)`, which calls `spawnSync("gh", ["issue", "close", "abc"])`. No shell injection is possible (spawnSync array form), but `gh` would fail silently via the `try/catch` at line 122–129, and `issuesClosed++` would still fire. The test uses only integer `601` — the non-integer path is untested.

### 6. Pre-existing: `issuesClosed++` unconditional

**WARN — unresolved from task-3 and task-4 security reviews.**

`finalize.mjs:128`: `issuesClosed++` fires regardless of the boolean returned by `closeIssue`. Since `closeIssue` never throws (returns `false` on `gh` failure), the count reports "tasks with an issueNumber" not "issues actually closed". This inflates the reported count on partial failures. Not introduced by this change but still unresolved.

### 7. Dead code: `tracking` block computes but discards `projMatch`

**SUGGESTION — incomplete implementation left in production path.**

`finalize.mjs:124–127`:
```js
if (tracking) {
  const projMatch = String(tracking.statusFieldId || "").match(/\d+/);
  // Best-effort: move to done on project board
}
```
`projMatch` is assigned but never used. `readTrackingConfig()` (line 116) incurs a filesystem read on every finalize call, and the result is only consulted by this dead block. This is not a security issue, but it signals an incomplete feature that could mislead future reviewers into thinking project board status is being updated on finalize.

### 8. Weak STATE.json tamper detection — structural concern

**WARN — pre-existing design constraint.**

`finalize.mjs:21–24` gates on `_written_by === "at-harness"`. This is a string field that any filesystem-write-capable actor can set. Unlike `approval.json` (which uses HMAC signing with a key from `.approval-secret`), STATE.json has no cryptographic integrity check. An attacker who can write STATE.json can set `status: "completed"` + `_written_by: "at-harness"` and cause `finalize` to report `finalized: true, note: "already finalized"` without any task validation, lock acquisition, or issue closing.

For a developer-local tool this is acceptable, but noting because it means the idempotency guard can be triggered by a crafted file, not only by a legitimate prior finalize run.

---

## Findings

🟡 bin/lib/finalize.mjs:118 — `task.issueNumber` has no integer type guard; a crafted STATE.json with `issueNumber: "bad"` passes the truthy check and silently reaches `gh issue close "bad"` — add `Number.isInteger(task.issueNumber)` guard (pre-existing, unresolved from task-3 and task-4 reviews)
🟡 bin/lib/finalize.mjs:128 — `issuesClosed++` fires unconditionally regardless of `closeIssue` return value; count inflates when `gh` fails — change to `if (closeIssue(...)) issuesClosed++` (pre-existing, unresolved from task-3 and task-4 reviews)
🟡 bin/lib/finalize.mjs:21 — STATE.json tamper detection relies on a string field (`_written_by`) with no cryptographic backing; a filesystem-write-capable actor can set `status: "completed"` and trigger the idempotency early-exit without legitimate prior finalization (pre-existing structural constraint)
🔵 bin/lib/finalize.mjs:124 — Dead code: `readTrackingConfig()` is called and `projMatch` is computed but neither is used; remove or complete the block to avoid misleading future reviewers about project board status being updated on finalize

---

## Overall Verdict

**PASS**

No critical findings. No new security surface introduced — this commit adds one test. The implementation correctly places the idempotency guard (`state.status === "completed"` at line 26) after tamper detection (line 21), before lock acquisition (line 69), and the guard is re-applied post-lock (line 82) for TOCTOU safety. The test uses a capturing `gh` stub and asserts zero invocations, directly proving no GitHub API calls are made for an already-completed feature. The three 🟡 findings are pre-existing debt that should remain in the backlog.
