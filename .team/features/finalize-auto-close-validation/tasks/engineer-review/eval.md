# Engineer Review — finalize-auto-close-validation
## Task: `finalize.mjs` closes `state.approvalIssueNumber` in addition to task issues

**Verdict: PASS**

---

## Files Read

- `bin/lib/finalize.mjs:1–150` — full implementation
- `bin/lib/github.mjs:1–198` — `closeIssue`, `runGh`, `readTrackingConfig` signatures and internals
- `test/harness.test.mjs:239–555` — all finalize tests covering approval issue close, idempotency, skip behavior, and count
- `.team/features/finalize-auto-close-validation/tasks/task-7/artifacts/test-output.txt` — gate artifact: 519 tests, 0 failures; finalize tests confirmed at lines 387–396

---

## Criteria

### 1. Correctness — PASS

**Core path (lines 134–139 of finalize.mjs):** After closing all task issues, the code checks `freshState.approvalIssueNumber` and closes it:

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
2. Task loop (lines 117–131) closes each task issue with correct comment and increments counter
3. Lines 134–139: approval issue closed, counter incremented
4. `issuesClosed` appears in output JSON

The idempotency guard at lines 26–33 fires before any lock or GitHub calls when `state.status === "completed"`, so a second `finalize` run makes zero `closeIssue` calls. A second guard at lines 82–89 (post-lock) covers concurrent re-entry.

Edge cases verified against tests:
- Task with no `issueNumber` → skipped, counter unaffected (`harness.test.mjs:468`, confirmed in test output line 394)
- `approvalIssueNumber` present → counted separately (`harness.test.mjs:377`, test output line 392)
- Already-completed state → no gh calls at all (`harness.test.mjs:508`, test output line 395)
- 2 task issues → `issuesClosed: 2` (`harness.test.mjs:428`, test output line 393)
- Correct comment text per status (`harness.test.mjs:277,327`, test output lines 390–391)

`closeIssue` in `github.mjs:137–142` correctly passes the comment via `--comment` to `gh issue close`, confirmed at line 140: `if (comment) args.push("--comment", comment)`.

### 2. Code quality — PASS with flags

Implementation is readable and the logic flow is clear. One dead-code block and one semantic imprecision flagged below.

### 3. Error handling — PASS

`closeIssue` in `github.mjs` wraps `spawnSync` via `runGh`, which catches all exceptions and returns `null` on failure. `closeIssue` therefore never throws. The `try/catch` blocks in `finalize.mjs` are dead for exception handling — providing no actual protection. Harmless but misleading.

The `finally { lock.release() }` at line 147 correctly frees the lock regardless of return path.

### 4. Performance — PASS

One `closeIssue` call per task issue plus one for the approval issue. `readTrackingConfig()` called once outside the loop. `spawnSync` is inherently blocking (gh CLI), acceptable in a CLI context.

---

## Findings

🟡 bin/lib/finalize.mjs:122 — `closeIssue` return value discarded; `issuesClosed++` always fires even when gh returns non-zero (closeIssue returns false without throwing); change to `if (closeIssue(task.issueNumber, comment)) issuesClosed++` so the counter reflects successes not attempts
🟡 bin/lib/finalize.mjs:135 — Same semantic bug for approval issue: `if (freshState.approvalIssueNumber && closeIssue(...)) issuesClosed++`
🔵 bin/lib/finalize.mjs:124–127 — Dead code: `projMatch` is declared but never read; project board status update was not implemented; remove or implement to reduce noise
🔵 bin/lib/finalize.mjs:129,138 — `catch {}` blocks are unreachable because `closeIssue` cannot throw (runGh catches internally); add a comment to clarify best-effort intent or remove the try/catch

---

## Summary

The feature is correctly implemented. `finalize.mjs` closes `state.approvalIssueNumber` after all task issues, increments `issuesClosed`, and is protected by double-checked idempotency guards that prevent re-close. All 519 tests pass in the gate run (task-7 artifact, exit code 0), including all 8 new finalize tests. Two warnings: `issuesClosed` counts attempts not successes — a misleading but non-breaking semantic issue on both task and approval close paths. Two cosmetic suggestions on dead code. No critical issues.
