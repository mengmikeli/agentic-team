# Eval: Pass uses full `git diff main..HEAD` (not per-task)

## Overall Verdict: PASS

---

## Criterion 1: Core correctness — full branch diff, not per-task

**PASS**

`runSimplifyPass` (simplify-pass.mjs:89-102) computes the merge-base with `git merge-base HEAD ${branch}`, tries `main` first then falls back to `master`. The resulting SHA is stored in `base` and passed directly to `getChangedFiles` (line 104). `getChangedFiles` (line 47) builds the command `git diff --name-only ${base}..HEAD`, which spans the full feature branch from its divergence point from main — not any per-task range. This matches the spec exactly.

Evidence path verified:
- `runSimplifyPass` line 90-98: merge-base loop
- `getChangedFiles` line 47: `${base}..HEAD` range
- These are the only calls that could produce the file list used for the simplify brief

---

## Criterion 2: main → master fallback

**PASS**

The loop `for (const branch of ["main", "master"])` (line 90) catches exceptions from `git merge-base HEAD main` and continues to try `master`. If both fail, returns `{ skipped: true, reason: "could not determine merge-base" }` (line 101). Test at simplify-pass.test.mjs:405-426 verifies this path explicitly and checks both dispatch and file-list contents.

---

## Criterion 3: Test coverage for the new behavior

**PASS**

Three new tests added under `"runSimplifyPass — full branch diff (not per-task)"` (lines 355-427):
1. `computes merge-base against main branch` — captures all commands and verifies one contains `merge-base` and references `main` or `master`
2. `uses merge-base SHA as diff range start` — captures the first `--name-only` command and asserts it contains `abc123feature..HEAD`
3. `falls back to master when main is unavailable` — throws on `merge-base ... main`, succeeds on `master`, verifies dispatch is called with correct file list

All three are behavioral (not source-text searches), testing the actual execution path.

---

## Criterion 4: run.mjs integration

**PASS**

`run.mjs:1503` guard `completed > 0 && blocked === 0` correctly gates the pass. `runSimplifyPass` is called at line 1507 without an `execFn` override (correct — uses real `execSync` in production). The integration test at simplify-pass.test.mjs:431-467 verifies import, call ordering, gateCmd/cwd presence, and the guard condition via source-text regex.

---

## Criterion 5: Error handling / edge cases

**PASS (with minor note)**

- Empty file list returns early (line 105-107)
- `git rev-parse HEAD` failure returns skipped (lines 117-119)
- `dispatchFn` failure returns without gating (line 124-126)
- Gate exception is caught and treated as FAIL (line 168-169), triggering revert
- Revert failures are silently swallowed as best-effort (line 195)

---

## Criterion 6: Security (shell interpolation)

**PASS with warnings**

`base` (from `git merge-base` output) is interpolated directly into shell command strings at lines 47 and 178. `Node.js execSync` with a string argument routes through `/bin/sh -c`, making any shell metacharacters in `base` executable. In practice `base` is always a 40-char hex SHA — safe. However `getChangedFiles` is a named export and accepts `base` as a caller-supplied parameter with no validation, creating a latent injection surface.

`preSha` (from `git rev-parse HEAD`) is interpolated into `git reset --hard ${preSha}` (line 178) under the same constraint.

`gateCmd` is passed to `runGateInline → execSync(cmd)`, but this is intentional: the gate command is a developer-configured shell command from `.team/PROJECT.md`. No finding.

These are flagged as warnings — not blocking — due to the controlled internal context.

---

## Files Actually Read

- `bin/lib/simplify-pass.mjs` (lines 1-198)
- `test/simplify-pass.test.mjs` (lines 1-468)
- `bin/lib/run.mjs` (integration context: merge-base call, `runGateInline`, guard condition)
- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`
- `.team/features/self-simplification-pass/tasks/task-2/handshake.json`

---

## Actionable Feedback

No blocking issues. Two items for the backlog:

🟡 `bin/lib/simplify-pass.mjs:47` — `base` interpolated into shell string without validation; add `/^[0-9a-f]{7,40}$/i` guard before use to harden the exported `getChangedFiles` API

🟡 `bin/lib/simplify-pass.mjs:178` — `preSha` interpolated into `git reset --hard ${preSha}` without format check; same SHA regex guard applies

---

# Architect Review — self-simplification-pass / task-2

**Verdict: PASS**
**Reviewer role:** Architect
**Date:** 2026-04-26

## Files Actually Read

- `test/simplify-pass.test.mjs` (468 lines) — full read
- `bin/lib/simplify-pass.mjs` (198 lines) — full read; focused on lines 83–107
- `.team/features/self-simplification-pass/tasks/task-2/handshake.json`
- `.team/features/self-simplification-pass/tasks/task-1/eval.md` (all prior reviews)

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Removed `let revParseCount = 0;` | ✓ | test:154–175 read in full; line 155 is `const dispatches = [];` |
| Added "computes merge-base against main branch" test | ✓ | test:355–379 |
| Added "uses merge-base SHA as diff range start" test | ✓ | test:381–403 |
| Added "falls back to master when main is unavailable" test | ✓ | test:405–426 |

## Per-Criterion Results

### Module boundary — PASS

Task-2 modifies only `test/simplify-pass.test.mjs`. No production code changed. Correct scope: the production implementation of merge-base detection (`simplify-pass.mjs:89–102`) was already correct from task-1. Task-2 adds test coverage to lock in the behavioral contract.

### Full-branch diff architecture — PASS

`git merge-base HEAD main` is the canonical anchor for "all commits since branch point." Using `${base}..HEAD` in `git diff --name-only` spans the full feature branch, not any per-task window. Architecture confirmed correct by reading simplify-pass.mjs:89–107 directly.

### Test quality — PASS

- Test 2 (line 381) is the strongest: it captures the actual diff command issued and asserts the merge-base SHA appears as the range start. This is the definitive proof that full-branch range is used.
- Test 3 (line 405) fills prior **Gap C** (master fallback, flagged 🔵 across three Tester reviews). Now addressed.
- Test 1 (line 355) proves `merge-base` is called against `main`/`master`, not an arbitrary SHA.

### Coupling — PASS

No new imports or module dependencies. No changes to `run.mjs` or `simplify-pass.mjs`. No coupling regression.

## Findings

🟡 test/simplify-pass.test.mjs:288 — The "reverts uncommitted changes" test captures only `checkout HEAD` commands; `git clean -fd` (simplify-pass.mjs:189–193) is not captured and the mock silently returns `""`. Deleting those 5 lines leaves all tests green. Carried from Tester/PM/Architect run_3. Assign to backlog.

🟡 bin/lib/run.mjs:1578 — `phaseOrder` hardcodes `["brainstorm", "build", "review"]` at lines 1578 and 1604; `"simplify"` absent despite `setUsageContext("simplify", null)` at line 1506. Simplify-pass token cost invisible to operators. Carried through 4+ review passes. Assign to backlog.

🔵 bin/lib/simplify-pass.mjs:111 — Pre-dispatch `rev-parse HEAD` failure early-return (lines 117–119) still untested. Carried from Tester reviews as Gap D.

🔵 test/simplify-pass.test.mjs:23 — `.sh`/`.bash` extensions in `CODE_EXT` have no `isCodeFile` assertions. Carried as Gap E.

## Summary

Test-only change. All four builder claims verified. Dead variable (`revParseCount`) is gone. Three new tests provide direct behavioral proof that the simplify pass uses full-branch merge-base diff, not a per-task diff. Prior Gap C (master fallback) is now covered. Two carried 🟡 backlog items remain (unasserted `git clean -fd`; missing `"simplify"` in `phaseOrder`) — neither introduced by this task. **PASS.**

---

# PM Review — task-2: Pass uses full `git diff main..HEAD` (not per-task diff)

**Verdict: PASS**
**Reviewer role:** Product Manager
**Date:** 2026-04-26

---

## Files Actually Read

- `.team/features/self-simplification-pass/tasks/task-2/handshake.json`
- `bin/lib/simplify-pass.mjs` (199 lines — full)
- `test/simplify-pass.test.mjs` (469 lines — full)
- `.team/features/self-simplification-pass/tasks/task-1/eval.md` (prior review history)

---

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Removed dead `let revParseCount = 0;` from test | ✓ | Line 156 of test is now `const execFn = ...`; remaining `revParseCount` occurrences (lines 237, 262, 328) are all legitimate call-counters |
| Added test: merge-base references main or master | ✓ | test:356–379 — captures all commands, asserts merge-base cmd `.includes("main") \|\| .includes("master")` |
| Added test: merge-base SHA used as diff range start | ✓ | test:381–403 — captures first `--name-only` command, asserts `abc123feature..HEAD` |
| Added test: master fallback works | ✓ | test:405–427 — throws for `main`, succeeds for `master`, asserts dispatch fires with `src/util.mjs` |

---

## Per-Criterion Results

### 1. Full branch diff via merge-base — PASS

`runSimplifyPass` at lines 88–104 of `simplify-pass.mjs` computes `git merge-base HEAD main|master` to get the feature branch base SHA, then passes it to `getChangedFiles` which runs `git diff --name-only ${base}..HEAD`. No per-task artifact, task directory, or task-specific SHA is referenced in the diff computation. Scope is strictly: all code files changed since the branch diverged from main/master.

### 2. Tests explicitly verify full-branch-diff behavior — PASS

Three new behavioral tests (not source-text searches) directly exercise the execution path:
- `"computes merge-base against main branch"` — locks in that merge-base is called with main or master
- `"uses merge-base SHA as diff range start — full branch, not per-task"` — locks in `<sha>..HEAD` as the diff range
- `"falls back to master when main is unavailable"` — proves the fallback exercises the same full-diff logic

### 3. Dead variable removal — PASS

`let revParseCount = 0;` confirmed absent from the "dispatches agent when code files are changed" test body (lines 154–175). The Simplicity run_3 blocker is resolved.

### 4. Scope discipline — PASS

Task-2 made no changes to `bin/lib/simplify-pass.mjs`. Correctly scoped to: (a) removing the dead variable that blocked task-1 merge, and (b) adding explicit requirement verification tests.

---

## Carried Open Items (not task-2 regressions)

🟡 `test/simplify-pass.test.mjs:288` — `git clean -fd` unasserted in uncommitted-revert test; fix can be silently deleted without any test failing. Carried from Tester run_3.

🟡 `bin/lib/run.mjs:1578` — `phaseOrder` omits `"simplify"`; token costs invisible to operators. Carried from multiple prior reviews.

🟡 `bin/lib/simplify-pass.mjs:62` — Unsanitized filenames in agent prompt; prompt-injection risk with `bypassPermissions`. Carried from Security reviews.

---

## Findings

No findings.

---

## Summary

Task-2 delivered exactly its stated scope: removed the dead `revParseCount` variable that blocked task-1 merge, and added three tests that explicitly verify the full-branch-diff behavior (merge-base against main/master, resulting SHA used as range start, master fallback). All acceptance criteria met. Three carried 🟡 backlog items from task-1 remain open; none are regressions from this task. **PASS.**

---

# Simplicity Review — task-2

**Verdict: PASS**
**Reviewer role:** Simplicity Advocate
**Date:** 2026-04-26

---

## Files Actually Read

- `test/simplify-pass.test.mjs` (469 lines) — full read
- `bin/lib/simplify-pass.mjs` (198 lines) — full read
- `.team/features/self-simplification-pass/tasks/task-2/handshake.json`
- `.team/features/self-simplification-pass/tasks/task-1/eval.md` (prior review history including Simplicity run_3 🔴 finding)

---

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Removed dead `let revParseCount = 0;` | ✓ | Absent from lines 154–176 ("dispatches agent" test body) |
| Added 3 new tests under "full branch diff (not per-task)" | ✓ | test:355–427 |
| master fallback test added | ✓ | test:405–426 |

---

## Per-Criterion Results

### 1. Dead Code — PASS

Prior 🔴 (`let revParseCount = 0;`) is absent. Confirmed by reading the full "dispatches agent when code files are changed" test body (lines 154–176): `execFn` returns hardcoded values; no counter variable declared.

New test variables verified as used:
- `let capturedDiffCmd = ""` (test:383) — read in `execFn` guard and in assertion at test:399. Not dead.
- `const cmds = []` (test:358) — used in `cmds.find(...)` at test:373. Not dead.
- `const dispatches = []` (test:416) — used in assertions at test:424–425. Not dead.

### 2. Premature Abstraction — PASS

No new abstractions. Three new `it()` bodies use inline `execFn` mocks — same pattern as all surrounding tests.

### 3. Unnecessary Indirection — PASS

No new wrappers or delegates introduced.

### 4. Gold-Plating — PASS

No new config options, feature flags, or speculative parameters.

---

## Findings

🔵 test/simplify-pass.test.mjs:460 — Test name "only runs simplify pass when completed > 0" is incomplete; the assertion verifies the full condition `completed > 0 && blocked === 0` — rename to document both clauses

---

## Edge Cases Checked

- `revParseCount` dead variable: absent at lines 154–176 ✓
- `capturedDiffCmd` test (lines 381–403): traced execution — first `--name-only` call is file-discovery (`abc123feature..HEAD`), captured and asserted; second `--name-only` returns `""` (changedCount=0, no gate run); assertion is valid ✓
- master fallback test (lines 405–426): `main` throws → `master` succeeds → files from `masterbase..HEAD` diff appear in brief ✓

---

## Summary

Task-2 removed the prior 🔴 dead variable and added three well-targeted behavioral tests for the full-branch-diff requirement. No veto-level issues in any of the four categories. One 🔵 suggestion on test naming. **PASS.**

---

# Tester Review (final) — self-simplification-pass, task-2

**Verdict: PASS**
**Reviewer role:** Tester (test strategy / coverage)
**Date:** 2026-04-26

## Files Actually Read

- `bin/lib/simplify-pass.mjs` (198 lines — full)
- `test/simplify-pass.test.mjs` (468 lines — full)
- `tasks/task-2/handshake.json`

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Removed dead `let revParseCount = 0;` | ✓ | test:154–175 read fully; line 155 is `const dispatches = [];` |
| Test: merge-base references main or master | ✓ | test:356–379 captures all cmds, asserts merge-base cmd includes "main" or "master" |
| Test: merge-base SHA used as diff range start | ✓ | test:381–403 captures first `--name-only` cmd, asserts `abc123feature..HEAD` |
| Test: master fallback when main unavailable | ✓ | test:405–426 throws on main, succeeds on master, verifies dispatch and file list |

## Test Quality

Three behavioral tests using injectable execFn. The strongest is test:381–403 — it verifies the actual SHA from merge-base is the diff range start, which is the precise claim of the feature. Prior Gap C (master fallback) is now covered.

## Remaining Gap (carried, not introduced here)

🟡 `test/simplify-pass.test.mjs:294` — The uncommitted-revert test still does not assert `git clean -fd`. Fix at simplify-pass.mjs:188–193 is correct in code but not regression-protected by any test. This was explicitly a named fix in task-1 that went unverified by the test suite through both tasks.

## Findings

🟡 `test/simplify-pass.test.mjs:294` — `git clean -fd` at simplify-pass.mjs:188 not captured or asserted in the uncommitted-revert test; the fix can be silently removed without failing any test — capture `clean` commands in the mock and add an assertion (carried from task-1 review, still unresolved in final state)

🔵 `test/simplify-pass.test.mjs:386` — The "uses merge-base SHA as diff range start" test captures the first `--name-only` command via `!capturedDiffCmd`; if another `--name-only` call fires first, the wrong command is silently validated — fragile to call-order changes

🔵 `bin/lib/simplify-pass.mjs:111` — Pre-dispatch `rev-parse HEAD` failure early-return (lines 117–119) untested (carried as Gap D)
