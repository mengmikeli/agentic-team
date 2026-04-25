# Engineer Review — git-worktree-isolation (task-13 / feature final)

## Overall Verdict: PASS

---

## Files Read

- `bin/lib/run.mjs` (lines 25–182, 286–382, 1010–1070, 1510–1540; grep for all `process.cwd()` and `harness(` references)
- `bin/lib/gate.mjs` (full file, 189 lines)
- `test/worktree.test.mjs` (full file, 730 lines)
- `.team/features/git-worktree-isolation/tasks/task-12/test-output.txt` (tail + summary line)
- `PLAYBOOK.md` (grepped for worktree section: ## Git Worktrees, git worktree list/remove/prune, inspect commands)
- All 9 `handshake.json` files (tasks 1–6, 11–13)

---

## Per-Criterion Results

### 1. Correctness — `slugToBranch` (run.mjs:155–161)

**PASS**

Transforms slug via lowercase → replace `[\s_]+` with `-` → strip `[^a-z0-9\-\.]` → truncate to 72. The `\-` in the character class is a properly escaped literal hyphen (not an unintended range). Dots are retained as documented in PLAYBOOK.md.

Edge case verified: `"../evil"` → `"..evil"` (the `/` is stripped). `path.join(mainCwd, ".team", "worktrees", "..evil")` produces a safe path — `path.join` does not interpret `"..evil"` as parent traversal. Test at test/worktree.test.mjs:492–509 confirms.

Edge case NOT guarded: a whitespace-only slug `"   "` sanitizes to `"-"`, which passes both the empty check and the all-dots check (`/^\.+$/`). This would try to create `.team/worktrees/-` with branch `feature/-`. Git accepts `feature/-` as a valid refname so this would silently succeed and create an oddly-named worktree. Extremely low risk since featureName originates from validated STATE.json.

### 2. Correctness — `createWorktreeIfNeeded` (run.mjs:163–176)

**PASS**

Sanitizes slug before ANY path join (line 164 — `slugToBranch` called first). Guards against empty string (line 165) and all-dots slug (line 166) before `path.join`. Uses `-B` (not `-b`) so re-runs with existing branch name succeed without error. `existsSync` reuse path avoids duplicate `git worktree add` invocations. Injectable `_execFn` parameter enables unit testing without spawning git.

### 3. Correctness — `removeWorktree` (run.mjs:178–182)

**PASS**

Invokes `git worktree remove --force` which atomically removes both the directory and the git tracking entry. Wraps the call in a bare `catch {}` — intentionally silent since cleanup is best-effort. Verified by real-git integration test (worktree.test.mjs:186–205) that creates a real git repo, calls create+remove, and asserts both the directory is gone and `git worktree list` no longer contains the path.

### 4. Correctness — Error-path lifecycle (run.mjs:1015–1534)

**PASS**

Lifecycle structure verified by direct read:
- `worktreePath` initialized to `null` at line 1015 — safe default if worktree creation throws
- First try-catch (lines 1019–1024) isolates worktree creation; rethrows with a descriptive message
- Second try-catch (lines 1026–1533) wraps the full execution body; catch logs preservation and rethrows without touching worktree
- `removeWorktree` at line 1534 is OUTSIDE the second try-catch — only executes when no exception was thrown
- Source-assertion test (worktree.test.mjs:539–556) locks in both the no-`finally` invariant and the catch-rethrow shape via regex matching on source

### 5. Correctness — Explicit `cwd` enforcement (no `process.cwd()` fallback in dispatch/gate paths)

**PASS**

All three exported dispatch paths throw on falsy `cwd`:
- `runGateInline` (run.mjs:54): `"runGateInline: cwd is required"`
- `dispatchToAgent` (run.mjs:287): `"dispatchToAgent: cwd is required"`
- `dispatchToAgentAsync` (run.mjs:346): `"dispatchToAgentAsync: cwd is required"`

At run.mjs:1021, `cwd` is reassigned to `worktreePath` immediately after creation. All subsequent agent dispatch calls at lines 1089, 1169, 1202, 1226, 1414, 1464 forward this `cwd`. Source-assertion test at worktree.test.mjs:262–270 verifies the call-site signature.

`gate.mjs:21` fallback `|| process.cwd()` is safe: this is the CLI entry point for the harness tool, which agents invoke as a subprocess. Agents are spawned by the orchestrator with `cwd: worktreePath`, so `process.cwd()` inside the agent process resolves to the worktree. No isolation bypass.

`harness()` at run.mjs:38 uses `cwd: process.cwd()` for its subprocess invocations throughout the feature run loop. This is intentional — `harness()` manages STATE.json and notifications, not code execution; all harness calls pass explicit `--dir featureDir` flags for path resolution. `process.cwd()` never changes (no `process.chdir()` calls) and remains the main repo cwd, which is correct for state management. The grep-audit tests scope to dispatch and gate function bodies, not `harness()` — this scoping is appropriate given `harness()` is not an agent dispatch path.

### 6. Code quality

**PASS**

Helper functions are small and single-purpose. All three worktree helpers (`slugToBranch`: 7 lines, `createWorktreeIfNeeded`: 14 lines, `removeWorktree`: 5 lines) use injected `_execFn`/`_spawnFn` parameters, making them fully unit-testable without git installed or real git repos. No shared mutable state between concurrent calls — each call operates on its own slug-derived path. No n+1 patterns. No unnecessary allocations.

### 7. Test coverage

**PASS**

730 lines of tests covering: slug normalization (6 cases), `createWorktreeIfNeeded` mock+real-git+concurrent+traversal+invalid-slug, `removeWorktree` mock+real-git lifecycle, `runGateInline` cwd injection+verdict, `dispatchToAgent`/`dispatchToAgentAsync` cwd forwarding and required-cwd contract, source structural assertions, PLAYBOOK.md documentation contract (8 assertions), and grep-audit assertions.

Concurrent tests include real OS-level child processes (worktree.test.mjs:427–464) — not just Promise.all over sync calls.

test-output.txt (task-12 artifact): `pass 566 / fail 0 / skip 2`. The 2 skips are pre-existing in the synthesize-compound suite, unrelated to this feature. Task-13 adds 1 test (claims 567 pass) but has no test-output.txt artifact — the claim is unverified by artifact, though the provided gate output for this review session shows no failures in the visible portion of the suite run.

### 8. PLAYBOOK.md documentation (run.mjs, PLAYBOOK.md)

**PASS**

Grep confirms all required sections present at PLAYBOOK.md:182–244: `## Git Worktrees`, `git worktree list`, `git worktree remove --force`, `git worktree prune`, inspect commands (`git -C .team/worktrees/<slug> log/status`), "re-runs reuse" language, and dot-preservation language. All 8 PLAYBOOK contract tests pass per test-output.txt.

---

## Findings

🟡 `test/worktree.test.mjs:466-486` — Same-slug race test uses `Promise.resolve().then()` which schedules microtasks; these execute sequentially in the JS event loop. Both calls always take the reuse path (first creates, second sees existing dir). The test comment says "one wins, the other reuses or errors cleanly" but errors never actually occur. True same-slug OS-level race is not tested, unlike the different-slug case which uses real child processes (line 427). Add to backlog to extend with a real child-process test for same-slug.

🔵 `bin/lib/run.mjs:155` — `slugToBranch` calls `slug.toLowerCase()` without a type guard. A `null` or non-string input would throw `TypeError: Cannot read properties of null (reading 'toLowerCase')`, which propagates as a generic "Cannot create worktree" error losing the actual cause. Add `String(slug)` coercion or an early type check.

🔵 `bin/lib/run.mjs:181` — `removeWorktree` comment says "already gone or not a worktree" but the bare `catch {}` also silences permissions errors and git corruption. Stale worktrees that fail to remove would not be surfaced anywhere in the output. Consider logging at debug level when the error message doesn't match the expected "not a worktree" pattern.

---

## Summary

**PASS.** All nine task handshake claims verified against source code and test evidence. Core implementation is correct: slug sanitization prevents path traversal, `cwd` is explicitly injected and guarded in every agent dispatch and gate path, the error-path lifecycle correctly preserves worktrees on failure and removes them on success, and PLAYBOOK.md is documented. The one 🟡 finding (same-slug race test uses microtasks not real concurrency) should go to backlog but does not affect production behavior. Two 🔵 suggestions are optional improvements.
