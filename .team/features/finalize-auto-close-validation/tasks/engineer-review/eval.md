# Engineer Review — finalize-auto-close-validation
## Task: `finalize.mjs` closes `state.approvalIssueNumber` in addition to task issues

**Verdict: PASS**

---

## Files Read

- `bin/lib/finalize.mjs:1–150` — full implementation
- `bin/lib/github.mjs` — `closeIssue`, `runGh`, `readTrackingConfig` signatures and internals
- `test/harness.test.mjs:377–554` — all new finalize tests covering approval issue close, idempotency, skip behavior, and count
- `.team/features/finalize-auto-close-validation/tasks/task-6/artifacts/test-output.txt` — 519 tests, 0 failures; target tests pass at lines 387–396 of the output

---

## Criteria

### 1. Correctness — PASS

**Core path (lines 134–139):** After closing all task issues, `finalize.mjs` checks `freshState.approvalIssueNumber` and closes it:

```js
if (freshState.approvalIssueNumber) {          // line 134
  try {
    closeIssue(freshState.approvalIssueNumber, "Feature finalized — all tasks complete.");
    issuesClosed++;
  } catch { /* best-effort */ }
}
```

Execution path for the happy path:
1. Lock acquired → `freshState` loaded (post-lock re-read)
2. Task loop (lines 117–131) closes each task issue and increments counter
3. Lines 134–139: approval issue closed, counter incremented
4. `issuesClosed` appears in output JSON

The idempotency guard at lines 26–33 fires before any lock or GitHub calls when `state.status === "completed"`, so a second `finalize` run makes zero `closeIssue` calls. A second guard at lines 82–89 (post-lock) also covers the concurrent re-entry race.

Edge cases verified via tests:
- Task with no `issueNumber` → skipped, counter unaffected (`harness.test.mjs:468`)
- `approvalIssueNumber` present → counted separately (`harness.test.mjs:377`)
- Already-completed state → no gh calls at all (`harness.test.mjs:508`)

### 2. Code quality — PASS with flags

Implementation is readable and the logic flow is clear. One pre-existing dead-code block and one semantic imprecision are flagged below.

### 3. Error handling — PASS

`closeIssue` in `github.mjs:137–142` wraps `spawnSync` via `runGh`, which itself catches all exceptions and returns `null` on failure. `closeIssue` therefore never throws. The `try/catch` blocks in `finalize.mjs` are consequently dead for exception handling — they provide no actual protection. This is harmless but misleading.

The `finally { lock.release() }` at line 147 correctly frees the lock regardless of return path, including the post-lock idempotency guard at line 88.

### 4. Performance — PASS

No n+1 or blocking concerns. One `closeIssue` call per task issue plus one for the approval issue. `readTrackingConfig()` is called once outside the loop. `spawnSync` is inherently blocking (gh CLI), which is acceptable in this CLI context.

---

## Findings

🟡 bin/lib/finalize.mjs:122 — `closeIssue` return value discarded; `issuesClosed++` always fires even when gh fails (closeIssue returns false); change to `if (closeIssue(task.issueNumber, comment)) issuesClosed++` so the counter reflects successes not attempts
🟡 bin/lib/finalize.mjs:135 — Same as above for approval issue: `if (freshState.approvalIssueNumber && closeIssue(...)) issuesClosed++`
🔵 bin/lib/finalize.mjs:124–127 — Dead code: `projMatch` declared but never read; project board status update was not implemented; remove to reduce noise
🔵 bin/lib/finalize.mjs:129,138 — `catch {}` blocks are unreachable because `closeIssue` cannot throw (runGh catches internally); clarify intent with a comment or remove if truly best-effort

---

## Summary

The feature is correctly implemented. `finalize.mjs` closes `state.approvalIssueNumber` after all task issues, increments `issuesClosed`, and is protected by idempotency guards that prevent double-closes. All target tests pass in the gate run (519/519). Two warnings: `issuesClosed` counts attempts not successes — a misleading but non-breaking semantic issue present in both task and approval close paths. Two cosmetic suggestions on dead code. No critical issues.
