# Engineer Review — self-simplification-pass

**Verdict: PASS**
**Reviewer role:** Engineer
**Date:** 2026-04-26

---

## Files Reviewed

- `bin/lib/simplify-pass.mjs` (188 lines) — full read
- `bin/lib/run.mjs` (1622 lines) — full read
- `bin/lib/outer-loop.mjs` (975 lines) — full read
- `roles/simplify-pass.md`
- `test/simplify-pass.test.mjs` (386 lines)
- `package.json`
- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`

---

## Per-Criterion Results

### 1. Correctness — execution order verified

`runSimplifyPass(...)` called at `run.mjs:1507`; `harness("finalize", ...)` at `run.mjs:1530`. Order confirmed by static analysis and the source-assertion test at `test/simplify-pass.test.mjs:358-364`.

Core logic path (detect merge-base → filter code files → dispatch agent → compare SHAs → re-run gate → revert on failure) verified line by line. Correct in all branches.

### 2. Error handling — explicit and safe

All `execFn` calls individually try/catch'd with graceful fallback returns. Entire simplify pass in `run.mjs:1504` wrapped in broad try/catch — failures are non-fatal to the feature loop. `loadSimplifyRole()` returns `""` on read failure rather than throwing.

### 3. Edge cases verified

| Edge case | Handled? | Evidence |
|---|---|---|
| `agent: null` | ✓ | simplify-pass.mjs:84, test:108 |
| `gateCmd: ""` | ✓ | simplify-pass.mjs:84, test:116 |
| Merge-base unreachable | ✓ | lines 89-101, test:125 |
| No code files changed | ✓ | lines 104-107, test:136 |
| Agent dispatch fails | ✓ | lines 123-126, test:327 |
| Agent commits (SHA changes) | ✓ | lines 138-148, test:212 |
| Agent modifies without committing | ✓ | lines 149-158, test:306 |
| Gate PASS after simplify | ✓ | lines 166-167, test:255 |
| Gate FAIL + committed | ✓ | lines 172-177, test:279 |
| Gate FAIL + uncommitted | ✓ | lines 178-184, test:306 |
| `completed === 0` guard | ✓ | run.mjs:1503 |

### 4. Test coverage — adequate

45 tests across all exported functions using injectable `execFn` — no real git operations. Source-assertion tests for `run.mjs` verify ordering and call signatures.

---

## Findings

🟡 test/simplify-pass.test.mjs:155 — `makeExecFn` helper defined but never called by any test; dead test code

🟡 bin/lib/simplify-pass.mjs:179 — `git checkout HEAD -- .` does not remove untracked files; if the agent creates new files without committing and the gate fails, those files persist after "revert" (role spec says commit-or-nothing, unlikely in practice, but semantically incomplete)

🔵 bin/lib/run.mjs:1578 — `phaseOrder` omits `"simplify"`; simplify-pass token costs excluded from per-phase breakdown (still accumulated in run total)

🔵 bin/lib/simplify-pass.mjs:15 — `CODE_EXT` omits `.cjs`, `.mts`, `.cts` — valid modern Node.js/TypeScript extensions silently skipped

---

## Summary

Implementation is correct and safe. No critical issues. Two warning-level findings filed to backlog; neither affects production correctness given the agent's instructed behavior (commit or do nothing).

---

# Simplicity Review — self-simplification-pass

**Verdict: PASS**
**Reviewer role:** Simplicity Advocate
**Date:** 2026-04-26

---

## Files Read

- `bin/lib/simplify-pass.mjs` (188 lines) — new module
- `bin/lib/run.mjs` (1622 lines) — integration point
- `test/simplify-pass.test.mjs` (386 lines) — test suite
- `roles/simplify-pass.md` (28 lines) — agent role
- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`

---

## Per-Criterion Results

### 1. Dead Code
**PASS.** No unused imports, variables, or functions found.
- All five imports in `simplify-pass.mjs` are used (`execSync`, `readFileSync`, `resolve`, `dirname`, `fileURLToPath`).
- All exported functions (`isCodeFile`, `getChangedFiles`, `buildSimplifyBrief`, `runSimplifyPass`) are called.
- `loadSimplifyRole()` is private and called once in `buildSimplifyBrief` — not dead, used.

### 2. Premature Abstraction
**PASS.** Three small helpers are exported for testability, and each has two or more call sites when test invocations are counted:
- `isCodeFile` — called in `getChangedFiles` + 14 test assertions
- `getChangedFiles` — called in `runSimplifyPass` + 7 test calls
- `buildSimplifyBrief` — called in `runSimplifyPass` + 2 test calls

The module boundary itself (`simplify-pass.mjs`) is justified by ~45 tests and non-trivial logic (merge-base detection, SHA-tracking, revert).

### 3. Unnecessary Indirection
**PASS.** `loadSimplifyRole()` wraps `readFileSync` + `resolve` with a try/catch. It transforms the error case (returns `""` on failure) rather than purely delegating, so it earns its wrapper.

### 4. Gold-Plating
**PASS.** No speculative config options or unused flags. The `SKIP_RE` list and `CODE_EXT` regex are operationally necessary. Injectable `execFn`/`dispatchFn`/`runGateFn` parameters exist to enable test injection, not future extensibility.

---

## Findings

🟡 bin/lib/run.mjs:1578 — `phaseOrder` omits `"simplify"` — add it so simplify-pass token usage appears in the per-phase cost breakdown and progress log (both arrays at lines 1578 and 1604 need updating)

🔵 bin/lib/simplify-pass.mjs:11 — `__dirname_local` suffix `_local` is noise; rename to `__dirname` (standard ESM pattern)

🔵 bin/lib/simplify-pass.mjs:35 — `loadSimplifyRole()` is called exactly once; could be inlined into `buildSimplifyBrief` to reduce indirection (minor readability tradeoff)

---

## Edge Cases Checked

- `agent: null` → skipped immediately (line 84, tested)
- `gateCmd: ""` → skipped immediately (line 84, tested)
- No git repo (merge-base throws) → skipped with reason (lines 89-101, tested)
- No changed code files → returns without dispatch (lines 104-107, tested)
- Agent dispatch fails → returns filesChanged=0, skipped=false (lines 123-126, tested)
- Agent commits new changes → gate re-run, success path (lines 138-167, tested)
- Agent modifies without committing → uncommitted diff counted (lines 149-157, tested)
- Gate fails after simplify → reset --hard to preSha (lines 170-185, tested)
- Gate fails, no new commit → checkout HEAD -- . (lines 178-184, tested)

---

## What Wasn't Verified

- The simplify pass in an actual end-to-end run (only static + unit-test evidence)
- That the gate re-run via `runGateInline` correctly skips writing task artifacts when `taskId` is null (line 84 in `run.mjs` passes `null` — code path verified by reading `runGateInline` lines 83-122)

---

## Summary

The implementation is clean and well-scoped. The module separation is justified by the test surface. The integration in `run.mjs` (lines 1501–1526) is correct: guarded by `completed > 0`, wrapped in try/catch, result surfaced in the completion report. One 🟡 backlog item: the "simplify" phase is silently excluded from per-phase token reporting because neither `phaseOrder` array was updated. No blockers.

---

# PM Review — self-simplification-pass

**Verdict: PASS**
*(one warning filed to backlog)*

## Files Read

- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`
- `bin/lib/simplify-pass.mjs` (189 lines)
- `roles/simplify-pass.md` (28 lines)
- `test/simplify-pass.test.mjs` (385 lines)
- `bin/lib/run.mjs` — lines 1480–1575 (simplify block + finalize)
- `bin/lib/outer-loop.mjs` — lines 1–40 and 940–974 (orchestration structure)
- `package.json` — diff only

## Per-Criterion Results

### 1. Simplify pass runs automatically after tasks complete
**PASS** — `run.mjs:1501–1526`: `if (completed > 0)` block runs at the end of the task loop, no manual trigger.

### 2. Pass runs before `finalize`
**PASS** — `runSimplifyPass(...)` at line 1507; `harness("finalize"...)` at line 1530. Ordering confirmed.

### 3. Dispatches agent on changed code files
**PASS** — `getChangedFiles()` uses `git diff --name-only <merge-base>..HEAD`, filtered by `isCodeFile()`. Brief includes role file and file list.

### 4. Re-runs quality gate after agent makes changes
**PASS** — Gate called only when `changedCount > 0`; skipped when no changes made (tested at line 236).

### 5. Reverts on gate failure
**PASS** — `git reset --hard <preSha>` for committed changes; `git checkout HEAD -- .` for uncommitted. Both revert paths covered by tests.

### 6. outer-loop.mjs coverage
**PASS** — outer-loop injects `runSingleFeature` (line 597) which is run.mjs's feature function. No direct modification to outer-loop.mjs needed.

### 7. Tests — count and registration
**PASS** — 45 `it()` calls in `test/simplify-pass.test.mjs`; registered in `package.json` test script; appears in provided gate output.

### 8. Role file
**PASS** — `roles/simplify-pass.md` exists with correct intra-file-only constraints and commit instructions.

## Warning

**Guard condition deviates from the literal spec.** The spec says "after all tasks pass review." The guard is `completed > 0`, which fires even when some tasks are blocked (e.g., 3 done / 2 blocked). File to backlog for spec clarification.

## Findings

🟡 bin/lib/run.mjs:1503 — Guard `completed > 0` allows simplify pass on partial success (blocked tasks present); spec says "after all tasks pass review" — either tighten to `completed > 0 && blocked === 0` or update spec to document partial-success behavior explicitly

---

# Architect Review — self-simplification-pass

**Verdict: PASS**
**Reviewer role:** Architect
**Date:** 2026-04-26

## Files Actually Read
- `bin/lib/simplify-pass.mjs` (194 lines) — full read
- `bin/lib/run.mjs` lines 20–26 (imports), 1490–1609 (simplify block + completion report)
- `test/simplify-pass.test.mjs` (395 lines) — full read
- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`
- `.team/features/self-simplification-pass/tasks/task-1/eval.md` (prior engineer, simplicity, PM, security, tester reviews)

## Per-Criterion Results

### Module boundary — PASS
`simplify-pass.mjs` is a properly isolated module. All external I/O (agent dispatch, gate run, git execution) passes through injected function parameters (`dispatchFn`, `runGateFn`, `execFn`). No shared mutable state. No side-effects at import time. The module can be swapped or mocked independently.

### Coupling — PASS
`run.mjs` imports only `runSimplifyPass` from `simplify-pass.mjs` (line 26). `simplify-pass.mjs` imports nothing from `run.mjs`. Dependency is strictly one-directional. No circular coupling.

### Guard condition — PASS
`run.mjs:1503`: `if (completed > 0 && blocked === 0)` — correctly requires all tasks to have passed with zero blocked tasks before running the simplify pass. The `blocked === 0` condition directly enforces the spec ("after all tasks pass review").

### Placement in the execution hierarchy — PASS
The pass lives at the end of `_runSingleFeature`, between the task loop (line 1499) and `harness("finalize")` (line 1530). `outer-loop.mjs` required no modification — the pass is automatically included in both single-feature and roadmap-loop invocations without additional wiring.

### Scalability — PASS
Changed-file detection is O(diff size) via `git diff --name-only`, not O(repo size). Single synchronous agent dispatch. No in-process file content accumulation. Design holds at 10× repo size.

### Error containment — PASS
`runGateFn` call wrapped in try/catch at `simplify-pass.mjs:166–169` — gate exceptions produce `{ verdict: "FAIL" }` and trigger the revert block rather than propagating. Entire simplify block wrapped in try/catch at `run.mjs:1504/1523` — pass crash cannot fail the feature; `finalize` and push still execute.

### Revert safety — PASS with caveat (🟡 below)
Two-path revert: committed changes via `git reset --hard preSha` (line 178); uncommitted changes via `git checkout HEAD -- .` (line 184). Both operate inside the isolated worktree, which is force-removed in the `finally` block at `run.mjs:1549` regardless of pass outcome. The `git checkout HEAD -- .` path does not remove new untracked files.

## Findings

🟡 `bin/lib/simplify-pass.mjs:184` — `git checkout HEAD -- .` does not remove untracked new files; if the agent creates files without committing and the gate fails, those files persist in the working tree. Mitigated by: (a) role spec instructs commit-or-nothing, (b) worktree force-removed in `finally` at `run.mjs:1549` regardless. Risk is low but semantically incomplete. Add `git clean -fd` after `git checkout HEAD -- .` to also remove untracked files.

🔵 `bin/lib/run.mjs:1578` — `phaseOrder` hardcodes `["brainstorm", "build", "review"]`; `"simplify"` is absent despite `setUsageContext("simplify", null)` at line 1506. Simplify-pass token costs captured in run total but excluded from per-phase console breakdown (line 1579) and progress log (line 1604). Add `"simplify"` to both arrays.

🔵 `bin/lib/simplify-pass.mjs:90` — Merge-base detection only tries `main` then `master`. Repos using `develop`, `trunk`, `next`, or a custom primary branch silently skip the pass. Acceptable for v1; `git symbolic-ref refs/remotes/origin/HEAD` would be more robust.

🔵 `test/simplify-pass.test.mjs:386` — Source-assertion test verifies `completed > 0` in the guard but not `blocked === 0`. The compound condition could be weakened without the test failing. Add a parallel assertion matching `blocked\s*===\s*0` in the extracted `simplifyBlock`.

## Edge Cases Checked
- `completed === 0` → pass fully skipped ✓ (`run.mjs:1503`)
- `blocked > 0` → pass skipped by `blocked === 0` guard ✓ (`run.mjs:1503`)
- Simplify pass throws → caught at `run.mjs:1523`, feature continues ✓
- `runGateFn` throws → caught at `simplify-pass.mjs:166–169`, treated as FAIL, revert executes ✓ (test line 328)
- Agent commits then gate fails → `git reset --hard preSha` reverts ✓ (test line 262)
- Agent makes uncommitted changes then gate fails → `git checkout HEAD -- .` ✓ (test line 289)
- Agent creates untracked files then gate fails → files persist after checkout revert (mitigated by worktree removal in finally)
- No code files changed → no dispatch, no gate re-run ✓
- `agent: null` → skipped at `simplify-pass.mjs:84` ✓
- Worktree removed in `finally` whether pass succeeds or fails ✓ (`run.mjs:1549`)

---

# Security Review — self-simplification-pass

**Reviewer role:** Security Specialist
**Date:** 2026-04-26
**Overall Verdict:** PASS (one warning flagged for backlog)

---

## Files Actually Read (Security Pass)

- `bin/lib/simplify-pass.mjs` (full, 189 lines)
- `bin/lib/run.mjs` lines 54–103 (`runGateInline`), 283–388 (`dispatchToAgent`), 392–414 (`detectGateCommand`), 1490–1549 (simplify-pass integration)
- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`

---

## Security Criterion Results

### 1. Shell / Command Injection
**PASS**

All dynamic values interpolated into `execSync` template strings originate from git-internal sources:
- `base` — output of `git merge-base HEAD <hardcoded-branch>`, always a 40-char hex SHA or throws
- `preSha` — output of `git rev-parse HEAD`, always a 40-char hex SHA or throws
- `branch` — hardcoded array `["main", "master"]`, no user input

Actual injection risk is negligible. However, using `execSync` with template literals instead of `execFileSync` with argument arrays is an anti-pattern. Flagged as suggestion (lines 47, 92, 142, 151, 173, 179).

### 2. Prompt Injection via Filenames
**WARNING**

`buildSimplifyBrief` (line 62–65) embeds file paths from `git diff --name-only` directly into the LLM prompt with no sanitization:

```js
${files.map(f => `- ${f}`).join("\n")}
```

Git does not restrict filename content. A file with adversarial content in its name (newlines, injection directives) is passed verbatim into the agent's context. In a single-developer project the risk is low; in a project with external contributors or third-party submodules the risk is realistic.

### 3. Gate Command Execution (`shell: true`)
**PASS — pre-existing, not introduced by this change**

`runGateInline` (run.mjs:60) uses `execSync(cmd, { shell: true })`. `gateCmd` is derived from developer-controlled `.team/PROJECT.md` or `package.json`. The self-simplification pass reuses `gateCmd` unchanged. Threat model: trusted developer, accepted trade-off.

### 4. Revert Logic Safety
**PASS**

`git reset --hard ${preSha}` and `git checkout HEAD -- .` operate in the isolated worktree `cwd`. `preSha` is a validated SHA. The broad checkout revert is intentional and scoped to the worktree.

### 5. Role File Loading
**PASS**

`loadSimplifyRole` reads from a fixed path relative to the module. No user input affects the path. Missing file handled gracefully. No traversal risk.

### 6. Entry Guard
**PASS**

Guard at line 84 `if (!agent || !gateCmd)` prevents execution with null inputs. All error paths return safe fallback objects.

---

## Security Findings

🟡 bin/lib/simplify-pass.mjs:62 — File paths from `git diff --name-only` are embedded into the agent prompt without sanitization; strip non-printable characters and newlines from each filename before embedding (e.g. `f.replace(/[\x00-\x1f\x7f]/g, "").trim()`) to prevent adversarial filenames from injecting instructions into the LLM prompt.

🔵 bin/lib/simplify-pass.mjs:47 — `execSync` with template literal used for git commands; prefer `execFileSync("git", ["diff", "--name-only", `${base}..HEAD`], opts)` to eliminate the shell-injection anti-pattern. Same pattern at lines 92, 142, 151, 173, 179.

---

## Security Summary

No critical vulnerabilities. One warning: unsanitized file paths in the agent prompt are a prompt-injection vector in multi-contributor or submodule scenarios. Recommended backlog fix: strip control characters from filenames before embedding in `buildSimplifyBrief`.

---

# Tester Review (run_3) — self-simplification-pass

**Verdict: PASS**
*(one warning, three suggestions carried)*

## Files Read

- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`
- `bin/lib/simplify-pass.mjs` (189 lines)
- `test/simplify-pass.test.mjs` (386 lines)
- `bin/lib/run.mjs` (full — 1622 lines)
- `roles/simplify-pass.md`
- `bin/lib/outer-loop.mjs` (header — no simplify integration confirmed intentional)

---

## Per-Criterion Results

### 1. Core feature integration — PASS

`run.mjs:1503–1526` wraps `runSimplifyPass(...)` in `if (completed > 0)`, placed between
the task loop and `harness("finalize", ...)` at line 1530. Source-assertion tests at
`test/simplify-pass.test.mjs:348–384` verify import presence, call ordering, and `gateCmd`/`cwd`
parameter passing by regex on source text.

### 2. Skip paths — PASS

Tests cover: `agent: null`, `gateCmd: ""`, merge-base throws (both main+master fail),
no code files changed. All four paths verified via `runSimplifyPass` unit tests.

### 3. Dispatch and brief construction — PASS

`"dispatches agent when code files are changed"` (line 172) verifies agent is called and brief
includes the changed file. `"does not dispatch agent when no code files"` (line 196) verifies
the inverse.

### 4. Gate re-run logic — PASS

`"re-runs gate when agent makes changes (new commits)"` (line 212) verifies gate is called after
SHA change. `"does NOT re-run gate when agent makes no changes"` (line 236) verifies gate is
skipped when SHA and working-tree are both unchanged.

### 5. Revert on gate failure — PASS

Two revert paths tested:
- `"reverts changes and returns reverted=true when gate fails"` (line 279): `git reset --hard sha1`
- `"reverts uncommitted changes with checkout..."` (line 306): `git checkout HEAD -- .`

Both assert `reverted: true` and that the revert command was issued.

### 6. Dispatch failure path — PASS

`"returns skipped=false and filesChanged=0 when dispatch fails"` (line 327) verifies gate is
not called when `dispatchFn` returns `{ ok: false }`.

---

## Gaps and Risks

### Gap A — `makeExecFn` helper is dead and broken

`test/simplify-pass.test.mjs:155–169` defines a `makeExecFn` factory that is never called
by any test below it. It also contains a bug: the `rev-parse HEAD` branch always returns
`postSha` regardless of call order, so it can never correctly simulate pre/post SHA change
scenarios. All tests needing different pre/post SHAs correctly implement their own call-counter
`execFn`. The dead factory misleads future maintainers.

### Gap B — `runGateFn` throwing an exception is not handled or tested

`simplify-pass.mjs:165` calls `runGateFn` with no exception guard. If it throws, execution
jumps past the revert block at lines 171–185, leaving agent changes on the feature branch.
The outer try/catch in `run.mjs:1523` catches it and logs the error, but does not revert.
`runGateInline` is designed not to throw, but this is a behavioral contract not enforced
by the test suite. A test with `runGateFn: () => { throw new Error("gate exploded") }` would
close this regression path.

### Gap C — No test for the `master` branch fallback

`simplify-pass.mjs:90–99` tries `main`, then `master`. Tests cover "both fail" but not
"main fails, master succeeds." Low risk (same loop logic), but the branch is untested.

### Gap D — No test for pre-dispatch `rev-parse HEAD` failure

`simplify-pass.mjs:111–119` returns `{ skipped: true, reason: "could not get HEAD sha" }` if
the initial SHA capture fails. No test covers this path.

### Gap E — `isCodeFile` missing `.sh`/`.bash` coverage

Both extensions appear in `CODE_EXT` at line 15 but have no test assertions.

---

## Findings

🟡 test/simplify-pass.test.mjs:155 — Dead and broken `makeExecFn` helper (always returns `postSha` for all `rev-parse HEAD` calls, never used); remove it to avoid misleading future contributors

🟡 bin/lib/simplify-pass.mjs:165 — No exception guard around `runGateFn` call; if gate throws, revert code at lines 171–185 is never reached and agent changes remain unreversed; add try/catch around the gate call or add a test covering the throw path

🔵 bin/lib/simplify-pass.mjs:90 — No test for `master` fallback (main fails → master tried); add test with execFn that throws for `main` but succeeds for `master`

🔵 bin/lib/simplify-pass.mjs:111 — No test for pre-dispatch `rev-parse HEAD` failure path (early return at lines 117–119)

🔵 test/simplify-pass.test.mjs:23 — `isCodeFile` tests don't cover `.sh` or `.bash` extensions despite both being in CODE_EXT

---

# Tester Review (run_2) — self-simplification-pass

**Verdict: PASS**
**Reviewer role:** Tester
**Date:** 2026-04-26

---

## Files Read

- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`
- `bin/lib/simplify-pass.mjs` (193 lines — full)
- `test/simplify-pass.test.mjs` (394 lines — full)
- `bin/lib/run.mjs` lines 1490–1549 (simplify block + finalize)

---

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Removed `makeExecFn` dead helper | ✓ | Not present anywhere in test file |
| Guard tightened to `completed > 0 && blocked === 0` | ✓ | run.mjs:1503 |
| `runGateFn` wrapped in try/catch | ✓ | simplify-pass.mjs:166-170 |
| Test added for gate-throws path | ✓ | test line 328-352; asserts `reverted: true` and `revertCmds.length === 1` |

All four claimed fixes confirmed by direct code read.

---

## Per-Criterion Results

### 1. Prior 🟡 — Dead `makeExecFn` helper — FIXED
Not present in current test file. Verified by reading all 394 lines.

### 2. Prior 🟡 — No exception guard on `runGateFn` — FIXED
`simplify-pass.mjs:166-170` wraps `runGateFn` in try/catch; catch sets `{ verdict: "FAIL", exitCode: 1 }`, which flows into the revert block. Test at line 328-352 exercises this path end-to-end.

### 3. Source assertion covers `completed > 0` but NOT `blocked === 0` — GAP
`test/simplify-pass.test.mjs:386-393` extracts 200 chars before the `runSimplifyPass(` call and regex-checks `/completed\s*>\s*0/`. The actual guard is `if (completed > 0 && blocked === 0)`. Removing `&& blocked === 0` from `run.mjs:1503` would leave this test passing while silently breaking the spec requirement that the pass only runs when no tasks are blocked. This is the highest-value regression path for this feature.

### 4. Remaining untested paths (carried from prior review)
- `master` fallback: main fails → master tried (Gap C)
- Pre-dispatch `rev-parse HEAD` failure (Gap D)
- `.sh`/`.bash` in `isCodeFile` (Gap E)
None are blockers; all three were previously flagged at 🔵.

---

## Findings

🟡 test/simplify-pass.test.mjs:390 — Source assertion regex checks only `completed > 0`; the `blocked === 0` clause is spec-critical and completely untested — extend regex to `/completed\s*>\s*0\s*&&\s*blocked\s*===\s*0/` or add a separate assertion

🔵 bin/lib/simplify-pass.mjs:90 — `master` fallback branch untested (carried from prior review)

🔵 bin/lib/simplify-pass.mjs:111 — Pre-dispatch `rev-parse HEAD` failure path untested (carried from prior review)

🔵 test/simplify-pass.test.mjs:23 — `.sh`/`.bash` extensions in CODE_EXT have no `isCodeFile` assertions (carried from prior review)

---

# Engineer Review (run_3) — self-simplification-pass

**Verdict: PASS**
**Reviewer role:** Engineer
**Date:** 2026-04-26

## Files Read

- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`
- `bin/lib/simplify-pass.mjs` (193 lines — full)
- `bin/lib/run.mjs` (1622 lines — full)
- `test/simplify-pass.test.mjs` (394 lines — full)
- Test run output: 46/46 pass, 0 fail

---

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Removed dead `makeExecFn` helper | ✓ | Not present in test file |
| Guard tightened to `completed > 0 && blocked === 0` | ✓ | run.mjs:1503 |
| `runGateFn` wrapped in try/catch | ✓ | simplify-pass.mjs:165-169 |
| Test added for gate-throws path | ✓ | test/simplify-pass.test.mjs:328-352 |

---

## Per-Criterion Results

### 1. Correctness — PASS

All three prior critical/warning fixes verified by direct code read. Execution order (`runSimplifyPass` before `harness("finalize")`) confirmed at run.mjs:1507 and 1530. Revert logic is correct for both committed and uncommitted change paths.

`git diff --name-only HEAD` at simplify-pass.mjs:151 correctly captures both staged and unstaged changes vs HEAD, so uncommitted agent modifications are detected.

### 2. Error handling — PASS

- `execFn` calls individually try/catch'd throughout `simplify-pass.mjs`
- `runGateFn` now wrapped in try/catch (lines 165-169); catch produces `{ verdict: "FAIL" }` which flows into revert
- Entire pass wrapped in broad try/catch at run.mjs:1523; failures are non-fatal to the feature

### 3. Test coverage — PASS with finding

46/46 tests pass. Critical paths (revert on gate fail, revert on gate throw, skip conditions, changed-file detection) are all exercised.

**Gap**: `test/simplify-pass.test.mjs:390` source-text assertion only checks for `completed > 0` in the guard, not `blocked === 0`. The key behavioral requirement — "only runs when no tasks are blocked" — is not locked in by any test. If `&& blocked === 0` is deleted from run.mjs:1503, all tests still pass.

---

## Findings

🟡 test/simplify-pass.test.mjs:390 — Source-text assertion regex `/completed\s*>\s*0/` does not cover the `blocked === 0` clause; extend to `/completed\s*>\s*0\s*&&\s*blocked\s*===\s*0/` or add a separate assertion so the full guard condition is regression-proof

---

# PM Review (run_2) — self-simplification-pass

**Verdict: PASS**
**Reviewer role:** Product Manager
**Date:** 2026-04-26

## Files Read

- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`
- `bin/lib/simplify-pass.mjs` (193 lines, full)
- `bin/lib/run.mjs` lines 1482–1530 (task loop oscillation guard, simplify block, finalize call)
- `bin/lib/run.mjs` lines 1575–1605 (phase breakdown + progress-log summary)
- `test/simplify-pass.test.mjs` lines 150–394 (dispatch, gate, revert, source-assertion tests)

---

## Per-Criterion Results

### 1. Runs automatically after all tasks pass review
**PASS** — Guard at `run.mjs:1503` is `if (completed > 0 && blocked === 0)`. No manual trigger exists. The `blocked === 0` condition prevents the pass from running when any task failed review. The only early-exit from the task loop is the oscillation guard at line 1486–1490 (`blocked >= 3`), which sets `blocked >= 3` — so the simplify guard cannot accidentally fire after an early-exit. When `blocked === 0`, the full loop ran to completion and every task passed.

**Previous PM finding resolved.** Prior run used `completed > 0` only; the builder tightened it to `completed > 0 && blocked === 0` as recommended.

### 2. Runs before `finalize`
**PASS** — `runSimplifyPass(...)` at `run.mjs:1507`; `harness("finalize", ...)` at `run.mjs:1530`. Source-assertion test at `test/simplify-pass.test.mjs:367–373` enforces this ordering mechanically.

### 3. Runs in the feature execution flow (run.mjs / outer-loop.mjs)
**PASS** — Integration is inside `_runSingleFeature` in `run.mjs`. `outer-loop.mjs` delegates to this function and required no modification; the pass is automatically included in both single-feature and roadmap-loop invocations.

### 4. Gate-throws path safe
**PASS** — `runGateFn` call at `simplify-pass.mjs:166` is wrapped in try/catch; exception maps to `{ verdict: "FAIL" }` and the revert block executes. Test at `test/simplify-pass.test.mjs:328` exercises this path end-to-end.

### 5. Dead test helper removed
**PASS** — `makeExecFn` is absent from the test file (grep confirmed zero matches).

### 6. Tests registered and passing
**PASS** — `test/simplify-pass.test.mjs` appears in the provided gate output with all tests passing.

---

## Findings

🟡 bin/lib/run.mjs:1578 — `phaseOrder` hardcodes `["brainstorm", "build", "review"]` at both line 1578 (console breakdown) and line 1604 (progress-log summary); `"simplify"` is absent from both. Simplify-pass token cost is silently excluded from per-phase reporting, reducing operator visibility. File to backlog.

🟡 test/simplify-pass.test.mjs:390 — Source assertion verifies `completed > 0` but not `blocked === 0`; removing the spec-critical guard clause from `run.mjs:1503` would leave all tests green. Extend the regex to cover the full condition or add a dedicated assertion. (Carried from Tester run_2.)

---

## Summary

All spec requirements verified against source. The core guard condition finding from run_1 is resolved. Two 🟡 backlog items: missing phase in token reporting, and an incomplete source-assertion for the guard. No critical findings. **PASS.**

---

# Security Review (Independent Pass) — self-simplification-pass

**Reviewer role:** Security Specialist
**Date:** 2026-04-26
**Overall Verdict:** PASS

## Files Actually Read

- `bin/lib/simplify-pass.mjs` (full, 193 lines)
- `bin/lib/run.mjs` — `runGateInline` (lines 54–151), `dispatchToAgent` (lines 283–336), `detectGateCommand` (lines 392–414), simplify-pass integration (lines 1501–1526)
- `test/simplify-pass.test.mjs` (full, 394 lines)
- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`

## Security Criterion Results

### 1. Shell/Command Injection — PASS

Dynamic values interpolated into `execSync` template strings:
- `base` — output of `git merge-base HEAD <hardcoded-branch>`, always a 40-char hex SHA or throws (lines 92–98)
- `preSha` — output of `git rev-parse HEAD`, always a 40-char hex SHA or throws (lines 112–119)
- `branch` — hardcoded array `["main", "master"]`, no user input

Neither `base` nor `preSha` can contain shell metacharacters (hex chars only). `git reset --hard ${preSha}` at line 179 is safe for the same reason.

`runGateInline` uses `shell: true` (run.mjs:65) — pre-existing pattern, not introduced here. `gateCmd` is developer-controlled config.

### 2. Prompt Injection via Filenames — WARNING

`buildSimplifyBrief` (simplify-pass.mjs:62–65) embeds raw file paths from `git diff --name-only` into the LLM prompt without sanitization:

```js
${files.map(f => `- ${f}`).join("\n")}
```

Git allows filenames with newlines, null bytes, and markdown-significant characters. A crafted filename (e.g., from a third-party submodule or an external contributor's commit) could inject instructions into the agent's prompt. The agent runs with `--permission-mode bypassPermissions` (run.mjs:290), so injected instructions execute with full filesystem access.

Risk profile: low in single-developer repos, elevated with external contributors or submodules.

### 3. Revert Scope and Safety — PASS

`git reset --hard ${preSha}` and `git checkout HEAD -- .` both operate in the isolated worktree (`cwd`). `preSha` is a validated SHA. The worktree is force-removed in `finally` at run.mjs:1549 regardless of pass outcome. A failed revert leaves dead state in the worktree, which is then cleaned up.

Edge case noted by prior Tester review: `git checkout HEAD -- .` does not remove untracked files. If the agent creates files without committing them and the gate fails, those files persist briefly before worktree removal. Not a security concern since the worktree is ephemeral.

### 4. bypassPermissions Scope — PASS (pre-existing)

`dispatchToAgent` used `--permission-mode bypassPermissions` before this feature. The simplify pass reuses the same dispatch path. Not a regression introduced here.

### 5. Role File Loading — PASS

`loadSimplifyRole` reads from a fixed path relative to `__dirname_local`. No user input affects the path. Missing file handled gracefully (returns `""`). No traversal risk.

### 6. Input Guard — PASS

Guard at simplify-pass.mjs:84 (`if (!agent || !gateCmd)`) prevents execution with null inputs. All error paths return safe objects with no side effects.

## Findings

🟡 bin/lib/simplify-pass.mjs:62 — File paths from `git diff --name-only` embedded in agent prompt without sanitization; strip control characters and newlines before embedding (e.g. `f.replace(/[\x00-\x1f\x7f]/g, "").trim()`) to prevent adversarial filenames from injecting instructions when agent runs with bypassPermissions

🔵 bin/lib/simplify-pass.mjs:47 — `execSync` with template literals used for git commands; prefer `execFileSync("git", ["diff", "--name-only", `${base}..HEAD`], opts)` to eliminate the shell-interpolation anti-pattern even though current interpolated values are provably safe; same pattern at lines 92, 142, 151, 173, 179

## Edge Cases Checked

- `base` containing shell metacharacters: impossible — git SHA is hex-only
- `preSha` used in `git reset --hard`: same, safe
- Adversarial filename in git diff output → embedded in LLM prompt unescaped: confirmed warning path
- `loadSimplifyRole` path traversal: not possible, fixed relative path
- Gate command injection: pre-existing `shell: true`, developer-controlled config

## What Was Not Verified

- Actual behavior of the Claude CLI when receiving a brief with a crafted filename — the prompt-injection risk is theoretical based on code reading
- Whether `--permission-mode bypassPermissions` can be overridden by a malicious prompt (Claude CLI behavior outside this codebase's control)

---

# Simplicity Review (run_2) — self-simplification-pass

**Verdict: FAIL**
**Reviewer role:** Simplicity Advocate
**Date:** 2026-04-26

---

## Files Read

- `test/simplify-pass.test.mjs` (394 lines) — full read
- `bin/lib/simplify-pass.mjs` (193 lines) — full read
- `bin/lib/run.mjs` lines 1501–1530 (simplify-pass integration block)
- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`

---

## Per-Criterion Results

### 1. Dead Code — FAIL

`test/simplify-pass.test.mjs:138`: `let callIndex = 0;` is declared inside the `"returns filesReviewed=0 when no code files changed"` test but never read, incremented, or used in any way. This is dead code — a leftover counter from a prior iteration. All other declared names and imports verified as used.

### 2. Premature Abstraction — PASS

All exported helpers (`isCodeFile`, `getChangedFiles`, `buildSimplifyBrief`, `runSimplifyPass`) have ≥2 call sites including tests. Private `loadSimplifyRole()` has a single production call site but the try/catch + `""` fallback semantics distinguish it from a pure delegate, so it earns its wrapper.

### 3. Unnecessary Indirection — PASS

`loadSimplifyRole()` transforms (adds try/catch, returns `""` on failure) rather than purely delegating. No pass-through wrappers found.

### 4. Gold-Plating — PASS

No speculative config options or unused feature flags. Injectable `execFn`/`dispatchFn`/`runGateFn` parameters serve test injection, not future-proofing.

---

## Findings

🔴 test/simplify-pass.test.mjs:138 — `let callIndex = 0;` declared but never read or used; remove it

🟡 test/simplify-pass.test.mjs:386 — Test "only runs simplify pass when completed > 0" only checks `completed > 0` via regex; the actual guard at `run.mjs:1503` is `completed > 0 && blocked === 0` — extend assertion or rename test to document both conditions

---

## Summary

Run_2 resolved all three prior critical findings: removed `makeExecFn`, added gate-throws test, tightened guard to `completed > 0 && blocked === 0`. One dead variable (`callIndex` at test:138) remains — a one-line deletion. Under the dead-code veto rule this blocks merge.

---

# Tester Review (run_3) — self-simplification-pass

**Verdict: PASS**
**Reviewer role:** Tester
**Date:** 2026-04-26

---

## Files Read

- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`
- `bin/lib/simplify-pass.mjs` (193 lines — full)
- `test/simplify-pass.test.mjs` (394 lines — full)
- `bin/lib/run.mjs` lines 1490–1580 (simplify block + finalize + phase breakdown)

---

## Builder Claims vs Evidence (run_3)

| Claim | Verified? | Evidence |
|---|---|---|
| Removed `let callIndex = 0;` dead variable | ✓ | Not present in test file; searched all 394 lines |
| Guard assertion regex extended to cover `blocked === 0` | ✓ | test:389 regex is `/completed\s*>\s*0\s*&&\s*blocked\s*===\s*0/` |
| `git clean -fd` added after `git checkout HEAD -- .` | ✓ | simplify-pass.mjs:189–194 |

All three claimed fixes confirmed by direct code read.

---

## Per-Criterion Results

### 1. Prior 🔴 — Dead `callIndex` variable — FIXED
`let callIndex = 0;` is absent from all 394 lines of the test file. Confirmed.

### 2. Prior 🟡 — Source assertion regex incomplete — FIXED
`test/simplify-pass.test.mjs:389` now asserts `/completed\s*>\s*0\s*&&\s*blocked\s*===\s*0/`. Removing either clause from `run.mjs:1503` will now cause this test to fail. Regression-proof.

### 3. Prior 🟡 (Architect) — `git checkout HEAD -- .` doesn't clean untracked files — CODE FIXED, TEST GAP

`simplify-pass.mjs:189–194` now calls `git clean -fd` after `git checkout HEAD -- .`. Fix is correct in code.

However, `test/simplify-pass.test.mjs:288–307` ("reverts uncommitted changes with checkout...") captures commands matching `checkout HEAD` in `revertCmds` but does NOT capture or assert on `git clean -fd`. The mock returns `""` for all unrecognized commands, so `git clean -fd` runs silently. Deleting `simplify-pass.mjs:189–194` would leave all 46 tests passing while silently re-introducing the untracked-file regression. The fix is untested.

### 4. Remaining untested paths (carried from prior reviews)
- `master` fallback: main fails → master tried (Gap C, 🔵)
- Pre-dispatch `rev-parse HEAD` failure early-return (Gap D, 🔵)
- `.sh`/`.bash` in `isCodeFile` (Gap E, 🔵)

---

## Findings

🟡 test/simplify-pass.test.mjs:288 — The "reverts uncommitted changes" test does not assert that `git clean -fd` was called; the fix at simplify-pass.mjs:189–194 can be silently deleted without failing any test — extend `revertCmds` capture to include `clean -fd` and add assertion `revertCmds.some(c => c.includes("clean -fd"))`

🔵 bin/lib/simplify-pass.mjs:90 — `master` fallback branch untested (carried from prior review)

🔵 bin/lib/simplify-pass.mjs:111 — Pre-dispatch `rev-parse HEAD` failure path untested (carried from prior review)

🔵 test/simplify-pass.test.mjs:23 — `.sh`/`.bash` extensions in CODE_EXT have no `isCodeFile` assertions (carried from prior review)

---

## Summary

All three run_3 builder claims verified. Prior critical (`callIndex`) and prior warning (guard regex) are fully resolved. The `git clean -fd` code fix is correct, but the test doesn't lock it in — silently removable. One new 🟡 filed. Three 🔵 suggestions carried from prior passes. No blockers.

---

# Security Review (Final Pass) — self-simplification-pass

**Reviewer role:** Security Specialist
**Date:** 2026-04-26
**Overall Verdict:** PASS (one warning carried to backlog)

---

## Files Actually Read

- `bin/lib/simplify-pass.mjs` (full, 199 lines)
- `test/simplify-pass.test.mjs` (full, 353 lines)
- `bin/lib/run.mjs` — `runGateInline` (lines 54–79), `dispatchToAgent` (lines 283–336), `detectGateCommand` (lines 392–414), simplify-pass integration (lines 1490–1549)

---

## Security Criterion Results

### 1. Shell/Command Injection — PASS

All dynamic values interpolated into `execSync` template strings are sourced from trusted git internals:
- `base` — `git merge-base HEAD main|master` → always a 40-char hex SHA or throws (lines 92–98)
- `preSha` — `git rev-parse HEAD` → always a 40-char hex SHA or throws (lines 112–119)
- `branch` — hardcoded array `["main", "master"]` (line 90), no user input

SHA hashes are limited to `/[0-9a-f]{40}/` — no shell metacharacters possible. `git reset --hard ${preSha}` (line 179) is safe for the same reason. Practical injection risk: zero.

`runGateInline` uses `shell: true` (run.mjs:65) — pre-existing pattern, not introduced here; `gateCmd` is developer-controlled config.

### 2. Prompt Injection via Filenames — WARNING (confirmed, carried)

`buildSimplifyBrief` (lines 62–65) embeds raw paths from `git diff --name-only` into the LLM prompt without sanitization:

```js
${files.map(f => `- ${f}`).join("\n")}
```

Git permits filenames containing newlines, null bytes, and arbitrary Unicode. A file named with injected directives (e.g., a third-party submodule file or an external contributor's commit) is passed verbatim to the agent. The dispatch call uses `--permission-mode bypassPermissions` (run.mjs:290), so injected instructions execute with full filesystem access. Threat is low for single-developer repos, elevated for multi-contributor projects or submodules.

**Identical finding confirmed independently by two prior security passes. Backlog item exists.**

### 3. `git clean -fd` Safety — PASS

Added at lines 189–194 in the uncommitted-change revert path. Runs with `-fd` only (not `-fdx`), so `.gitignore`d files (`.env`, `node_modules/`) are NOT removed. Scoped to the isolated worktree `cwd`. Correct and safe.

### 4. `dispatchToAgent` Brief Delivery — PASS (no shell injection)

`dispatchToAgent` uses `spawnSync` with an argument array (run.mjs:290) — the `brief` is an argv element, not a shell string. Adversarial filenames embedded in the brief cannot produce shell injection; only prompt injection is possible (see §2 above).

### 5. Role File Loading — PASS

`loadSimplifyRole` resolves a fixed path relative to `__dirname_local` (lines 35–41). No user input affects the path. Missing file returns `""` gracefully. No traversal risk.

### 6. Revert Scope — PASS

Both revert paths (`git reset --hard preSha` and `git checkout HEAD -- . && git clean -fd`) operate in the isolated worktree. Worktree is force-removed in the `finally` block at run.mjs:1549 regardless of outcome.

### 7. Input Guard — PASS

Early return at line 84 (`if (!agent || !gateCmd)`) prevents execution with null inputs. All error branches return safe fallback objects with no side effects.

---

## Findings

🟡 bin/lib/simplify-pass.mjs:62 — File paths from `git diff --name-only` embedded in agent prompt without sanitization; strip control characters and newlines before embedding (e.g. `f.replace(/[\x00-\x1f\x7f]/g, "").trim()`) — risk is amplified by `bypassPermissions` dispatch mode

🔵 bin/lib/simplify-pass.mjs:47 — `execSync` with template literal used for all six git commands; prefer `execFileSync("git", [...args])` to eliminate the shell-interpolation anti-pattern even though current values are provably safe (same pattern at lines 92, 142, 151, 173, 179)

---

## What Was Not Verified

- Actual Claude CLI behavior when receiving a brief with a crafted filename; prompt-injection risk is based on code reading, not live testing
- Whether `--permission-mode bypassPermissions` can be overridden by a malicious prompt (Claude CLI internal behavior)

---

## Summary

No critical vulnerabilities. The implementation is correct and safe for its threat model (local developer tooling). The one warning — unsanitized file paths in the agent prompt — is a realistic risk only in multi-contributor or submodule scenarios, and has been identified consistently across all security passes. No new critical findings. **PASS.**

---

# PM Review (run_3) — self-simplification-pass

**Verdict: PASS**
*(one new warning, two backlog items carried forward)*

## Files Read

- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`
- `bin/lib/simplify-pass.mjs` (193 lines, full)
- `test/simplify-pass.test.mjs` (394 lines, full)
- `bin/lib/run.mjs` lines 20–27 (imports), 1501–1530 (simplify block + finalize), 1572–1606 (token reporting)
- `roles/simplify-pass.md` (28 lines, full)

---

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Removed `let callIndex = 0;` dead variable | ✓ | Not present in 394-line test file |
| Extended source assertion regex to cover `blocked === 0` | ✓ | test:389 regex is `/completed\s*>\s*0\s*&&\s*blocked\s*===\s*0/` |
| Added `git clean -fd` after `git checkout HEAD -- .` | ✓ (code only) | simplify-pass.mjs:189–193; test does NOT assert it was called |

---

## Per-Criterion Results

### 1. Runs automatically after all tasks pass review
**PASS** — `run.mjs:1503`: `if (completed > 0 && blocked === 0)`. No manual trigger. `blocked === 0` correctly enforces "all tasks pass review."

### 2. Runs before `finalize`
**PASS** — `runSimplifyPass(...)` at `run.mjs:1507`; `harness("finalize", ...)` at `run.mjs:1530`. Source-assertion at `test:366–372` mechanically enforces ordering.

### 3. Guard condition fully tested
**PASS** — Source assertion at `test:389` verifies the full `completed > 0 && blocked === 0`. Removing either clause from `run.mjs:1503` would fail the test.

### 4. Dead variable removed
**PASS** — `let callIndex = 0;` is absent from all 394 lines of the test file. Prior 🔴 resolved.

### 5. Gate-throws revert path
**PASS** — `simplify-pass.mjs:166–170` wraps `runGateFn` in try/catch. Test at line 327–351 exercises the path and asserts `reverted: true`.

### 6. Revert completeness — untracked files
**PARTIAL** — `git clean -fd` is present at `simplify-pass.mjs:189–193`. However, the test at line 288 captures only "checkout HEAD" commands; `git clean -fd` is silently ignored. The fix is unprotected against regression.

### 7. Tests registered and passing
**PASS** — 46/46 tests pass; file appears in provided gate output.

---

## Findings

🟡 test/simplify-pass.test.mjs:295 — The uncommitted-revert test mock only captures `checkout HEAD` commands; `git clean -fd` at `simplify-pass.mjs:189` is not tracked and not asserted — extend `execFn` to capture clean commands and add `assert.ok(revertCmds.some(c => c.includes("clean -fd")))` so the untracked-file cleanup cannot silently regress

🟡 bin/lib/run.mjs:1578 — `phaseOrder` hardcodes `["brainstorm", "build", "review"]`; `"simplify"` absent at both line 1578 (console breakdown) and line 1604 (progress log) — simplify-pass token cost is invisible to operators. File to backlog. (Carried from multiple prior reviews.)

🟡 bin/lib/simplify-pass.mjs:62 — File paths from `git diff --name-only` embedded in agent prompt without sanitization; adversarial filenames can inject instructions when agent runs with `bypassPermissions`. File to backlog. (Carried from Security reviews.)

---

## Summary

All three builder-claimed fixes verified against source. The prior 🔴 dead-variable (`callIndex`) is resolved. The guard condition is correctly implemented and fully tested. One new 🟡: the `git clean -fd` fix exists in production code but the test cannot catch its removal — regression risk for the untracked-file cleanup behavior. Two carried 🟡 backlog items (phaseOrder omits "simplify"; unsanitized filenames in agent prompt) remain outstanding from prior reviews. No critical findings. **PASS.**

---

# Simplicity Review (run_3) — self-simplification-pass

**Verdict: FAIL**
**Reviewer role:** Simplicity Advocate
**Date:** 2026-04-26

---

## Files Read

- `test/simplify-pass.test.mjs` (394 lines) — full read
- `bin/lib/simplify-pass.mjs` (199 lines) — full read
- `bin/lib/run.mjs` lines 1501–1530, 1573–1607 (simplify block + phase reporting)
- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`

---

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Removed `let callIndex = 0;` (run_2 🔴) | ✓ | Not present anywhere in test file |
| Extended guard regex to `completed > 0 && blocked === 0` (run_2 🟡) | ✓ | test:389 regex `/completed\s*>\s*0\s*&&\s*blocked\s*===\s*0/` |
| Added `git clean -fd` after `git checkout HEAD -- .` (architect 🟡) | ✓ | simplify-pass.mjs:189–193 |

---

## Per-Criterion Results

### 1. Dead Code — FAIL

`test/simplify-pass.test.mjs:156`: `let revParseCount = 0;` is declared inside the `"dispatches agent when code files are changed"` test and never read, incremented, or referenced anywhere in that test's body. The `execFn` at lines 157–163 returns a hardcoded `"sha1\n"` for `rev-parse HEAD` without consulting the variable. Dead leftover — likely a copy-paste artifact from adjacent tests that do use call counters (`revParseCallCount` at line 196, `revParseCount` at lines 238/263).

All other names verified as used.

### 2. Premature Abstraction — PASS

All exported helpers (`isCodeFile`, `getChangedFiles`, `buildSimplifyBrief`, `runSimplifyPass`) have ≥2 call sites (production + tests). Private `loadSimplifyRole()` transforms (try/catch, `""` fallback) rather than purely delegating.

### 3. Unnecessary Indirection — PASS

No pass-through wrappers. No re-exports without added value.

### 4. Gold-Plating — PASS

No speculative config options or feature flags. Injectable `execFn`/`dispatchFn`/`runGateFn` serve test injection — they have test call sites, not hypothetical future ones.

---

## Findings

🔴 test/simplify-pass.test.mjs:156 — `let revParseCount = 0;` declared but never read or incremented; dead variable; remove it

🟡 test/simplify-pass.test.mjs:295 — `revertCmds` only captures `checkout HEAD` commands; `git clean -fd` (simplify-pass.mjs:189–193) is never asserted and can be silently deleted without any test failing; extend capture or add assertion for `clean -fd`

🔵 bin/lib/simplify-pass.mjs:11 — `__dirname_local` suffix `_local` is noise; rename to `__dirname` (standard ESM pattern) — carried from run_1

🔵 bin/lib/run.mjs:1578 — `phaseOrder` hardcodes `["brainstorm", "build", "review"]`; add `"simplify"` to both line 1578 and line 1604 — carried from prior reviews

---

## Edge Cases Checked

- `agent: null` → early return (simplify-pass.mjs:84, test:108) ✓
- `gateCmd: ""` → early return (simplify-pass.mjs:84, test:117) ✓
- No code files changed → no dispatch (simplify-pass.mjs:104–107, test:136) ✓
- Gate throws → try/catch maps to FAIL, revert executes (simplify-pass.mjs:166–169, test:327) ✓
- Dead variable `revParseCount` at test:156 — confirmed unused by reading entire test body (lines 154–176)

## What Was Not Verified

- Live E2E behavior (static + unit-test evidence only)
- That `git clean -fd` fires correctly at runtime (test gap identified above)

---

## Summary

The run_3 builder correctly removed the `callIndex` dead variable, tightened the guard regex, and added `git clean -fd`. However, a new dead variable (`revParseCount` at test:156) was introduced — a copy-paste artifact from adjacent tests. Under the dead-code veto rule this blocks merge. Fix: remove line 156 (`let revParseCount = 0;`).

---

# Architect Review (run_3) — self-simplification-pass

**Verdict: PASS**
**Reviewer role:** Architect
**Date:** 2026-04-26

## Files Actually Read
- `bin/lib/simplify-pass.mjs` (198 lines) — full read
- `bin/lib/run.mjs` lines 20–27 (imports), 1490–1610 (simplify block + completion report)
- `test/simplify-pass.test.mjs` (394 lines) — full read
- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`
- `.team/features/self-simplification-pass/tasks/task-1/eval.md` (all prior reviews)

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Removed dead `callIndex` variable | ✓ | Not present in test file (read all 394 lines) |
| Guard assertion extended to `blocked === 0` | ✓ | test:389 — `/completed\s*>\s*0\s*&&\s*blocked\s*===\s*0/` |
| `git clean -fd` added after `git checkout HEAD -- .` | ✓ | simplify-pass.mjs:189–193 |

## Per-Criterion Results

### Module boundary — PASS
`simplify-pass.mjs` is properly isolated. All external I/O passes through injected function parameters (`dispatchFn`, `runGateFn`, `execFn`). No shared mutable state. No side-effects at import time.

### Coupling — PASS
`run.mjs:26` imports only `runSimplifyPass` from `simplify-pass.mjs`. Strictly one-directional. No circular coupling.

### Guard condition — PASS
`run.mjs:1503`: `if (completed > 0 && blocked === 0)` correctly enforces the spec. Regression-locked by source-assertion test at `test:389`.

### Placement in execution hierarchy — PASS
End of `_runSingleFeature`, between task loop (line 1499) and `harness("finalize")` (line 1530). `outer-loop.mjs` required no modification.

### Scalability — PASS
Changed-file detection is O(diff size) via `git diff --name-only`. Single agent dispatch. No in-process file accumulation.

### Error containment — PASS
`runGateFn` wrapped in try/catch at `simplify-pass.mjs:166–170`. Entire pass wrapped at `run.mjs:1504/1523` — crash is non-fatal.

### Revert safety — PASS
Two-path revert correct in code. `git clean -fd` present at line 189. Untracked-file cleanup is unverified by any test assertion — corroborated by Tester run_3 and PM run_3.

## Findings

🟡 test/simplify-pass.test.mjs:288 — The uncommitted-revert test captures `checkout HEAD` commands but not `git clean -fd`; removing `simplify-pass.mjs:189–193` leaves all 46 tests green — extend test to assert `clean -fd` was called. (Corroborated by Tester run_3.)

🟡 bin/lib/run.mjs:1578 — `phaseOrder` at lines 1578 and 1604 omits `"simplify"`; simplify-pass token costs excluded from per-phase console breakdown and progress log despite `setUsageContext("simplify", null)` at line 1506. Add `"simplify"` to both arrays. (Carried through 3+ review passes without fix.)

🔵 bin/lib/simplify-pass.mjs:90 — Merge-base detection only tries `main` then `master`; repos using `develop`, `trunk`, or a custom primary branch silently skip the pass. Acceptable v1 limitation.

🔵 bin/lib/simplify-pass.mjs:11 — `__dirname_local` suffix `_local` is noise; standard ESM convention is `__dirname`.

## Edge Cases Checked
- `completed === 0` → pass fully skipped ✓ (`run.mjs:1503`)
- `blocked > 0` → pass skipped by `blocked === 0` guard ✓ (`run.mjs:1503`, test:389)
- Simplify pass throws → caught at `run.mjs:1523`, feature continues ✓
- `runGateFn` throws → caught at `simplify-pass.mjs:166–170`, revert executes ✓ (test:327)
- Agent commits then gate fails → `git reset --hard preSha` reverts ✓ (test:261)
- Agent uncommitted changes then gate fails → `git checkout HEAD -- .` + `git clean -fd` ✓ (code verified; clean NOT asserted in test:288)
- No code files changed → no dispatch, no gate re-run ✓
- `agent: null` → skipped at `simplify-pass.mjs:84` ✓
- Worktree removed in `finally` whether pass succeeds or fails ✓ (`run.mjs:1549`)

---

# Engineer Review (final) — self-simplification-pass

**Verdict: FAIL**
**Reviewer role:** Engineer
**Date:** 2026-04-26

## Files Actually Read

- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`
- `bin/lib/simplify-pass.mjs` (199 lines — full)
- `bin/lib/run.mjs` lines 1490–1607
- `test/simplify-pass.test.mjs` (394 lines — full)
- `.team/features/self-simplification-pass/tasks/task-1/eval.md` (all prior reviews through Simplicity run_3)

---

## Builder Claims vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Removed `let callIndex = 0;` dead variable | ✓ | Not present in test file |
| Guard assertion regex covers `blocked === 0` | ✓ | test:389 — `/completed\s*>\s*0\s*&&\s*blocked\s*===\s*0/` |
| `git clean -fd` added after `git checkout HEAD -- .` | ✓ | simplify-pass.mjs:189–193 |

All three claimed fixes confirmed. However, a new dead variable was introduced in the same run.

---

## Per-Criterion Results

### 1. Correctness — PASS

Core execution order, revert logic, and guard condition are all correct and verified. No logic regressions from the run_3 changes.

### 2. Code quality — FAIL

`test/simplify-pass.test.mjs:156`: `let revParseCount = 0;` is declared inside the `"dispatches agent when code files are changed"` test (lines 154–176) and is never read, incremented, or referenced anywhere in the test body. The `execFn` at lines 157–163 returns hardcoded values with no dependency on `revParseCount`. This is a dead variable — a copy-paste artifact from adjacent tests (`revParseCallCount` at line 196, `revParseCount` at line 238/263) that do use call counters. Identical class of bug to `callIndex` that blocked merge in run_2.

### 3. Error handling — PASS

`runGateFn` try/catch at lines 166–170, broad try/catch at run.mjs:1523. All failure paths handled.

### 4. Test coverage — PASS with gap

46/46 pass. `git clean -fd` not asserted in test:295 (code is correct; test doesn't lock it in).

---

## Findings

🔴 test/simplify-pass.test.mjs:156 — `let revParseCount = 0;` declared but never read or used; dead variable; remove this line

🟡 test/simplify-pass.test.mjs:295 — `revertCmds` mock captures only `checkout HEAD`; `git clean -fd` (simplify-pass.mjs:189–193) is unasserted and removable without failing tests — extend capture to include `clean -fd` and add assertion

---

## Summary

The run_3 builder correctly fixed all three claimed items. A new dead variable (`revParseCount` at test:156) was introduced as a copy-paste artifact — same pattern as the prior `callIndex` blocker. One-line fix: remove line 156. **FAIL until resolved.**

---

# Tester Review (final) — self-simplification-pass, task-1

**Verdict: PASS**
**Reviewer role:** Tester (test strategy / coverage)
**Date:** 2026-04-26

## Files Actually Read

- `bin/lib/simplify-pass.mjs` (198 lines — full)
- `test/simplify-pass.test.mjs` (468 lines — full, final state after task-2)
- `bin/lib/run.mjs:1501-1530` (simplify integration block)
- `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`

## Builder Claims (task-1 run_3) vs Evidence

| Claim | Verified? | Evidence |
|---|---|---|
| Removed `let callIndex = 0;` | ✓ | Not present in 468-line test file |
| Guard regex extended to cover `blocked === 0` | ✓ | test:464 regex `/completed\s*>\s*0\s*&&\s*blocked\s*===\s*0/` |
| `git clean -fd` added after `git checkout HEAD -- .` | ✓ code only | simplify-pass.mjs:188–193; test does NOT assert it was called |

## Verdict Rationale

All three task-1 fixes are verified in the final code state. Prior 🔴 dead variable (`callIndex`) is resolved. Prior 🟡 guard-regex gap is resolved. The `git clean -fd` code exists but the test does not lock it in. This is the **only remaining unresolved gap from task-1's review cycle**.

## Findings

🟡 `test/simplify-pass.test.mjs:294` — `revertCmds` mock captures only `checkout HEAD`; `git clean -fd` at simplify-pass.mjs:188–193 is never added to `revertCmds` and is never asserted — add capture and assertion for `clean` commands so the untracked-file cleanup fix cannot be silently reverted

🔵 `bin/lib/simplify-pass.mjs:90` — `master` fallback reachable but untested (carried from prior rounds)

🔵 `test/simplify-pass.test.mjs:23` — `.sh`/`.bash` in CODE_EXT have no `isCodeFile` test coverage (carried from prior rounds)
