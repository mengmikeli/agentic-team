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

## Files Read
- `bin/lib/simplify-pass.mjs` (188 lines)
- `bin/lib/run.mjs` (1622 lines)
- `bin/lib/outer-loop.mjs` (975 lines — verified unmodified, correctly so)
- `test/simplify-pass.test.mjs` (386 lines)
- `roles/simplify-pass.md`
- `package.json`
- `.team/features/self-simplification-pass/tasks/task-1/handshake.json`

## Per-Criterion Results

### Module boundary — PASS
`simplify-pass.mjs` is a properly isolated module. All external I/O (agent dispatch, gate run, git execution) passes through injected function parameters. No shared mutable state. No side-effects at import time. The module can be swapped or mocked independently.

### Coupling — PASS
`run.mjs` imports only `runSimplifyPass` from `simplify-pass.mjs`. `simplify-pass.mjs` imports nothing from `run.mjs`. Dependency is strictly one-directional. No circular coupling.

### Placement in the execution hierarchy — PASS
The pass lives inside `_runSingleFeature`, the innermost execution unit. `outer-loop.mjs` delegates to `runSingleFeature` at line 859 and required no modification — the pass is automatically included in both single-feature and roadmap-loop invocations without additional wiring.

### Scalability — PASS
Changed-file detection is O(diff size) via `git diff --name-only`, not O(repo size). The agent dispatch is a single synchronous call. No in-process file content accumulation. This design is unchanged at 10× repo size.

### Revert safety — PASS
Two-path revert (committed: `git reset --hard preSha`; uncommitted: `git checkout HEAD -- .`) is correct. Both paths execute inside the worktree, which is force-removed in the `finally` block at `run.mjs:1549` regardless of pass outcome.

### Error containment — PASS
The simplify pass is wrapped in try/catch at `run.mjs:1523`. A crash in the pass cannot propagate to fail the feature. The feature's `finalize` and push still run.

## Findings

🔵 `bin/lib/run.mjs:1578` — `phaseOrder` hardcodes `["brainstorm", "build", "review"]`; `"simplify"` is absent, so simplify-pass token cost is silently excluded from the per-phase console breakdown and progress log entry (lines 1578 and 1604). The total IS captured. Add `"simplify"` to both arrays.

🔵 `bin/lib/simplify-pass.mjs:89` — Merge-base detection tries `main` then `master` only. Repos using `develop`, `trunk`, or `next` as the primary branch will silently skip the pass (`skipped: true, reason: "could not determine merge-base"`). Acceptable for v1; `git symbolic-ref refs/remotes/origin/HEAD` would be a more robust fallback.

## Edge Cases Checked
- `completed === 0` → pass fully skipped ✓ (`run.mjs:1503`)
- All tasks blocked → `completed === 0` → pass skipped ✓
- Simplify pass throws → caught at `run.mjs:1523`, feature continues ✓
- Agent commits then gate fails → `git reset --hard preSha` reverts all simplify commits ✓
- Agent makes uncommitted changes then gate fails → `git checkout HEAD -- .` ✓
- No code files changed → no dispatch, no gate re-run ✓
- `agent: null` → skipped at `simplify-pass.mjs:84` ✓
- Worktree removed in `finally` whether pass succeeds or fails ✓

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

# Tester Review — self-simplification-pass

**Verdict: PASS**
*(two warnings, three suggestions filed)*

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
