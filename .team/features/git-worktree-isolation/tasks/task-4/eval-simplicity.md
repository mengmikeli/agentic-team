# Simplicity Review — task-4 (removeWorktree lifecycle)

## Verdict: PASS

## Files Read
- `.team/features/git-worktree-isolation/tasks/task-4/handshake.json`
- `bin/lib/run.mjs` (lines 170–179, 1515–1525)
- `test/worktree.test.mjs` (full file)
- Recent git log

## Per-Criterion

### 1. Dead code — PASS
- `removeWorktree` (run.mjs:175) is called at run.mjs:1523. No unused exports, no commented-out code, no unreachable branches.

### 2. Premature abstraction — PASS
- `removeWorktree` is a 5-line wrapper around one git invocation. It has a single call site today, but it exists to make the call testable (mock `_execFn`) and to centralize the "swallow already-gone errors" semantic. That earns its keep — without it, the finally block would inline a try/catch around execFileSync.
- The injectable `_execFn` parameter (default `execFileSync`) is a standard test seam, not speculative DI.

### 3. Unnecessary indirection — PASS
- The wrapper transforms behavior (catches & swallows errors); it is not pure delegation.
- The `finally` block at run.mjs:1521-1524 is the minimum needed to guarantee cleanup on both success and throw paths.

### 4. Gold-plating — PASS
- No config flags, no opt-out for cleanup, no "keep worktree on failure" toggle. The behavior is hard-coded to "always remove on completion" — appropriate for the stated requirement.

## Complexity Cost / Cognitive Load
- The lifecycle is easy to follow: create at start of `_runSingleFeature`, remove in `finally`. Two lines of code track the entire lifecycle.
- The real-git integration test in `test/worktree.test.mjs:171-205` is ~35 lines and directly mirrors the acceptance criterion ("`git worktree list` no longer shows it"). Reasonable cost for end-to-end confidence over what was already covered by mock-based tests.

## Deletability
- Could the mock-based lifecycle tests at lines 156-166 be deleted in favor of the real-git test? Yes — they cover the same paths the real-git test exercises. But they're cheap and isolate failure modes, so this is a 🔵 only.

## Findings
🔵 test/worktree.test.mjs:156-166 — Two mock-based "lifecycle" tests are largely redundant with the real-git integration test at 186-204; consider consolidating in a future cleanup.

## Evidence of Correctness
- run.mjs:1523 invokes `removeWorktree(worktreePath, mainCwd)` inside `finally` — runs on both success and error paths.
- run.mjs:177 invokes `git worktree remove --force <path>`, which removes both the directory and the `git worktree list` entry (verified by the real-git test at lines 195-203).
- Test suite per gate output: 543 pass / 0 fail.
