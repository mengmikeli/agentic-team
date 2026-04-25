# Architect Eval — task-4 (git-worktree-isolation)

## Verdict: PASS

## Lens
System design, boundaries, modularity, long-term maintainability.

## Files Read
- `bin/lib/run.mjs` (lines 160-180, 1005-1030, 1515-1530, plus grep of all `worktreePath`/`mainCwd` usages)
- `test/worktree.test.mjs` (full file, 352 lines)
- `.team/features/git-worktree-isolation/tasks/task-4/handshake.json`

## Verification
- Ran `node --test test/worktree.test.mjs` → 29 pass / 0 fail. The real-git integration test at lines 171-204 confirms both directory deletion and tracking-entry removal against an actual `git init` repo (no mocks at the boundary).
- Confirmed lifecycle wiring: `worktreePath` is created at `run.mjs:1016`, the inner execution body is wrapped `try { ... } finally { if (worktreePath) removeWorktree(worktreePath, mainCwd); }` at 1022/1522-1524.

## Per-Criterion Results

| Criterion | Result | Evidence |
|---|---|---|
| `removeWorktree` invoked on success | PASS | `run.mjs:1523`, in `finally`, guaranteed reachable |
| Directory + tracking entry removed | PASS | `worktree.test.mjs:186-204` real-git asserts both |
| Module boundaries / coupling | PASS | Helper colocated with `createWorktreeIfNeeded` (175-179); injected `_execFn` mirrors existing pattern; no new deps |
| Failure isolation | PASS | `removeWorktree` swallows errors so cleanup cannot mask the real run failure (177-178) |
| Scalability at 10x runs | PASS | Idempotent + `--force` ⇒ stale worktrees won't accumulate across re-runs |

## Design Observations
- `removeWorktree` is dependency-injected for testability (default `execFileSync`), matching `createWorktreeIfNeeded` — symmetric, low surprise.
- `--force` is the right default given the cleanup contract; the swallow-and-ignore behavior keeps cleanup non-fatal.
- The `finally` placement is broader than "successful completion" (also fires on thrown errors). For a v1 this is the safer choice (no orphan worktrees), and is recorded as a suggestion only.

## Findings

🔵 bin/lib/run.mjs:1522 — `finally` cleanup also fires on failure paths, discarding the worktree before an operator can inspect it. Consider keeping the worktree on non-zero completion and only removing on success — better post-mortem ergonomics. Non-blocking.
🔵 bin/lib/run.mjs:177 — `--force` will silently discard uncommitted changes inside the worktree. Push at 1517 is best-effort; if push failed, local-only commits stay on the branch (branch is not deleted) but unstaged work is lost. Worth a one-line docstring noting the contract.
🔵 bin/lib/run.mjs:175 — Optional: opportunistic `git worktree prune` on startup would be cheap insurance against externally-deleted worktree dirs. Not required for this task.

## Summary
Small, correct, well-tested change. Real-git integration covers exactly the requirement. Design is consistent with existing helpers and introduces no new boundaries, dependencies, or cross-cutting concerns. Suggestions above are non-blocking design trade-offs to consider for a follow-up.
