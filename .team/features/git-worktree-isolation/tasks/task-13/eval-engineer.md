# Engineer Review — git-worktree-isolation (task-13 / feature final)

## Overall Verdict: PASS

---

## Files Read

- `bin/lib/run.mjs` (lines 53–182, 286–380, 793–795, 903, 1015–1024, 1202, 1490–1534)
- `bin/lib/gate.mjs` (full file, 189 lines)
- `test/worktree.test.mjs` (full file, 703 lines)
- `.team/features/git-worktree-isolation/tasks/task-12/test-output.txt` (full, 861 lines)
- `.team/PRODUCT.md` (lines 1–65)
- `PLAYBOOK.md` (grepped for worktree section, lines 182–244)
- All 9 `handshake.json` files (tasks 1–6, 11–13)

---

## Per-Criterion Results

### 1. Correctness — `createWorktreeIfNeeded` (run.mjs:163–176)

**PASS**

Slug is sanitized via `slugToBranch` before any path join (run.mjs:164–167). Two guards cover invalid post-sanitization results: empty string check (`!safeSlug`) and all-dots check (`/^\.+$/.test(safeSlug)`). The `existsSync` reuse path avoids redundant `git worktree add` calls. `-B` flag is used (not `-b`) so re-runs on an already-existing branch succeed (run.mjs:173). Path construction is `join(mainCwd, ".team", "worktrees", safeSlug)` — no concatenation, no traversal risk.

Edge case checked: `"../evil"` sanitizes to `"..evil"`, which `path.join` treats as a literal directory name, not a traversal. Confirmed by test-output.txt:829.

Edge case NOT guarded: whitespace-only slug (e.g. `"   "`) sanitizes to `"-"`, which passes both guards and would create `.team/worktrees/-`. Unlikely in practice since `featureName` comes from STATE.json, but is unvalidated.

### 2. Correctness — `removeWorktree` (run.mjs:178–182)

**PASS**

Uses `--force` flag for deterministic removal. Catches all exceptions silently. The comment `/* already gone or not a worktree — not fatal */` is slightly misleading — it also swallows permissions errors and other failures. However, since cleanup is best-effort post-completion, silent failure is acceptable. Confirmed: `removeWorktree` is only called on the success path (run.mjs:1534, after the catch block exits via rethrow).

### 3. Correctness — Error path lifecycle (run.mjs:1015–1534)

**PASS**

Structure verified by direct read:
- `worktreePath` initialized to `null` (run.mjs:1015)
- Worktree creation wrapped in its own try-catch (run.mjs:1019–1024) that produces a clear error message and propagates up
- Main execution wrapped in a separate try-catch (run.mjs:1026–1533): catch logs preservation and rethrows without cleanup
- `removeWorktree` called at run.mjs:1534 — outside the try-catch, only executes when no exception was thrown
- Source-assertion test at test-output.txt:834–837 confirms the `finally` block absence and the catch-rethrow shape

No `finally`-based teardown exists. Confirmed by grep (no `} finally {` + `removeWorktree` pattern). This is correct: preserving the worktree on failure is the specified behavior.

### 4. Correctness — Explicit `cwd` enforcement

**PASS**

All three dispatch paths throw on falsy `cwd`:
- `runGateInline` (run.mjs:54): throws `"cwd is required (no implicit process.cwd() fallback)"`
- `dispatchToAgent` (run.mjs:287): same guard
- `dispatchToAgentAsync` (run.mjs:346): same guard

At run.mjs:1021, `cwd` is reassigned to `worktreePath` immediately after creation. All subsequent `dispatchToAgent(agent, brief, cwd)` and `runGateInline(gateCmd, featureDir, task.id, cwd)` calls at lines 1089, 1169, 1202, 1226, 1414, 1464 use this updated `cwd`.

`gate.mjs:21` fallback: `getFlag(args, "cwd") || process.cwd()`. This is the CLI entry point; agents are spawned with their `cwd` set to `worktreePath` by the orchestrator, so `process.cwd()` inside an agent resolves to the worktree. The fallback is safe for subprocess invocations.

Grep-audit test (test-output.txt:848–852) confirms no `cwd: process.cwd()` literal in dispatch or gate function bodies.

### 5. Code quality

**PASS**

Functions are small and single-purpose (`slugToBranch`, `createWorktreeIfNeeded`, `removeWorktree` are 7, 14, and 5 lines respectively). Injectable `_execFn` / `_spawnFn` parameters make all three functions unit-testable without spawning real processes. No unnecessary allocations. No n+1 patterns. The concurrent worktree creation has no shared mutable state (each call gets a unique path, and `existsSync`+`execFileSync` are the only side effects), so correctness under concurrency relies on the OS filesystem and git's own locking — appropriate for this use case.

One observation: `detectGateCommand` reads from `mainCwd` (run.mjs:903), not the worktree, so gate command is determined pre-worktree from the main branch. If agents modify `PROJECT.md` in the worktree, that change won't take effect until the next run. This is intentional by design (gate command should be stable), but worth noting.

### 6. Error handling

**PASS**

All error paths in worktree helpers are explicit:
- `createWorktreeIfNeeded`: throws on bad slug (with message), propagates git errors from `execFileSync`
- `removeWorktree`: silences errors (best-effort semantics)
- `runGateInline`: throws on missing `cwd`; catches subprocess errors and normalizes to `exitCode + stderr`
- Outer `_runSingleFeature` catch: logs and rethrows — no silent swallowing of run errors

### 7. Test coverage

**PASS**

703 lines in `test/worktree.test.mjs` covering:
- `slugToBranch`: 6 cases including caps, dots, underscore/space conversion
- `createWorktreeIfNeeded`: mock tests for path computation, `-B` flag, reuse; real-git integration; concurrent same-slug and different-slug races with real child processes; path-traversal guard; empty/all-dots slug rejection
- `removeWorktree`: mock and real-git lifecycle tests
- `runGateInline`: cwd injection, PASS/FAIL verdicts
- `dispatchToAgent` / `dispatchToAgentAsync`: cwd forwarding for both claude and codex; required-cwd contract
- Source-assertion tests locking in structural invariants (no finally teardown, catch-rethrow shape, source-level wiring)
- PLAYBOOK.md documentation contract (8 assertions)
- Grep-audit: no `process.cwd()` in dispatch/gate bodies

test-output.txt confirms: 566 pass / 0 fail / 2 skip (2 skips are pre-existing in synthesize-compound suite, unrelated to this feature).

### 8. PRODUCT.md update (task-13)

**PASS**

`.team/PRODUCT.md:58`: Entry #20 reads `✅ Done` in place of `*(Deferred)*`. Text accurately describes the implementation: worktree+branch per feature, cwd injection, create/cleanup lifecycle.

---

## Findings

🔵 `bin/lib/run.mjs:155` — `slugToBranch` has no non-string guard; `null.toLowerCase()` would throw a TypeError caught upstream as a generic "Cannot create worktree" error. Add `String(slug)` coercion or an early type check for a clearer error message.

🔵 `bin/lib/run.mjs:155–160` — Whitespace-only slug `"   "` sanitizes to `"-"` which passes both guards and would create `.team/worktrees/-`. Consider rejecting slugs that sanitize to a lone hyphen or add a third guard `if (/^-+$/.test(safeSlug))`.

🔵 `bin/lib/run.mjs:181` — `removeWorktree` comment says "already gone or not a worktree" but catches all exceptions including permissions failures. Consider logging at debug level when the error is NOT an "already gone" variant, to surface stale-worktree issues without failing the run.

---

## Summary

All implementation claims from handshakes 1–6, 11–13 were verified against the source and test evidence. The core worktree-isolation design is correct: sanitized slugs prevent traversal, `cwd` is explicitly injected and guarded in every dispatch path, and the error-path lifecycle (preserve on failure, remove on success) is implemented correctly with source-level tests locking in the structural invariant. Three blue suggestions are noted; none affect correctness or block merge.
