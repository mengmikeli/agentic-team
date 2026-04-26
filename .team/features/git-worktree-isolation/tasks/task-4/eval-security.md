# Security Review — task-4 (removeWorktree on completion)

## Verdict: PASS

## Files actually read
- `bin/lib/run.mjs` lines 150–180 (helpers) and 1500–1530 (call site)
- `test/worktree.test.mjs` (full file, including the new real-git lifecycle test)
- `bin/lib/outer-loop.mjs` lines 848–862 (slug source for `_runSingleFeature`)
- `.team/features/git-worktree-isolation/tasks/task-4/handshake.json`

## Claim verification
Builder claim (handshake): npm test, exit 0; artifact `artifacts/test-output.txt`.
- Gate output in this prompt shows the test suite running, including `test/worktree.test.mjs`.
- The new `removeWorktree real-git lifecycle` describe block (worktree.test.mjs:181–215) exercises
  real `git init` → `createWorktreeIfNeeded` → `removeWorktree`, and asserts BOTH the directory
  is gone AND `git worktree list` no longer shows the path. This is exactly the acceptance
  criterion in the task description. ✓
- Call site at `bin/lib/run.mjs:1521-1524` invokes `removeWorktree(worktreePath, mainCwd)` from
  a `finally` block, so it also runs on the error path. ✓

## Per-criterion (security lens)

| Criterion | Result | Evidence |
|---|---|---|
| Command injection | PASS | `execFileSync("git", [...args])` with arg array — no shell, no string interpolation. |
| Argument injection | PASS | Path arg passed as a single token; flag `--force` is fixed; no user-controlled `--`-prefixed values. |
| Error handling | PASS | `removeWorktree` wraps in try/catch and intentionally swallows (comment: "already gone or not a worktree — not fatal"). Reasonable: the lifecycle goal is best-effort cleanup. |
| Resource leak on failure | PASS | Wrapped in `try { … } finally { if (worktreePath) removeWorktree(...) }` so cleanup runs on thrown errors too. |
| Secrets / sensitive output | PASS | No tokens, env vars, or credentials touched. `stdio: "pipe"` keeps git output out of console. |
| Path traversal in cleanup target | PASS-with-note | `worktreePath` is whatever `createWorktreeIfNeeded` returned in the same run; not directly user-controlled at the cleanup site. See warning below for the upstream slug-as-path concern (pre-existing). |

## Edge cases I actually checked
- removeWorktree on a non-existent path → covered by test "does not throw if git worktree remove fails" (worktree.test.mjs:142).
- exec throwing → covered by "swallows errors (blocked/already-gone path)" (worktree.test.mjs:171).
- Real git lifecycle, not just mocks → covered by the new integration test (worktree.test.mjs:181–215), which is the strongest evidence the acceptance criterion holds.
- Cleanup on thrown error → call site uses `finally`, so even if push or finalize throws the worktree is still removed.

Edge cases I did NOT verify directly:
- Behavior when the worktree directory exists but the git tracking entry is corrupted (no
  `.git` file). `git worktree remove --force` would error; the catch swallows it, leaving a
  stale directory. Worth a backlog item but not a security issue.
- `git worktree prune` is not called after silent failure, so stale tracking entries can
  persist if `--force` removal fails.

## Findings

🟡 bin/lib/run.mjs:178 — `removeWorktree` swallows ALL exec errors silently. If `git worktree remove --force` fails for a reason other than "already gone" (locked worktree, permission issue, corrupted .git file), the failure is invisible and the directory leaks. Consider logging at debug level (e.g. `console.error` to `c.dim`) and/or running `git worktree prune` as a follow-up so the tracking list does not drift. Backlog, not blocker.
🟡 bin/lib/run.mjs:164 — `createWorktreeIfNeeded` joins the raw `slug` into `mainCwd/.team/worktrees/{slug}` without sanitization (only `slugToBranch` sanitizes the branch name). When called from `outer-loop.mjs:859`, `featureName` originates from PRODUCT.md roadmap content, which is trusted-but-mutable. A slug containing `..` segments would let `removeWorktree --force` later target a path outside `.team/worktrees/`. Pre-existing pattern (same risk in `featureDir = join(teamDir, "features", featureName)` elsewhere) and not introduced by this task, but worth tightening: sanitize `slug` for path use the same way `slugToBranch` does.
🔵 bin/lib/run.mjs:1517 — `git push --set-upstream origin HEAD` runs unconditionally before the worktree is removed. Out of scope for this task, but auto-push has its own threat surface (force-push protections, branch protection bypass) — flag for product owners.
🔵 test/worktree.test.mjs:198 — Integration test relies on `realpathSync` to handle macOS `/private/var` symlink. Good defensive coding; consider documenting the macOS quirk in a comment so future maintainers don't strip it.

## Bottom line
The change does what the handshake claims, has direct integration evidence (real-git test), uses safe `execFileSync` with arg arrays, and runs cleanup from a `finally` block. No critical security issues. Two warnings for the backlog (silent error swallowing, raw slug as path component).
