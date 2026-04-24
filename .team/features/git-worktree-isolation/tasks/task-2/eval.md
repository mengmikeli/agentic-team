## Parallel Review Findings

🔴 [tester] `test/worktree.test.mjs` — No integration test verifies `_runSingleFeature` calls `dispatchToAgent` with `worktreePath`; add a mock-based test that intercepts the dispatch call and asserts the third argument equals the expected worktree path
[simplicity] No 🔴 findings in the four veto categories. The core claim is verified.
[simplicity] **Claim verified:** `cwd = worktreePath` (line 944) → `dispatchToAgent(..., cwd)` (line 1114) → `spawnSync`/`spawn` options `{ cwd }` (lines 286, 309, 334). Gate passed (exit 0, 644/644 tests). No 🔴 veto triggers.
🟡 [architect] `bin/lib/run.mjs:1114` — No mock-based test for `dispatchToAgent` verifying that `spawnSync`/`spawn` receives `worktreePath`; the task's core claim is unverified by automated test — add injection test using same mockExec pattern as `createWorktreeIfNeeded`
🟡 [architect] `bin/lib/run.mjs:1154` — `execSync("git add -A", { cwd, shell: true })` uses `shell: true` for the auto-commit staging; inconsistent with the `execFileSync` pattern introduced in `bba063a` to fix the same class of issue — switch to `execFileSync("git", ["add", "-A"], { cwd })`
🟡 [engineer] `bin/lib/run.mjs:1114` — No mock-based test for `dispatchToAgent` verifying `spawnSync`/`spawn` receives `worktreePath`; add test asserting `cwd === expectedWorktreePath` (same injection pattern as `createWorktreeIfNeeded` mock)
🟡 [engineer] `bin/lib/run.mjs:941` — No `try/finally` around task execution body (lines 941–1471); uncaught exception after worktree creation permanently leaks the directory and `feature/{slug}` branch; wrap with `try/finally { if (worktreePath) removeWorktree(worktreePath, mainCwd); }`
🟡 [engineer] `test/worktree.test.mjs:176` — `createWorktreeIfNeeded branch naming` describe block calls only `slugToBranch`, not `createWorktreeIfNeeded`; misleadingly named and duplicates existing `slugToBranch` coverage
🟡 [product] `test/worktree.test.mjs:10` — `dispatchToAgent` is not imported and has no test asserting `cwd` is forwarded to `spawnSync`/`spawn`; a one-line change that drops `cwd` from the options object would pass the entire suite; file to task-10 backlog
🟡 [tester] `bin/lib/run.mjs:1470` — `removeWorktree` only runs on normal completion; wrap the task loop in `try/finally` to guarantee cleanup on thrown exceptions, preventing orphaned worktrees
🟡 [tester] `bin/lib/run.mjs:37` — `harness()` hardcodes `cwd: process.cwd()` instead of `mainCwd`; harmless today because all `--dir` args are absolute, but inconsistent with the worktree isolation intent and unguarded for future relative-path use
🟡 [security] `bin/lib/run.mjs:1154` — `git add -A` with `shell: true` stages **everything** the `bypassPermissions` agent wrote to the worktree — including any `.env`, credentials, or git-hook overrides. Scope staging to declared handshake artifacts, or add a pre-stage filter for sensitive filename patterns.
🟡 [security] `bin/lib/run.mjs:162-166` — `createWorktreeIfNeeded` uses `-b`; on second run the directory is gone but the branch persists, so git fails: "A branch named '...' already exists." Use `-B` or detect the existing branch. Orphaned branches also leak feature-in-progress git history.
🟡 [security] `bin/lib/run.mjs:943-1473` — No `try/finally` around worktree lifecycle; any uncaught exception between creation (line 943) and cleanup (~line 1473) permanently orphans the directory and `feature/{slug}` branch; wrap with `try/finally { if (worktreePath) removeWorktree(worktreePath, mainCwd); }`
🟡 [security] `bin/lib/run.mjs:1054` — `return "paused"` exits without calling `removeWorktree`; worktree lifecycle on pause is undefined and untested; either document intentional preservation with resume-path tests, or call `removeWorktree` before returning.
[security] The four 🟡 findings are all carry-overs from the task-1 parallel review that remain unaddressed. They belong in the backlog.
🟡 [simplicity] `test/worktree.test.mjs:176` — `describe("createWorktreeIfNeeded branch naming")` never calls `createWorktreeIfNeeded`; both tests (lines 177–181, 183–187) only invoke `slugToBranch` directly, duplicating coverage from the `slugToBranch` suite at line 14; misleadingly named block adds cognitive load without adding signal — remove or replace with a real `createWorktreeIfNeeded` integration test
🟡 [simplicity] `bin/lib/run.mjs:152` — `slugToBranch` has 1 production call site (line 161); the 4-line transform is inlineable into `createWorktreeIfNeeded` with no readability cost; dedicated export adds surface area for marginal gain
🟡 [simplicity] `bin/lib/run.mjs:941` — No `try/finally` around task execution body (lines 947–1470); `removeWorktree` at line 1471 only runs on normal exit; any unhandled exception after worktree creation permanently leaks the directory — carryover from task-1 eval, still unaddressed; fix: `try/finally { if (worktreePath) removeWorktree(worktreePath, mainCwd); }`
🔵 [architect] `bin/lib/run.mjs:37` — `harness()` hardcodes `cwd: process.cwd()` instead of explicit `mainCwd`; harmless today but fragile if cwd ever drifts
🔵 [architect] `bin/lib/run.mjs:746` — `cwd` variable is reused for both `mainCwd` and `worktreePath`; a separate `execCwd` variable would make the transition explicit
🔵 [architect] `bin/lib/run.mjs:838` — `detectGateCommand(mainCwd)` reads from main repo while gate runs in `worktreePath`; harmless (worktree mirrors main), but could diverge if a task modifies build files
🔵 [engineer] `test/worktree.test.mjs:158` — cwd assertion checks only the last path component (`tmpDir.split("/").pop()`); use full path equality to prevent false positives from identically-named temp directories
🔵 [tester] `test/worktree.test.mjs:158` — Assertion uses `tmpDir.split("/").pop()` (last path segment only); strengthen to `assert.equal(result.stdout.trim(), tmpDir)` to eliminate false positives from path collisions
🔵 [tester] `bin/lib/run.mjs:325` — `dispatchToAgentAsync` receives and forwards `cwd` (line 334) but has no dedicated cwd-injection test; covered only indirectly through `runParallelReviews`
🔵 [security] `bin/lib/run.mjs:284` — No `"--"` separator before `brief` in the `claude` argv array; add `"--"` before `brief` as defense against future edge cases where brief text starts with `--`.

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs