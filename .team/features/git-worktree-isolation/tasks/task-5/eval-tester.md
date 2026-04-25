# Tester Eval — task-5

## Verdict: PASS (with backlog flags)

## Summary
Builder claim: replaced `finally { removeWorktree }` with catch-and-rethrow that preserves the worktree on thrown errors, then `removeWorktree` is called on the success path only. `createWorktreeIfNeeded` already reuses existing directories. Added tests covering the no-finally invariant, the catch+rethrow shape, and the reuse path.

## Verification
- Read `bin/lib/run.mjs:1015-1530` — confirmed:
  - Worktree created at line 1016 (its own try/catch).
  - Main try opens at 1022.
  - Catch at 1524 logs "preserving worktree" and rethrows (1528).
  - `removeWorktree` lives at line 1530, OUTSIDE the try, so it only runs on success-path completion.
  - No `finally` block wraps `removeWorktree`.
- Read `test/worktree.test.mjs:355-394` — three new tests for this task.
- Ran `node --test test/worktree.test.mjs`: **32/32 pass**, including the three new ones in `worktree preserved on thrown error`.
- `createWorktreeIfNeeded` (line 166-169) reuses existing dir without spawning git — tested in `worktree.test.mjs:71-83` and again at `:375-393`.

## Per-criterion
| Criterion | Result | Evidence |
|---|---|---|
| Worktree NOT removed on thrown error | PASS | Source assertion test passes; no `finally { removeWorktree }` exists |
| Catch handler logs preservation + rethrows | PASS | Regex-matched in test; `:1524-1529` matches |
| Re-invocation reuses preserved worktree | PASS | `createWorktreeIfNeeded` short-circuits on `existsSync(worktreePath)`; test at `:375-393` confirms zero git calls |
| Success path still calls `removeWorktree` | PARTIALLY VERIFIED | Visible in source at `:1530` but NO test asserts this; only the negative invariant is tested |
| Real-git integration | PASS | `:186-204` — actually creates and removes a real worktree, asserts `git worktree list` no longer contains it |

## Coverage Gaps & Edge Cases

1. **No behavioral test for the preservation invariant**. All three new tests are either source-regex assertions or unit tests of helpers in isolation. There is no test that actually calls `_runSingleFeature`, injects a throw, and asserts the worktree directory still exists on disk and that a re-invocation reuses it. A future refactor could maintain the catch+rethrow shape while adding worktree cleanup elsewhere (e.g., a sibling catch in outer-loop, or a process exit handler) — current tests would not catch this.

2. **Success-path cleanup is untested**. There is no assertion that `removeWorktree` is actually called on a clean run. A regression that deletes line 1530 (or moves it inside a conditional that never fires) would slip through.

3. **Edge case: error after success-path `removeWorktree`**. Line 1530 runs outside the try/catch, so if `git push` (`:1517`, wrapped) or anything else after the main try throws, the worktree could leak. Currently those calls are wrapped, but this is implicit.

4. **Edge case: worktree creation itself fails**. The creation at `:1015-1020` is in its own try/catch and rethrows — the main try has not opened, so the catch handler at `:1524` doesn't fire and no preservation message is logged. Behavior is correct (nothing to preserve) but not explicitly tested.

5. **Edge case: errors between try start (`:1022`) and worktree assignment**. Not possible — `worktreePath` is set before the main try opens. Verified.

## Findings

🟡 test/worktree.test.mjs:355 — Add a behavioral integration test that drives `_runSingleFeature` (with mocked agent/harness) through a thrown error and asserts the worktree directory still exists on disk; current tests are source-regex shape assertions and would not catch a regression that maintains the regex but breaks the invariant elsewhere.
🟡 test/worktree.test.mjs:355 — Add a positive assertion that the success path calls `removeWorktree`; only the failure-path no-removal invariant is tested. A regression deleting `bin/lib/run.mjs:1530` would not be caught.
🔵 bin/lib/run.mjs:1530 — `removeWorktree` runs outside the try/catch; consider documenting that all preceding success-path code (push, finalize) must remain non-throwing, or move the call inside the try with a sentinel.
🔵 test/worktree.test.mjs:366-373 — The catch-shape regex matches "preserving worktree" case-insensitively; tightly coupled to log wording. Consider asserting via a behavioral test instead.
