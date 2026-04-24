# Architect Review — finalize-auto-close-validation

**Task**: Test: tasks without `issueNumber` are skipped silently and do not affect the count
**Role**: Architect
**Verdict**: PASS

---

## Files Actually Read

1. `.team/features/finalize-auto-close-validation/tasks/task-1/handshake.json` — review, PASS
2. `.team/features/finalize-auto-close-validation/tasks/task-2/handshake.json` — review, PASS
3. `.team/features/finalize-auto-close-validation/tasks/task-3/handshake.json` — review, PASS
4. `.team/features/finalize-auto-close-validation/tasks/task-4/handshake.json` — gate, PASS, exit 0
5. `.team/features/finalize-auto-close-validation/tasks/task-4/artifacts/test-output.txt` — 518 pass, 0 fail
6. `test/harness.test.mjs` (via `git show e74a1af`) — 40 lines added
7. `bin/lib/finalize.mjs` — production implementation
8. `bin/lib/github.mjs:130–158` — `closeIssue` signature and implementation
9. `bin/lib/util.mjs:185–198` — `readState` implementation

---

## Per-Criterion Results

### 1. Claim vs. Evidence

**Claimed**: "silently skips tasks without `issueNumber` and does not affect count"

**Evidence**:
- Test output line 394: `✔ silently skips tasks without issueNumber and does not affect count (217.125542ms)` — direct confirmation
- Test logic (from git show): creates state with `t1` (issueNumber: 201, passed) and `t2` (no issueNumber, passed), runs `finalize`, asserts `result.issuesClosed === 1`
- Production code at `finalize.mjs:118`: `if (task.issueNumber)` — the guard is present and correct

**Result**: PASS — evidence is direct and unambiguous

---

### 2. Design Boundary Integrity

The test is hermetic:
- Uses `mkdtempSync` for isolation
- Injects a fake `gh` binary via PATH override (`echo ok; exit 0`)
- Cleans up the fake binary in a `finally` block
- Writes STATE.json directly (valid pattern for harness unit tests)

`readState` at `util.mjs:190` is a plain JSON parse with no integrity check — the test's manually constructed STATE.json is accepted without issue. This is the correct behavior for a utility function.

**Result**: PASS — boundaries are clean, no shared state leakage

---

### 3. Production Code Correctness

The `if (task.issueNumber)` guard at `finalize.mjs:118` correctly handles:
- `undefined` (field absent) → falsy, skipped
- `null` → falsy, skipped
- `0` → falsy, skipped (edge case: should never occur in practice)
- A valid integer → truthy, processed

`closeIssue` at `github.mjs:137` accepts a `comment` parameter and passes it as `--comment` to `gh issue close`. This is a clean, single-call close+comment pattern.

**Result**: PASS

---

### 4. Pre-Existing Technical Debt (not introduced by this task)

Two issues are present in `finalize.mjs` from prior commits and were **not introduced** by this task. They are flagged for the backlog:

**Dead code at `finalize.mjs:124–127`**:
```js
const projMatch = String(tracking.statusFieldId || "").match(/\d+/);
// Best-effort: move to done on project board
```
`projMatch` is computed but never used. The stub comment describes intent without implementation. This is shipped dead code.

**Bare catch clauses at `finalize.mjs:129` and `finalize.mjs:138`**:
```js
} catch { /* best-effort */ }
```
These swallow all errors — including programming errors (TypeError, ReferenceError) that would indicate bugs in the calling code. Best-effort network operations should catch narrowly (e.g., checking for a specific error type or at minimum logging to stderr at debug level).

---

## Findings

🟡 bin/lib/finalize.mjs:124 — `projMatch` is computed but never used; remove the dead code or implement the project-board status update it was meant to enable
🟡 bin/lib/finalize.mjs:129 — bare `catch {}` swallows programming errors as well as network errors; log to stderr at debug level or narrow the catch scope to expected failure modes
🔵 test/harness.test.mjs:394 — the fake `gh` binary accepts all commands unconditionally; consider capturing invocations to assert that `gh issue close 201` was called exactly once and `gh issue close` was never called without a valid number

---

## Overall Verdict

**PASS**

The test correctly and completely verifies the claimed behavior. The production guard (`if (task.issueNumber)`) is in place and confirmed by a passing hermetic test. The two yellow findings are pre-existing issues in `finalize.mjs` that belong in the backlog; they were not introduced by this task and do not affect correctness of the tested behavior.
