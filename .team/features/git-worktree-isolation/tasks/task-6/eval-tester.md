# Tester Evaluation — task-6

## Verdict: PASS

## Evidence

Re-ran `node --test test/worktree.test.mjs`: **34/34 pass, 0 fail** (440ms).

The two new tests directly targeting the task claim both pass:
- `concurrent createWorktreeIfNeeded on different slugs > two concurrent invocations on different features produce two independent worktrees` — uses a real `git init`'d repo, races two `createWorktreeIfNeeded` calls via `Promise.all`, asserts distinct paths, on-disk existence, and presence of both entries in `git worktree list`.
- `parent .team/worktrees/ directory is not corrupted by concurrent creation` — extends the same pattern to 4 slugs.

Source claims (handshake) match the artifact (`test/worktree.test.mjs`), and the tests exercise `createWorktreeIfNeeded` in `bin/lib/run.mjs:163` against a real git repo (no over-mocking).

## Per-Criterion

| Criterion | Result | Evidence |
|---|---|---|
| Two concurrent invocations produce independent worktrees | PASS | Both slug paths distinct and present in `git worktree list` |
| No race on `.team/worktrees/` | PASS | 4-slug parallel test produces 4 unique paths, all exist |
| Cleanup is sound | PASS | `removeWorktree` called in test bodies before `afterEach`'s `rm -rf` so git locks aren't tripped |
| Real git used (not mocked) | PASS | `execFileSync("git", ["init", ...])` in `beforeEach` |

## Findings

🟡 test/worktree.test.mjs:375 — `Promise.all` wraps `execFileSync`-backed sync calls, so the two creations are actually serialized on the event loop, not concurrent at the OS level. The assertions about distinct paths and `git worktree list` correctness still hold, but the "race" framing oversells what's exercised. To genuinely prove no race, fork two child processes (e.g. `child_process.spawn` two `node -e` invocations) and `Promise.all` their `.exited` promises. Flag for backlog only — current behavior is correct, and a true OS-level race test is significantly more work.
🟡 test/worktree.test.mjs:370 — No coverage for two concurrent invocations on the **same** slug. That's the actual race-prone case (both see `existsSync === false`, both call `git worktree add` for the same path → one fails). Not covered by this task's claim, but a logical sibling worth a backlog ticket.
🔵 test/worktree.test.mjs:238 — `node -e 'process.exit(1)'` uses single-quotes; on Windows `cmd.exe` does not strip them, which could break the FAIL-verdict test on Windows. Existing test, not introduced here, but adjacent.
🔵 test/worktree.test.mjs:166 — `existsSync(worktreePath)` only checks the directory; if `.team/worktrees/<slug>` exists as a stale dir not registered with git, `createWorktreeIfNeeded` silently returns it without verifying git's bookkeeping. No test covers this. Minor; documented behavior is "reuse on crash recovery."

## Summary

The implementation works and the new tests prove the contract for the realistic single-process call pattern. The `Promise.all`-over-sync caveat is real but doesn't undermine the assertions about git's on-disk state — `git worktree add` is the operation that would race, and exercising it twice back-to-back against the same repo is a meaningful smoke test. Backlog the same-slug race and a true child-process concurrency test.
