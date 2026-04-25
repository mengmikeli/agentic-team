# Tester Evaluation — task-13 (PRODUCT.md roadmap update)

**Role:** Tester
**Date:** 2026-04-25
**Overall Verdict:** PASS (flagged)

---

## Files Opened and Read

- `.team/features/git-worktree-isolation/tasks/task-13/handshake.json`
- `.team/features/git-worktree-isolation/tasks/task-12/handshake.json`
- `.team/features/git-worktree-isolation/tasks/task-12/test-output.txt`
- `.team/features/git-worktree-isolation/tasks/task-11/handshake.json`
- `.team/features/git-worktree-isolation/tasks/task-6/handshake.json`
- `.team/PRODUCT.md`
- `test/worktree.test.mjs`
- `bin/lib/run.mjs`
- `bin/lib/gate.mjs`

---

## What the Builder Claimed (task-13)

Updated `.team/PRODUCT.md` roadmap entry #20 from `*(Deferred)*` to `✅ Done`. All 566 tests pass.

---

## Evidence Verification

### Claim: PRODUCT.md entry #20 marked Done
**CONFIRMED.** Read `PRODUCT.md` line 58: `20. **Git worktree isolation** — ... ✅ Done`
The roadmap text accurately describes the implemented feature.

### Claim: 566 tests pass
**CONFIRMED.** `test-output.txt` (task-12) shows `ℹ pass 566 / ℹ fail 0 / ℹ skipped 2`. Gate output in the prompt header matches.

---

## Per-Criterion Results

### 1. Core isolation contract — cwd injected into all dispatch paths
**PASS with caveat.**
- `dispatchToAgent` (run.mjs:287): `if (!cwd) throw` guard present ✓
- `dispatchToAgentAsync` (run.mjs:346): same guard ✓
- `runGateInline` (run.mjs:54): same guard ✓
- `_runSingleFeature` (run.mjs:1020-1021): `createWorktreeIfNeeded` + `cwd = worktreePath` ✓
- Gate call at run.mjs:1202: `runGateInline(gateCmd, featureDir, task.id, cwd)` passes worktreePath ✓

### 2. Worktree lifecycle (create/cleanup)
**PASS.**
- run.mjs:1013-1024: worktree created before task dispatch ✓
- run.mjs:1526-1534: worktree removed after success, preserved on error ✓
- Catch block (run.mjs:1528-1533): logs "preserving worktree for retry" and rethrows ✓

### 3. Slug sanitization / path traversal
**PASS.**
- `slugToBranch` strips `/` chars; `..` reduces to `.` which triggers all-dots guard ✓
- Tests at worktree.test.mjs:511-533 cover `../evil`, all-dots, empty slugs ✓

### 4. Concurrent safety
**PASS.**
- Two real child-process OS-level race test (worktree.test.mjs:427-464) passes ✓
- Same-slug race with no-corruption assertion (worktree.test.mjs:466-486) passes ✓

### 5. PLAYBOOK.md documentation
**PASS.** All 8 documentation contract tests pass, including Inspect subsection (log, status).

### 6. gate.mjs process.cwd() audit
**FAIL (gap in test).**
- gate.mjs:21: `const cwd = getFlag(args, "cwd") || process.cwd()` — implicit fallback present
- The grep audit test (worktree.test.mjs:648-655) only matches the pattern `cwd\s*:\s*process\.cwd\s*\(\)` (key-value form), which is NOT the pattern used here (`|| process.cwd()`). The test passes while the code still has a silent process.cwd() fallback.
- Mitigated at runtime because `_runSingleFeature` calls `runGateInline` (bypassing gate.mjs subprocess), but the test gives false confidence.

### 7. Builder handshake paths in worktree context
**GAP — not tested.**
- Agent brief (run.mjs:495) instructs: `Write it to: .team/features/${featureName}/tasks/${task.id}/handshake.json` (relative path)
- Agent runs with `cwd = worktreePath` → writes to `worktreePath/.team/features/.../handshake.json`
- Harness validator (run.mjs:1185) reads from `featureDir = join(mainCwd, ".team", "features", featureName)` → different directory
- On success, `removeWorktree` deletes the entire worktree including any agent-written artifacts
- Net effect: builder handshake validation at run.mjs:1186 (`if (existsSync(...))`) silently skips — the `existsSync` returns false, no validation occurs
- No test covers this path; existing e2e tests don't use actual worktrees

### 8. dispatchToAgentAsync codex support
**GAP — not tested.**
- run.mjs:348-350: `if (agent !== "claude") { resolve({ ok: false, ... }); return; }`
- `runParallelReviews` calls `dispatchToAgentAsync` for all roles (run.mjs:377)
- If `findAgent()` returns `"codex"`, all parallel reviews silently return `ok:false`
- No test for this codex + parallel-review combination

---

## Findings

🟡 `bin/lib/gate.mjs:21` — `|| process.cwd()` fallback is not caught by the grep audit test regex (which only matches `cwd: process.cwd()`); add a second assertion matching `\|\|\s*process\.cwd\(\)` to the audit suite

🟡 `bin/lib/run.mjs:1185` — Builder handshake written by agent into worktree (`worktreePath/.team/...`) is never found by the validator which reads from `mainCwd/.team/...`; agent brief should use an absolute path or point agent to a shared artifact dir; add a test that verifies handshake written to worktreePath IS discoverable by the harness

🟡 `test/worktree.test.mjs:539` — "Worktree preserved on error" tests are source-regex assertions; a valid refactor of the catch block (e.g., different variable name) would silently break the behavior without failing the test; replace with an integration test that actually throws during a simulated run

🟡 `bin/lib/run.mjs:345` — `dispatchToAgentAsync` returns `ok:false` for any agent other than `"claude"`; `runParallelReviews` calls this for all roles; if the discovered agent is `"codex"`, all parallel reviews silently fail with no error surfaced; add a test and a warning log

🔵 `test/worktree.test.mjs` — No test for branch orphaning: after `removeWorktree --force`, the `feature/{slug}` branch still exists in the main repo; add a test that verifies `git branch` no longer lists the branch (or document that orphaned branches are expected)

🔵 `test/worktree.test.mjs` — No isolation contract test: verify that a file written to `worktreePath/some-file.txt` does NOT appear at `mainCwd/some-file.txt`; this is the core invariant of the feature and it is untested at the behavior level

🔵 `test/worktree.test.mjs:15` — `slugToBranch` does not test leading/trailing hyphens (`"-foo"`, `"foo-"`) or consecutive hyphens (`"a--b"`); git accepts these but they look odd in branch names

---

## Summary

The core isolation mechanism works: `cwd = worktreePath` is correctly threaded into agent dispatch and gate execution, and the slug sanitization + concurrent safety tests are solid. 566/568 tests pass with 2 known-skipped fabricated-refs tests.

The four yellow findings represent gaps that warrant backlog entries:
1. The gate.mjs audit test gives false confidence (pattern mismatch)
2. Builder handshake artifacts are silently lost when worktrees are used
3. Worktree-preservation behavior relies on brittle source assertions
4. Codex + parallel reviews silently fails

None of these block the isolation guarantee itself — agents and gates do run in isolated worktrees as claimed. The PRODUCT.md update (task-13) is accurate.

**Verdict: PASS** — core feature works, yellow items to backlog.
