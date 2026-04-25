# Progress: git-worktree-isolation

**Started:** 2026-04-25T12:08:02.413Z
**Tier:** functional
**Tasks:** 13

## Plan
1. `createWorktreeIfNeeded(slug, mainCwd)` returns an absolute path under `.team/worktrees/<slug>` and creates branch `feature/<sanitized-slug>` if the path does not exist.
2. `slugToBranch(slug)` lowercases, replaces whitespace/underscores with `-`, strips characters outside `[a-z0-9.-]`, and truncates to 72 chars.
3. `dispatchToAgent` and `runGateInline` both honor the worktree `cwd` parameter (no implicit `process.cwd()` fallback when a worktree is active).
4. On successful run completion `removeWorktree` is invoked and the directory + branch tracking entry is gone (`git worktree list` no longer shows it).
5. On thrown error mid-run the worktree remains so a re-invocation reuses it.
6. Two concurrent `agt run` invocations on different features produce two independent worktrees and do not race on `.team/worktrees/`.
7. Running `agt run` outside a git repo prints a useful error and exits non-zero.
8. All unit + integration tests above pass in CI.
9. `agt run <feature>` on a clean repo creates the worktree, runs the feature, removes the worktree on success.
10. Crashing mid-run leaves the worktree; re-running the same feature reuses it without error.
11. No agent dispatch or gate command in `bin/lib/` references `process.cwd()` directly when a worktree is active (verified by grep audit).
12. Documentation in `PLAYBOOK.md` describes the worktree layout and how to inspect/clean up worktrees manually.
13. Roadmap entry #20 in `charter` / product definition moved out of *(Deferred)* and into Completed Features.

## Execution Log

