## Architect Review — finalize-auto-close-validation

**Reviewer role:** Architect
**Task:** Test: each closed task issue receives the correct comment (`"Task completed — gate passed."` for passed, status-specific for skipped)
**Date:** 2026-04-24

---

## Overall Verdict: PASS

Tests are correct, pass, and use a concrete capturing-stub approach that directly verifies `gh` invocation arguments. No new architectural debt introduced. Pre-existing issues (inherited from `finalize.mjs`) are in the backlog from the parallel review.

---

## Files Actually Read

- `.team/features/finalize-auto-close-validation/tasks/task-1/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-2/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-1/eval.md`
- `.team/features/finalize-auto-close-validation/tasks/task-1/artifacts/test-output.txt`
- `.team/features/finalize-auto-close-validation/tasks/task-2/artifacts/test-output.txt`
- `bin/lib/finalize.mjs`
- `test/harness.test.mjs` (lines 1–20, 277–392)

---

## Per-Criterion Results

### 1. Claimed artifacts exist and gate confirms passing
**PASS.** `tasks/task-2/artifacts/test-output.txt` shows `tests 516 / pass 516 / fail 0`. The two new tests are visible at the `finalize` describe block:
```
✔ posts correct comment to passed task issue ('Task completed — gate passed.') (496ms)
✔ posts status-specific comment to skipped task issue ('Feature finalized. Task status: skipped.') (285ms)
```
The task-1 artifact shows 514 tests (pre-dates these additions) — consistent with task-1 being the review node and task-2 being the gate run after implementation. Gate is authoritative.

### 2. Test design is architecturally sound
**PASS.** The capturing stub at `test/harness.test.mjs:280–284` creates a real executable `gh` binary in a tmpdir that appends all arguments to a log file. The test then reads the log and asserts the exact comment string appears. This:
- Verifies the actual CLI invocation, not a mocked module call
- Is hermetic (PATH manipulation via `env` option at line 310)
- Properly cleans up `fakeBinDir` in `finally` (lines 322–324)

This is a step up from the prior stub approach flagged in the original review as a concern (only counting calls, not inspecting args).

### 3. Implementation produces correct comment routing
**PASS.** `bin/lib/finalize.mjs:119–121` contains:
```js
const comment = task.status === "passed"
  ? "Task completed — gate passed."
  : `Feature finalized. Task status: ${task.status}.`;
```
Logic is a simple ternary with the exact strings tested. No path where the wrong branch could fire for `passed` vs `skipped`.

### 4. Pre-existing architectural debt (not introduced here)
**WARN (pre-existing, backlog).** Two issues in `finalize.mjs` pre-date this task and are already flagged in task-1/eval.md:
- `finalize.mjs:123`: `closeIssue()` return value discarded; `issuesClosed` increments on silent `gh` failure
- `finalize.mjs:124–127`: Dead code block (`projMatch` computed, never used; `readTrackingConfig()` I/O paid on every finalize with no action taken)

Neither was introduced by the current task. Both should remain in backlog.

---

## Findings

🟡 test/harness.test.mjs:277 — No test covers `gh` exit non-zero: because `closeIssue` return value is discarded, a failing `gh` still increments `issuesClosed`; add a failure-path test (stub `gh` exits 1) to prevent the counter from silently misreporting — or fix `finalize.mjs:123` first then add the test

🟡 test/harness.test.mjs:277 — No mixed-status test (one `passed` + one `skipped` task in the same finalize run); a condition inversion in the ternary at `finalize.mjs:119` would not be caught — add a single two-task test asserting both comment strings appear in the log

🔵 test/harness.test.mjs:286 — Feature dirs `comment-passed-test` and `comment-skipped-test` are created in the shared `testDir` but never cleaned up; only `fakeBinDir` is removed in the `finally` block — extend cleanup to remove the feature dir, or use a per-test tmpdir

🔵 test/harness.test.mjs:278 — `mkdtempSync`/`tmpdir` first used at line 278 but imported at line 464; move both to the top-of-file `import { ... } from "fs"` / `import { ... } from "os"` blocks (pre-existing, flagged by parallel review)
