# Feature: Git Worktree Isolation

## Goal
Each feature executes in its own git worktree and branch so parallel features never interfere with each other and partial failures leave the main branch untouched.

## Scope

- Before the first task is dispatched, `_runSingleFeature()` creates a git worktree at `.team/worktrees/{slug}` on a new branch `feature/{slug}`
- Branch naming: normalize the feature slug — replace spaces and underscores with `-`, strip non-alphanumeric/dash/dot chars, cap at 72 chars
- All agent dispatches (`spawnSync` / `spawn`) run with `cwd` set to the worktree directory
- All gate commands (`runGateInline`) run with `cwd` set to the worktree directory
- All auto-commits (`git add -A`, `git commit`) execute inside the worktree
- Git diff calls used to build review context also run inside the worktree
- On feature completion (done, blocked, or exhausted), the worktree directory is removed with `git worktree remove --force`; the feature branch is preserved for manual PR creation
- Auto-push of the feature branch to remote after completion (replaces the current main-branch push)
- Crash recovery: if a worktree already exists at the slug path on restart, reuse it rather than erroring or recreating
- `.team/features/{slug}/` artifacts (STATE.json, progress.md, handshake files, eval files) remain in the main repo directory — these are coordination artifacts, not source code

## Out of Scope

- Running multiple features in parallel simultaneously (separate orchestration concern)
- Auto-creating a GitHub PR from the feature branch
- Merging the feature branch back to main
- Per-worktree dependency setup (npm install, etc.)
- Any changes to review logic, verdict computation, or evaluation roles
- Windows support for worktrees (git worktree requires a POSIX-compatible shell)

## Done When

- [ ] `_runSingleFeature()` calls `git worktree add .team/worktrees/{slug} -b feature/{slug}` before dispatching any task
- [ ] Agent dispatches pass `cwd: worktreePath` to `spawnSync`/`spawn`
- [ ] Gate commands (`runGateInline`) receive and use the worktree path as their working directory
- [ ] Auto-commit (`git add -A` + `git commit`) executes with `cwd: worktreePath`
- [ ] Git diff context calls use the worktree path
- [ ] On feature done/blocked/exhausted, `git worktree remove --force .team/worktrees/{slug}` is called and the feature branch remains
- [ ] Auto-push pushes `feature/{slug}` (not main) to remote
- [ ] If the worktree directory already exists at startup (crash recovery), it is reused without throwing
- [ ] Running two features sequentially leaves no cross-contamination on the main branch (verified by checking main branch diff before/after each feature)
- [ ] Unit tests cover: worktree creation, `cwd` injection into agent briefs and gate commands, cleanup on done, cleanup on blocked, crash-recovery reuse
