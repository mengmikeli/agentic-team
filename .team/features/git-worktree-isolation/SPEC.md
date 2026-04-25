# Feature: Git Worktree Isolation

## Goal
Each feature run executes inside its own git worktree on a dedicated feature branch so parallel features cannot interfere with each other or with the user's main checkout.

## Requirements
- Before any task dispatch, `agt run <feature>` creates (or reuses) a worktree at `.team/worktrees/<feature-slug>` on branch `feature/<slug>`.
- All agent dispatches and gate commands receive `cwd` pointing at the worktree path, not the main checkout.
- Feature-slug is the namespace for worktree path and branch name; slug sanitization must produce a valid git ref (lowercase, `-` separators, no special chars, length-bounded).
- On normal completion the worktree is removed; on crash/interrupt the worktree is left in place so the next run can resume.
- Reusing an existing worktree (resume after crash) must not error and must not reset the branch.
- Failures to create a worktree abort the run with a clear error referencing the feature name.
- No regressions for users running outside a git repo: a clear error must explain that worktree isolation requires git.

## Acceptance Criteria
- [ ] `createWorktreeIfNeeded(slug, mainCwd)` returns an absolute path under `.team/worktrees/<slug>` and creates branch `feature/<sanitized-slug>` if the path does not exist.
- [ ] `slugToBranch(slug)` lowercases, replaces whitespace/underscores with `-`, strips characters outside `[a-z0-9.-]`, and truncates to 72 chars.
- [ ] `dispatchToAgent` and `runGateInline` both honor the worktree `cwd` parameter (no implicit `process.cwd()` fallback when a worktree is active).
- [ ] On successful run completion `removeWorktree` is invoked and the directory + branch tracking entry is gone (`git worktree list` no longer shows it).
- [ ] On thrown error mid-run the worktree remains so a re-invocation reuses it.
- [ ] Two concurrent `agt run` invocations on different features produce two independent worktrees and do not race on `.team/worktrees/`.
- [ ] Running `agt run` outside a git repo prints a useful error and exits non-zero.

## Technical Approach
**Files changed (already present, formalize and complete):**
- `bin/lib/run.mjs` — `slugToBranch`, `createWorktreeIfNeeded`, `removeWorktree`, plus the `runFeature` entry point that invokes them around the task loop (lines ~152–178, ~1006–1017, ~1520).
- `bin/lib/gate.mjs` / `bin/lib/compound-gate.mjs` — ensure gate execution receives the worktree `cwd`.
- `bin/lib/review.mjs` — parallel review dispatches must inherit the worktree `cwd`.

**Key design points:**
- Worktree path: `<mainCwd>/.team/worktrees/<slug>`. Branch: `feature/<slugToBranch(slug)>`. Created with `git worktree add <path> -B <branch>` (force-reset branch pointer to current HEAD on first creation; reuse if path already exists).
- `cwd` is threaded through `dispatchToAgent(agent, brief, cwd)`, `runGateInline(cmd, featureDir, taskId, cwd)`, and `runParallelReviews(..., cwd)`. Caller in `runFeature` overrides `cwd = worktreePath` after creation.
- Cleanup uses `git worktree remove --force <path>`; non-fatal on already-removed worktrees.
- `.team/` artifacts (STATE.json, progress.md, issues) live in the **main checkout**, not the worktree, so state survives worktree removal. Only source-code edits happen inside the worktree.

## Testing Strategy
- **Unit tests** (`test/run.test.mjs` or new `test/worktree.test.mjs`):
  - `slugToBranch` cases: spaces, underscores, unicode, length cap, already-clean slug.
  - `createWorktreeIfNeeded` with a stub `_execFn`: first call invokes `git worktree add`, second call (path exists) returns the path without re-invoking git.
  - `removeWorktree` swallows errors when worktree is already gone.
- **Integration test**: spin up a temp git repo, call `runFeature` with a stub agent dispatcher, assert (a) worktree directory exists during run, (b) `cwd` argument passed to dispatcher equals worktree path, (c) worktree gone after success, (d) worktree retained after thrown error.
- **Manual check**: run two features in parallel terminals against the same repo; confirm `git worktree list` shows both, branches diverge cleanly, and neither pollutes the user's working tree.

## Out of Scope
- Automatic merge / PR creation from the feature branch back to main (handled by `agt finalize`).
- Cross-machine or remote worktrees.
- Cleaning up orphaned worktrees from prior crashed runs (`agt doctor` can surface them, but auto-prune is deferred).
- Per-task worktrees (one worktree per *task* within a feature) — feature-level isolation only.
- Worktree-aware dashboard UI changes.

## Done When
- [ ] All unit + integration tests above pass in CI.
- [ ] `agt run <feature>` on a clean repo creates the worktree, runs the feature, removes the worktree on success.
- [ ] Crashing mid-run leaves the worktree; re-running the same feature reuses it without error.
- [ ] No agent dispatch or gate command in `bin/lib/` references `process.cwd()` directly when a worktree is active (verified by grep audit).
- [ ] Documentation in `PLAYBOOK.md` describes the worktree layout and how to inspect/clean up worktrees manually.
- [ ] Roadmap entry #20 in `charter` / product definition moved out of *(Deferred)* and into Completed Features.
