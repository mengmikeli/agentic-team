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

# PM Review (final) — self-simplification-pass / task-2

**Verdict: PASS**
**Reviewer role:** Product Manager
**Date:** 2026-04-26

---

## Files Actually Opened and Read

- `bin/lib/simplify-pass.mjs` (198 lines — full read)
- `test/simplify-pass.test.mjs` (469 lines — full read)
- `bin/lib/run.mjs` (lines 1500–1530, plus grep for `phaseOrder`, `runSimplifyPass`, `gateCmd`)
- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`
- `.team/features/self-simplification-pass/tasks/task-2/handshake.json`
- `.team/features/self-simplification-pass/tasks/task-2/eval.md` (all prior reviews)

---

## Requirement: "Pass uses full `git diff main..HEAD` (or the feature branch base), not a per-task diff"

### Criterion 1: Full branch diff via merge-base — PASS

`simplify-pass.mjs:89–102` runs `git merge-base HEAD main` (falls back to `master`), stores the result as `base`, then passes it to `getChangedFiles` at line 104. `getChangedFiles` at line 47 builds `git diff --name-only ${base}..HEAD` — spanning all commits since the branch diverged from main/master. No per-task SHA, task directory, or task-scoped range appears anywhere in this path.

### Criterion 2: Tests explicitly verify the full-branch diff behavior — PASS

Three behavioral tests at `test/simplify-pass.test.mjs:357–427` exercise the execution path directly:
- `"computes merge-base against main branch"` (line 357) — captures all commands, asserts merge-base references `main` or `master`
- `"uses merge-base SHA as diff range start — full branch, not per-task"` (line 383) — captures the `--name-only` diff command, asserts `abc123feature..HEAD`
- `"falls back to master when main is unavailable"` (line 407) — throws on `main`, succeeds on `master`, verifies dispatch fires with correct files

These are behavioral tests (not source-text searches), exercising the actual call path.

### Criterion 3: git clean -fd on uncommitted-change revert — PASS

**Correction to stale Tester "final" review in this file:** The Tester review (page 298–334 of this eval.md) states `git clean -fd` is "not captured or asserted." That review reflects an intermediate state. The current code at `test/simplify-pass.test.mjs:295` captures clean commands in `revertCmds`, and `line 307` asserts `revertCmds.some(c => c.includes("clean"))`. The fix is present and tested. The git log commit `9a171da test: assert git clean -fd in uncommitted-revert test` confirms this.

### Criterion 4: Integration guard — PASS

`run.mjs:1503` gate `completed > 0 && blocked === 0` is in place. `runSimplifyPass` is called at line 1507 before `harness("finalize")` (verified: `runSimplifyPass` call at line 1507 precedes finalize section at line 1528). Parameters `featureDir`, `gateCmd`, `cwd`, `agent` all passed.

---

## Carried Backlog Items (not introduced by this feature)

🟡 `bin/lib/run.mjs:1578` — `phaseOrder` hardcodes `["brainstorm", "build", "review"]`; `"simplify"` is absent despite `setUsageContext("simplify", null)` at line 1506. Simplify-pass token costs are invisible to operators in the phase breakdown. File as backlog: add `"simplify"` to `phaseOrder` and handle it in the breakdown loop.

🟡 `bin/lib/simplify-pass.mjs:47` — `base` (from `git merge-base` stdout) interpolated directly into shell string. Safe in practice (always a hex SHA), but `getChangedFiles` is a named export accepting caller-supplied `base` with no format guard. Latent injection surface. Backlog: add `/^[0-9a-f]{7,40}$/i` validation.

🟡 `bin/lib/simplify-pass.mjs:62` — Filenames from `git diff --name-only` interpolated into agent prompt without sanitization. A repo with adversarially named files could inject content into the simplify brief. Elevated risk when `bypassPermissions` is active. Backlog: sanitize or quote filenames before prompt insertion.

---

## Findings

No findings for this task's deliverables. All three carried 🟡 items above are pre-existing and explicitly not regressions introduced here.

---

## Summary

The stated requirement — "Pass uses full `git diff main..HEAD` (or the feature branch base), not a per-task diff" — is fully implemented and verified. The merge-base detection correctly anchors the diff to the feature branch divergence point. Three behavioral tests lock in the contract. The Tester "final" review in this eval.md contains a stale finding about `git clean -fd` being unasserted; that finding is resolved in the current committed code. Three 🟡 backlog items carried from prior reviews remain open; none are regressions from this task. **PASS.**

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

---

# Architect Review — self-simplification-pass / task-2 (final)

**Verdict: PASS**
**Reviewer role:** Architect
**Date:** 2026-04-26

## Files Actually Read

- `bin/lib/simplify-pass.mjs` (198 lines — full)
- `test/simplify-pass.test.mjs` (469 lines — full)
- `bin/lib/run.mjs` (lines 1501–1530, 1573–1608, and import at line 26)
- `.team/features/self-simplification-pass/tasks/task-2/handshake.json`
- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| `runSimplifyPass` uses `git merge-base HEAD main\|master` | ✓ | simplify-pass.mjs:90–98 — for loop over ["main","master"], break on first success |
| Merge-base SHA passed as `base` to `getChangedFiles` | ✓ | simplify-pass.mjs:104 — `getChangedFiles(base, cwd, execFn)` |
| `getChangedFiles` runs `git diff --name-only ${base}..HEAD` | ✓ | simplify-pass.mjs:47 — exact command string |
| `git clean -fd` captured and asserted in uncommitted-revert test | ✓ | test:294–295 captures; test:307 asserts `.some(c => c.includes("clean"))` |
| Dead `let revParseCount = 0;` removed | ✓ | test:154–175 read in full; absent |

## Per-Criterion Results

### Module boundary — PASS

`simplify-pass.mjs` is a self-contained module with clean exports (`isCodeFile`, `getChangedFiles`, `buildSimplifyBrief`, `runSimplifyPass`). `run.mjs` imports only `runSimplifyPass`. No circular dependencies, no shared mutable state outside the injection pattern. Appropriate separation.

### Dependency injection pattern — PASS

`execFn`, `dispatchFn`, `runGateFn` are all injectable with production defaults. This is the correct pattern for a module with external side-effects. Tests confirm the pattern holds under all exercised paths.

### Full-branch-diff architecture — PASS

`git merge-base HEAD main` is the canonical way to anchor "all commits since branch point." The resulting SHA is used as `${base}..HEAD` in git diff — this is a full-branch range, not per-task. The approach is correct, git-idiomatic, and does not require any per-task state tracking.

### Error handling boundaries — PASS

All failure paths (merge-base unavailable, rev-parse failure, dispatch failure, gate failure, revert failure) return structured results rather than throwing. The caller (`run.mjs:1503–1526`) wraps in try/catch. Appropriate defensive design.

### Stale Tester finding in eval.md — NOTE

The Tester's "final" review appended to this eval.md (lines 298–334) claims `git clean -fd` is unasserted. This finding is **stale** — task-2 run_2 added the capture at test:294–295 and assertion at test:307. The Tester review was written before that fix landed. No code action needed; the production and test code are correct.

## Findings

🟡 bin/lib/simplify-pass.mjs:47 — `base` (merge-base SHA) interpolated into shell string without SHA format validation; `getChangedFiles` is a public export and accepts arbitrary caller-supplied `base` — add `/^[0-9a-f]{7,40}$/i` guard to harden the API surface (carried)

🟡 bin/lib/run.mjs:1578 — `phaseOrder` hardcodes `["brainstorm", "build", "review"]` and omits `"simplify"`; `setUsageContext("simplify", null)` at line 1506 sets the context but costs never surface in console breakdown (lines 1580–1584) or progress log summary (line 1603); simplify-pass dispatch cost is invisible to operators (carried)

🔵 test/simplify-pass.test.mjs:386 — "uses merge-base SHA as diff range start" test captures the first `--name-only` command via `!capturedDiffCmd` guard; silently validates wrong command if call order changes — use a more specific cmd match instead (carried)

🔵 bin/lib/simplify-pass.mjs:111 — `rev-parse HEAD` failure early-return (lines 117–119) has no test coverage; deleting those 3 lines does not fail any test (Gap D, carried)

## Summary

Core architecture is sound. The merge-base approach is the correct abstraction for full-branch diff. Module boundaries, injection pattern, and error handling are all appropriate. Two carried 🟡 items require backlog entries: shell interpolation hardening on the `getChangedFiles` export, and missing `"simplify"` in `phaseOrder` causing operator cost blindspot. Neither was introduced by this task. **PASS.**

---

# Tester Review (run_4) — self-simplification-pass, task-2

**Verdict: PASS**
**Reviewer role:** Tester (test strategy / coverage)
**Date:** 2026-04-26

## Files Actually Read

- `bin/lib/simplify-pass.mjs` (198 lines — full)
- `test/simplify-pass.test.mjs` (468 lines — full)
- `bin/lib/run.mjs` (lines 1501–1530, guard and call site)
- `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Removed dead `let revParseCount = 0;` | ✓ | test:154–175 — `const dispatches = [];` at line 155, no counter variable |
| `git clean -fd` now captured and asserted | ✓ | test:294–295 captures `clean` in `revertCmds`; test:307 asserts `.some(c => c.includes("clean"))` |
| Test: merge-base SHA used as diff range start | ✓ | test:381–403 captures first `--name-only` cmd, asserts `abc123feature..HEAD` |
| Test: master fallback when main unavailable | ✓ | test:405–426 verified; brief contains files from master-based diff |

## Correction of Prior Stale Finding

The "Tester Review (final)" section earlier in this file flags `git clean -fd` as unasserted. That review predated task-2's fix. The current test at lines 287–308 **does** capture and assert `clean` commands. The 🟡 from the prior round is resolved.

## Edge Cases Checked

- `isCodeFile` accepts all CODE_EXT types, rejects lock/node_modules/dist/build: ✓ (lines 16–39)
- `getChangedFiles` with empty output, throwing execFn, no-code-files output: ✓ (lines 57–73)
- `runSimplifyPass` skips on null agent, empty gateCmd, unreachable merge-base: ✓ (lines 107–150)
- Agent commits (SHA changes) → gate re-run → pass/fail/revert: ✓ (lines 193–352)
- Uncommitted changes path (same SHA, non-empty diff) → gate fail → `checkout HEAD` + `clean -fd`: ✓ (lines 287–308)

## Findings

🟡 test/simplify-pass.test.mjs:462 — Guard test scans source text (`src.slice(...-200)`), not runtime behavior; `completed > 0 && blocked === 0` at run.mjs:1503 is verified by regex against 200 chars of raw source — a structural refactor that preserves logic but changes whitespace or moves code could cause a false pass or false fail; no integration test exercises the guard by actually running with `blocked > 0`

🔵 test/simplify-pass.test.mjs:386 — "uses merge-base SHA as diff range start" captures the first `--name-only` command via `!capturedDiffCmd` guard; silent misvalidation if call order changes (carried)

🔵 bin/lib/simplify-pass.mjs:111 — Pre-dispatch `rev-parse HEAD` failure early-return (lines 117–119) untested; removing lines 117–119 fails no test (Gap D, carried)

---

# Security Review — self-simplification-pass / task-2

**Verdict: PASS**
**Reviewer role:** Security Specialist
**Date:** 2026-04-26

---

## Files Actually Read

- `bin/lib/simplify-pass.mjs` (full, 198 lines)
- `test/simplify-pass.test.mjs` (full, 470 lines)
- `bin/lib/run.mjs` — `runGateInline` (lines 54–79), `dispatchToAgent` (lines 283–336), simplify-pass integration (lines 1490–1549)
- `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`
- `tasks/task-1/eval.md` (all prior security passes)

---

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| `git clean -fd` assertion added to uncommitted-revert test | ✓ | test:295 captures `clean` cmds; test:307 asserts `revertCmds.some(c => c.includes("clean"))` |

**Correction to prior Tester Review (final):** The "Tester Review (final)" in this file at lines 325–329 states the `git clean -fd` assertion is still absent. This is incorrect. The actual test file at lines 295 and 307 shows the capture and assertion are present. Task-2's handshake claim is verified correct.

---

## Security Criterion Results

### 1. Shell/Command Injection — PASS

Dynamic values interpolated into `execSync` template strings:
- `base` — output of `git merge-base HEAD main|master`, always a 40-char hex SHA or throws (lines 92–98)
- `preSha` — output of `git rev-parse HEAD`, always a 40-char hex SHA or throws (lines 112–119)
- `branch` — hardcoded array `["main", "master"]` (line 90), no user input

SHA hashes are `/[0-9a-f]{40}/` — no shell metacharacters possible. Practical injection risk from production code path: zero.

**Latent exported-API risk (🟡 below):** `getChangedFiles` is a named export that accepts `base` as a caller-supplied string with no format validation. `dispatchToAgent` passes `brief` via argument array (not shell string) — no injection there.

### 2. Prompt Injection via Filenames — WARNING (confirmed, carried)

`buildSimplifyBrief` (lines 62–65) embeds raw paths from `git diff --name-only` into the LLM prompt verbatim:

```js
${files.map(f => `- ${f}`).join("\n")}
```

Git permits filenames containing newlines, null bytes, and arbitrary Unicode. The dispatch call uses `--permission-mode bypassPermissions` (run.mjs:290), so injected instructions execute with full filesystem access. Risk is low for single-developer repos, elevated for multi-contributor projects or repos with third-party submodules.

This finding has been independently confirmed by three prior security passes. Backlog item exists.

### 3. `git clean -fd` Safety — PASS

Added at `simplify-pass.mjs:189–193`. Uses `-fd` only (not `-fdx`), so `.gitignore`d files (`.env`, `node_modules/`) are preserved. Scoped to isolated worktree `cwd`. Correct and safe. Test assertion now locks in the behavior (verified at test:295 and test:307).

### 4. Revert Scope — PASS

Both revert paths operate inside the isolated worktree. Worktree force-removed in `finally` at `run.mjs:1549` regardless of outcome.

### 5. Role File Loading — PASS

`loadSimplifyRole` reads from a fixed path relative to `__dirname_local` (lines 35–41). No user input affects the path. Missing file returns `""` gracefully. No traversal risk.

### 6. Input Guard — PASS

Early return at line 84 (`if (!agent || !gateCmd)`) prevents execution with null inputs.

---

## Findings

🟡 bin/lib/simplify-pass.mjs:62 — File paths from `git diff --name-only` embedded in agent prompt without sanitization; strip control characters before embedding (e.g. `f.replace(/[\x00-\x1f\x7f]/g, "").trim()`) — amplified risk because agent runs with `bypassPermissions` (carried from prior security passes)

🟡 bin/lib/simplify-pass.mjs:47 — `getChangedFiles` is an exported function that accepts `base` as a caller-supplied string with no SHA format validation; add `/^[0-9a-f]{7,40}$/i` guard before interpolating into shell command to harden the public API surface (carried from task-2 prior reviews)

🔵 bin/lib/simplify-pass.mjs:47 — `execSync` with template literals used for all six git commands; prefer `execFileSync("git", [...args])` to eliminate the shell-interpolation anti-pattern even though current production values are provably safe (lines 47, 92, 142, 151, 173, 179)

---

## What Was Not Verified

- Actual Claude CLI behavior when receiving a brief with a crafted filename — prompt-injection risk is based on code reading, not live testing
- Whether `--permission-mode bypassPermissions` can be overridden by a malicious prompt (Claude CLI internal behavior)

---

## Summary

No critical vulnerabilities. No regressions introduced by task-2. The `git clean -fd` test fix is confirmed present and correct, contradicting the prior Tester Review (final) entry in this file. Two 🟡 backlog items remain open from prior review cycles: unsanitized filenames in the agent prompt (prompt injection), and the unvalidated `base` parameter on the exported `getChangedFiles` API. Neither was introduced by this feature; both require backlog entries. **PASS.**

---

# Simplicity Review — self-simplification-pass (full feature, post-task-2)

**Verdict: PASS**
**Reviewer role:** Simplicity Advocate
**Date:** 2026-04-26

---

## Files Actually Read

- `bin/lib/simplify-pass.mjs` (198 lines — full)
- `test/simplify-pass.test.mjs` (469 lines — full)
- `bin/lib/run.mjs` (lines 26, 1503–1530, 1557–1578 via grep)
- `roles/simplify-pass.md` (28 lines — full)
- `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`

---

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Uses `git merge-base HEAD main\|master` for full-branch range | ✓ | simplify-pass.mjs:90–98 |
| Resulting SHA passed as `base` to `getChangedFiles` | ✓ | simplify-pass.mjs:104 |
| `getChangedFiles` runs `git diff --name-only ${base}..HEAD` | ✓ | simplify-pass.mjs:47 |
| Dead `let revParseCount = 0;` removed | ✓ | Absent from test:154–175 |
| `git clean -fd` asserted in uncommitted-revert test | ✓ | test:295, test:307 |

---

## Four Veto Categories

### 1. Dead Code — PASS

No dead code found. All imports used. All declared variables used. No commented-out code. No unreachable branches. `__dirname_local` (line 11) is consumed by `loadSimplifyRole` (line 37). `let postSha = preSha` (line 129) is live — the default is used in the `committed` check (line 138) if the second `rev-parse` throws.

### 2. Premature Abstraction — PASS

- `isCodeFile`, `getChangedFiles`, `buildSimplifyBrief`: exported and directly unit-tested; export is justified for testability.
- `loadSimplifyRole` (lines 35–41): private, single call site at `buildSimplifyBrief:61`. Technically qualifies as single-use. However the qualifier in the simplify-pass role itself is "when inlining is clearer" — inlining adds a try/catch block into `buildSimplifyBrief`, making it noisier, not clearer. Does not earn a 🔴 veto; flagged 🔵 below.
- No new abstractions in task-2 (test-only change).

### 3. Unnecessary Indirection — PASS

No passthrough delegates. `loadSimplifyRole` performs transformation (path resolution + error handling + trim). `getChangedFiles` performs transformation (parse + filter).

### 4. Gold-Plating — PASS

- `main`/`master` fallback is exercised functionality with tests — not speculative.
- `CODE_EXT` and `SKIP_RE` are directly consumed and tested.
- No feature flags, no single-value config, no speculative extension points.

---

## Findings

🔵 bin/lib/simplify-pass.mjs:35 — `loadSimplifyRole` is a private single-use helper (one call site: buildSimplifyBrief:61); per the simplify-pass role's own criterion, inline when clearer — the try/catch makes loading behavior invisible at the call site; marginal but worth noting

🔵 bin/lib/simplify-pass.mjs:140 — `changedCount` detection duplicates `(diff || "").trim().split("\n").filter(Boolean).length` in both branches of the `committed` conditional (lines 143–148 and 151–157); only the git command string differs — extract it to a variable and collapse into a single try/catch block

---

## Carried 🟡 Backlog (not introduced by this feature)

🟡 bin/lib/simplify-pass.mjs:47 — `base` SHA interpolated into shell string without format validation; `getChangedFiles` is a public export (carried from prior reviews)

🟡 bin/lib/run.mjs:1578 — `phaseOrder` omits `"simplify"`; simplify-pass dispatch cost invisible in operator console output (carried from prior reviews)

---

## Edge Cases Checked

- `loadSimplifyRole` absent file: returns `""` → `buildSimplifyBrief` omits role prefix via `${role ? role + "\n\n" : ""}` (line 62). Correct.
- `committed=true`, changedCount=0: returns `{ filesReviewed, filesChanged: 0 }` with no gate run. Correct.
- `postSha` default = `preSha` when rev-parse throws (line 129): `committed=false`, falls to `git diff --name-only HEAD` branch. Correct.
- All four veto categories checked line by line against the full source. No 🔴 findings.

---

## Summary

No veto-level issues in any of the four categories. The implementation is lean and well-structured for its scope. Two 🔵 suggestions for minor cleanups (inline single-use private helper; unify duplicated changedCount expression). Two carried 🟡 backlog items remain from prior review cycles. **PASS.**

---

# Engineer Review — self-simplification-pass, task-2

**Verdict: PASS**
**Reviewer role:** Engineer (implementation correctness, code quality, error handling, performance)
**Date:** 2026-04-26

## Files Actually Read

- `bin/lib/simplify-pass.mjs` (198 lines — full)
- `test/simplify-pass.test.mjs` (469 lines — full)
- `bin/lib/run.mjs` (line 26 import; lines 1498–1530; lines 1560–1574 summary output)
- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`
- `.team/features/self-simplification-pass/tasks/task-2/handshake.json`

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Removed unused variable (task-1: `callIndex`; task-2: `revParseCount`) | ✓ | Neither present anywhere in test file |
| Extended guard assertion to cover `blocked === 0` | ✓ | test:466 regex matches run.mjs:1503 `if (completed > 0 && blocked === 0)` |
| Added `git clean -fd` after `git checkout HEAD -- .` | ✓ | simplify-pass.mjs:189–193; test:294–295 captures it; test:307 asserts `revertCmds.some(c => c.includes("clean"))` |
| Added 3 full-branch-diff behavioral tests | ✓ | test:357–429 — three `it()` blocks under "full branch diff (not per-task)" |
| All 588 tests pass | ✓ | Gate output in prompt confirms full suite passes |

## Per-Criterion Results

### Correctness — PASS

Traced the execution path for the core feature:
1. `runSimplifyPass` line 90: iterates `["main", "master"]`, calls `git merge-base HEAD ${branch}`, breaks on non-empty result
2. `base` is the SHA from merge-base, trimmed (line 93); falsy check at line 97 guards against empty output
3. `getChangedFiles(base, cwd, execFn)` line 104: constructs `git diff --name-only ${base}..HEAD` (line 47)
4. Result: all code files modified anywhere on the feature branch — not limited to any per-task range

No task-specific state, task directory, or task index is referenced in the diff computation. Correctly implements full branch diff.

### Error handling — PASS

All failure paths produce structured return values (no uncaught throws):
- merge-base failure for both branches → `{ skipped: true, reason: "..." }` (line 101)
- `rev-parse HEAD` failure → `{ skipped: true, reason: "..." }` (line 118)
- `dispatchFn` returns `{ ok: false }` → early return, gate not run (line 124)
- gate throws → caught at line 168, treated as FAIL, triggers revert
- revert failure → swallowed best-effort (line 195)
- caller `run.mjs:1523` wraps in try/catch

### Code quality — PASS

- `getChangedFiles` is a clean, single-purpose function
- `execFn` injection is consistent; no stray direct `execSync` calls after the default-param boundary
- merge-base fallback loop is readable and avoids duplication

### Performance — PASS

At most 6 `execSync` calls in the hot path. All use `stdio: ["pipe","pipe","pipe"]` to suppress output and avoid process TTY leakage.

### `git clean -fd` fix (task-2 primary claim) — PASS

The Tester review written before task-2 run_2 claimed this was unasserted. The current test at lines 289–308 captures `clean` commands and asserts them at line 307. Fix is complete and regression-protected.

## Findings

🟡 `bin/lib/simplify-pass.mjs:47` — `base` (merge-base output) interpolated directly into shell string without SHA format check; `getChangedFiles` is exported and accepts arbitrary caller-supplied `base` — add `/^[0-9a-f]{7,40}$/i` guard to harden the public API (carried)

🟡 `bin/lib/run.mjs:1578` — `phaseOrder` omits `"simplify"`; simplify-pass dispatch cost invisible in operator output (carried)

🔵 `test/simplify-pass.test.mjs:386` — First `--name-only` command captured via `!capturedDiffCmd`; if call order changes, assertion silently validates wrong command (carried)

🔵 `bin/lib/simplify-pass.mjs:150` — `git diff --name-only HEAD` counts tracked file modifications only; if agent creates untracked new files without `git add`, `changedCount = 0` and gate is skipped — untracked files persist (new, minor edge case)

## Summary

All builder claims verified against source. Core correctness path traced end-to-end: merge-base SHA flows through `getChangedFiles` to produce a full branch diff. Error handling covers all identified failure modes. The `git clean -fd` fix is real and test-asserted. Two carried 🟡 backlog items (shell interpolation, phaseOrder). **PASS.**
