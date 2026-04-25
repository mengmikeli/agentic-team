# Engineer Eval — task-6 (concurrent worktree isolation)

## Verdict: PASS

## Evidence

### Files reviewed
- `test/worktree.test.mjs` (full read, 456 lines)
- `bin/lib/run.mjs` lines 160–180 (`createWorktreeIfNeeded`, `removeWorktree`)
- `.team/features/git-worktree-isolation/tasks/task-6/handshake.json`

### Test execution
Ran `node --test test/worktree.test.mjs`: **34/34 tests pass**, 0 fail. The two new concurrent-isolation tests both pass:
- `two concurrent invocations on different features produce two independent worktrees` (95ms) — uses real `git init` + `Promise.all` race + asserts distinct paths, on-disk existence, and presence in `git worktree list`.
- `parent .team/worktrees/ directory is not corrupted by concurrent creation` (135ms) — runs 4 parallel slugs and verifies all paths are unique and exist.

### Spec satisfaction
The handshake claim — "two concurrent `agt run` invocations on different features produce two independent worktrees and do not race on `.team/worktrees/`" — is exercised by:
1. Real-git race in a temp repo (not mocked).
2. Assertions on git's own bookkeeping (`worktree list`) which would catch lockfile or index corruption.
3. Cleanup via `removeWorktree` so the test doesn't leak.

### Edge cases checked
- Same-slug concurrency: NOT covered by these tests, but also not in scope per the task statement ("different features"). The `existsSync` → `git worktree add` pattern in `run.mjs:163-172` has a TOCTOU window if the same slug were raced, but git itself would fail the second `worktree add` (path exists), so it is bounded.
- 4-way parallelism (`f1..f4`) verified in addition to the 2-way case — gives confidence in the underlying git lockfile handling.

## Findings

🔵 bin/lib/run.mjs:166 — `existsSync` → `git worktree add` is TOCTOU-racy for *same* slug (out of scope for this task, but worth a backlog note if same-slug re-entry is ever supported).
🔵 test/worktree.test.mjs:392-393 — Cleanup `removeWorktree` calls outside a try/finally; if assertions above them fail, the temp repo `rmSync` in `afterEach` still runs but git's `.git/worktrees/<name>` admin entries leak briefly. Not a real problem since `repoDir` is fully removed.

No 🔴 or 🟡 findings.

---

# Architect Eval — task-6

## Verdict: PASS

## Per-Criterion

| Criterion | Result | Evidence |
|---|---|---|
| Test exists for the claim | PASS | `test/worktree.test.mjs:370-394` and `:396-411` |
| Test uses real git (not mocks) | PASS | `execFileSync("git", ["init", ...])` in beforeEach `:360-363` |
| Verifies independence | PASS | `assert.notEqual(pathA, pathB)` + per-path `existsSync` |
| Verifies no `.team/worktrees/` race | PASS | Asserts both entries appear in `git worktree list` post-race |
| Tests pass | PASS | Local `node --test test/worktree.test.mjs`: 34 pass, 0 fail |

## Architectural Review

- `createWorktreeIfNeeded` (`bin/lib/run.mjs:163`) is appropriately thin: existsSync check, then `git worktree add -B`. The reuse-on-exists branch is the right boundary for crash-recovery and re-entry.
- The concurrency claim is exercised at the **git level**, not just JS path math — correct boundary for the test.
- Dependency injection via `_execFn` parameter is consistent across `createWorktreeIfNeeded` / `removeWorktree` / `dispatchToAgent` / `runGateInline`. No new abstractions or shared state introduced — good.
- No new dependencies; no module boundary changes; scales linearly with feature count (each slug → its own path → its own git worktree entry).

## Files Read
- `.team/features/git-worktree-isolation/tasks/task-6/handshake.json`
- `test/worktree.test.mjs` (full)
- `bin/lib/run.mjs:155-179` plus grep of call sites at `:1016`, `:1523`

## Findings

🔵 bin/lib/run.mjs:170 — `git worktree add` creates `.team/worktrees/` implicitly today; if a future caller needs the parent dir before git runs, an explicit `mkdirSync(dirname(worktreePath), { recursive: true })` would make the contract obvious. Not required now.
🔵 test/worktree.test.mjs:396 — 4-slug parallel test is a good stress nudge; consider 8–16 in a follow-up if real concurrency expands.

No 🔴 or 🟡 findings.
