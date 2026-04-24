# Engineer Review: git-worktree-isolation — cwd injection into agent dispatches

**Overall Verdict: FAIL**

---

## Files Read

- `bin/lib/run.mjs` (lines 30–50, 145–175, 275–375, 739–750, 880–950, 1025–1180, 1460–1539)
- `test/worktree.test.mjs` (all 236 lines)
- `.team/features/git-worktree-isolation/tasks/task-1/handshake.json`
- `.team/features/git-worktree-isolation/tasks/task-2/handshake.json`
- git log (10 most recent commits)

---

## Core Claim Verification

**Claim:** `dispatchToAgent` / `dispatchToAgentAsync` forward `cwd: worktreePath` to `spawnSync` / `spawn`.

| Check | Evidence | Result |
|---|---|---|
| `dispatchToAgent` signature | `export function dispatchToAgent(agent, brief, cwd, _spawnFn = spawnSync)` — line 279 | ✓ |
| claude path spawnSync cwd | `_spawnFn("claude", [...], { ..., cwd, ... })` — line 284–290 | ✓ |
| codex path spawnSync cwd | `_spawnFn("codex", [...], { ..., cwd, ... })` — line 307–312 | ✓ |
| async dispatch spawn cwd | `spawn("claude", [...], { cwd, ... })` — line 333–337 | ✓ |
| `_runSingleFeature` sets cwd | `cwd = worktreePath` at line 944; all dispatch calls (1035, 1115, 1172, 1360, 1410) use this `cwd` | ✓ |
| Unit tests for cwd injection | `describe("dispatchToAgent cwd injection")` — lines 192–235: 3 mockSpawn tests | ✓ |
| Gate | `npm test` exit 0 (handshake task-2) | ✓ |

The core feature is correctly implemented and tested.

---

## Criterion Results

### 1. Correctness — FAIL

🔴 `bin/lib/run.mjs:166` — `createWorktreeIfNeeded` uses `git worktree add -b feature/{slug}`. `removeWorktree` (via `git worktree remove --force`) deletes the directory but leaves the branch. Any second run (post-completion or post-pause resume) hits `existsSync(worktreePath) === false` at line 162, re-enters creation, and crashes: `"fatal: A branch named '...' already exists."` This breaks every re-run and every pause+resume. Fix: use `-B` instead of `-b`. This was a 🔴 critical in the task-1 review and is **still unaddressed**.

Reproduction path:
1. `removeWorktree` → `git worktree remove --force <path>` (line 173): directory gone, branch `feature/slug` persists
2. Re-run → `existsSync(worktreePath) === false` (line 162): creation is triggered
3. `git worktree add <path> -b feature/slug` (line 166): git rejects — branch exists

### 2. Code Quality — PASS with warnings

🟡 `test/worktree.test.mjs:65` — Test fixture hard-codes expected `-b` flag. When the `-b`→`-B` fix is applied, this assertion breaks. It currently documents the broken behavior and must be updated atomically with the fix.

🟡 `bin/lib/run.mjs:155` — `slugToBranch` regex `[^a-z0-9\-\.]` strips uppercase without `.toLowerCase()` first: `"MyFeature"` → `"yeature"`. Current callers pre-normalize, so production is safe today, but the exported function is a trap for future callers. Prepend `.toLowerCase()` as first transform.

🔵 `bin/lib/run.mjs:746` — `cwd` is reused for both the main repo path and the worktree path. A separate variable (`execCwd`) at line 944 would make the switch explicit and prevent accidental confusion.

🔵 `test/worktree.test.mjs:176` — `describe("slugToBranch normalization")` never calls `createWorktreeIfNeeded`; both tests invoke `slugToBranch` directly and duplicate the `slugToBranch` suite at line 14. Misleadingly named — rename or replace with a real `createWorktreeIfNeeded` integration test.

### 3. Error Handling — PASS

- `try/finally` at lines 949–1474 guarantees `removeWorktree` runs on any exception, including `return "paused"` at line 1055 (JS `finally` runs on `return`). ✓
- `createWorktreeIfNeeded` failure re-throws (lines 945–947), preventing agents from running against main. ✓
- `removeWorktree` swallows its own errors (line 174) — correct for a cleanup path. ✓
- Auto-commit (line 1155) uses `execFileSync` array args without `shell: true`. ✓

### 4. Test Coverage — PASS with warnings

🟡 `test/worktree.test.mjs` — No test verifies that `_runSingleFeature` wires `worktreePath` as `cwd` through to `dispatchToAgent`. The mock tests on `dispatchToAgent` directly are correct, but a one-line drop of `cwd` from the call site at line 1115 would pass the entire suite. Needs a spy/mock at the `_runSingleFeature` level.

🔵 `test/worktree.test.mjs:158` — cwd assertion checks only `tmpDir.split("/").pop()` (last path segment). Strengthen to full path equality to eliminate false positives from identically-named temp dirs.

🔵 `bin/lib/run.mjs:325` — `dispatchToAgentAsync` forwards `cwd` at line 334 but has no dedicated cwd-injection test. Covered only indirectly through `runParallelReviews`.

---

## Actionable Backlog

| Priority | Location | Action |
|---|---|---|
| **Must fix** | `bin/lib/run.mjs:166` | Change `-b` to `-B` in `git worktree add`; update `test/worktree.test.mjs:65` to expect `-B` |
| Backlog | `test/worktree.test.mjs` | Add spy/mock test: `_runSingleFeature` passes `worktreePath` as `cwd` to `dispatchToAgent` |
| Backlog | `bin/lib/run.mjs:155` | Prepend `.toLowerCase()` to `slugToBranch` transform chain |
| Backlog | `test/worktree.test.mjs:158` | Strengthen cwd assertion to full path equality |

---

## Summary

The cwd injection feature is correctly implemented: `dispatchToAgent` and `dispatchToAgentAsync` both receive and forward the `cwd` parameter, `_runSingleFeature` sets `cwd = worktreePath` before all dispatch calls, and three unit tests verify injection via mockSpawn. The gate passes.

The FAIL is for an unaddressed carry-over critical: `git worktree add -b` crashes on every second run of any feature. This was flagged 🔴 by the engineer role in the task-1 review, was not fixed in the `bba063a` "address all criticals" commit, and is not covered by any test.
