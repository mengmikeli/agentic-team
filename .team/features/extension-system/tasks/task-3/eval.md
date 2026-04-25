# Eval: task-3 — executeRun hook (Tester Review, run_2)

**Role:** Tester
**Verdict:** PASS

---

## Files Actually Read

- `test/extension-system.test.mjs` (full, 727 lines)
- `bin/lib/run.mjs` (full, 1675 lines)
- `bin/lib/extension-registry.mjs` (full)
- `.team/features/extension-system/tasks/task-3/handshake.json` (run_2)

---

## Prior ITERATE — What Changed

The run_1 Tester 🔴 found that failure-detection tests hand-coded `if (exitCode !== 0 && r.required === true)` in test scope, so deleting `run.mjs:1234` left all tests green.

The builder responded by extracting `runExecuteRunCommands(commands, artifactsDir, cwd)` as an exported function (`run.mjs:294–328`) and writing four tests (lines 597–656) that import and call it directly. **Confirmed fixed**: deleting `run.mjs:318` now breaks `test/extension-system.test.mjs:606`.

---

## Per-Criterion Results

### Criterion 1: executeRun fires and spawns command in task `cwd`

**PARTIAL (code-verified, untested).** `run.mjs:304` passes `cwd` to `execSync`. No test verifies the working directory — e.g., calling `runExecuteRunCommands([{ command: "pwd" }], dir, tmpDir)` and asserting output matches `tmpDir`. The feature title's primary behavioral claim is proven only by code inspection.

### Criterion 2: stdout/stderr stored as `cli-output` artifact

**PARTIAL (code-verified; write path untested).** `run.mjs:324` writes `ext-run-${slug}.txt`. The artifact tests at lines 548–595 still reimplement `execSync`+`writeFileSync` inline without calling `runExecuteRunCommands`. Deleting `run.mjs:324` leaves those two tests green.

### Criterion 3: Non-zero exit + `required: true` causes task FAIL

**PASS.** Four tests at lines 597–656 call `runExecuteRunCommands` directly:
- `required: true` + non-zero → `result.failed === true` ✅
- `required: false` + non-zero → `result.failed === false` ✅
- Zero exit + `required: true` → `result.failed === false` ✅
- Missing `required` field + non-zero → `result.failed === false` ✅

The prior illusory-coverage 🔴 is resolved.

### Criterion 4: Gate output — PASS

576 tests, 0 failures, exit 0.

---

## Findings

🟡 test/extension-system.test.mjs:548 — Artifact-writing tests reimplement execSync+writeFileSync locally rather than calling runExecuteRunCommands; deleting run.mjs:324 leaves both tests green — call runExecuteRunCommands in these tests and assert the artifact file exists on disk

🟡 bin/lib/run.mjs:304 — No test asserts commands execute in the provided cwd; feature title claims "spawns in task cwd" but verified by code inspection only — add a test calling runExecuteRunCommands with a temp-dir cwd and checking pwd output

🟡 bin/lib/run.mjs:323 — ext-run-*.txt artifacts written to artifactsDir but never registered in any handshake artifact list; harness and dashboard cannot discover them — return artifact paths from runExecuteRunCommands and register at the call site

🔵 bin/lib/run.mjs:319 — When multiple required commands fail, lastFailure is overwritten each iteration; only the final failure message reaches the retry brief — accumulate all failure messages

---

## Verdict Rationale

The run_1 🔴 (failure-detection tests asserting on inline conditionals) is resolved: four tests now import and call `runExecuteRunCommands` directly and would catch mutations to `run.mjs:318`. The ordering bug fix (failure flag before `writeFileSync`) is a genuine correctness improvement. Gate passes with 576 tests.

Three 🟡 items remain for backlog: artifact-test coverage still bypasses the production write path, cwd behavior is unverified by test, and written artifacts are invisible to the harness. None block merge.

**PASS** — the central contract is now exercised by real tests.

---

# Security Review — task-3: executeRun hook

**Role:** Security specialist
**Verdict:** PASS (2 warnings, 2 suggestions — no critical findings)

## Files Read (security pass)

- `bin/lib/run.mjs` (full)
- `bin/lib/extension-registry.mjs` (full)
- `bin/lib/extension-runner.mjs` (full)
- `bin/lib/extension-loader.mjs` (full)
- `test/extension-system.test.mjs` (full)
- `bin/lib/synthesize.mjs` lines 100–145

## Threat Model

Primary adversary: **malicious or compromised extension** loaded from `.team/extensions/` or `~/.team/extensions/`. Secondary threat: **indirect prompt injection** via extension commands that read repository-controlled content.

## Security Criterion Results

### Input validation on `r.command` — PASS

`run.mjs:1210`: `typeof r.command !== "string" || !r.command.trim()` guards null/empty before `execSync`. Extensions are arbitrary JS (`import()` at extension-loader.mjs:35), so `shell: true` does not expand their attack surface beyond what they already have.

### Artifact filename — no path traversal — PASS

Slug at `run.mjs:1230`: `replace(/[^a-z0-9]+/g, "-")` strips `/`, `.`, `\`, `..` before `join(artifactsDir, ...)`. No traversal possible.

### Extension loader directory containment — PASS

`extension-loader.mjs:28-31`: `normalize(join(dir, file))` + `startsWith(base + sep)` check is correct for POSIX. `readdirSync` returns plain filenames (no subdirectory separators), so adversarial filenames like `../../evil.mjs` are caught.

### Failure output injected into agent brief — WARN

`run.mjs:1236-1237`: raw `cmdOut`/`cmdErr` from the spawned command are concatenated into `lastFailure`, which is later embedded inside a triple-backtick fence in the retry brief. A benign extension reading repository-controlled content (e.g., `eslint user-file.js`, `cat CHANGES.md`) can propagate **indirect prompt injection** into the LLM context if that content contains triple-backtick sequences that escape the fence.

### Registry singleton not reset between outer-loop features — WARN

`extension-registry.mjs:8`: `_extensions` cached on first load. When `outerLoop` calls `_runSingleFeature` for multiple features, extensions from feature A's worktree remain active for feature B. `resetRegistry()` is not called in `_runSingleFeature` (confirmed by grep).

### Circuit breaker and `setExtensions()` guard — PASS

5-second hook timeout, circuit-breaks at 3 failures (`extension-runner.mjs`). `setExtensions()` throws outside `NODE_ENV=test` (`extension-registry.mjs:16-18`). These correctly harden the extension infrastructure.

## Security Findings

🟡 `bin/lib/run.mjs:1236` — Raw command output embedded unescaped in agent brief (fenced block). If an extension command reads repo-controlled content, triple-backtick in that output escapes the fence and injects LLM instructions into the next retry prompt. Strip/escape triple-backticks from `lastFailure` before embedding, or wrap with a non-guessable unique delimiter.

🟡 `bin/lib/extension-registry.mjs:8` — Extensions never reset between outer-loop feature runs. Feature A's extensions persist for feature B. Add `resetRegistry()` at start of `_runSingleFeature` alongside `resetRunUsage()` (run.mjs:784).

🔵 `bin/lib/run.mjs:1216` — `execSync(cmd, { shell: true })` is undocumented in the `executeRun` hook contract. Add a comment stating extensions are fully trusted and commands run in a shell, making the trust boundary explicit.

🔵 `bin/lib/extension-loader.mjs:30-31` — Path traversal check uses `startsWith(base + sep)`. More robust: `!path.relative(base, full).startsWith('..')` covers edge cases with symlinks or mixed separators.

## Security Summary

No critical findings. The extension trust model is coherent: extensions are trusted arbitrary JS, so the `executeRun` shell execution is a design decision, not a gap. The two warning findings (indirect prompt injection via command output, registry not reset between features) are real and should go to backlog. Neither blocks merge on security grounds alone.

---

# Product Manager Review — task-3: executeRun hook (run_2)

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Overall Verdict: PASS**

---

## Files Actually Read

- `.team/features/extension-system/tasks/task-3/handshake.json` (run_2)
- `bin/lib/run.mjs` (full — lines 294–328 `runExecuteRunCommands`, lines 1252–1261 call site)
- `bin/lib/extension-registry.mjs` (full)
- `test/extension-system.test.mjs` (full, 727 lines)
- `.team/features/extension-system/tasks/task-3/eval.md` (run_1 Tester + Security + PM reviews)

---

## What Changed from run_1

The run_1 reviews (Tester 🔴, PM 🔴) identified that failure-detection tests hand-coded the `run.mjs` conditional inline, meaning deleting the production logic left all tests green. The builder's response in run_2:

1. **Extracted `runExecuteRunCommands(commands, artifactsDir, cwd)`** as an exported function at `run.mjs:294–328`.
2. **Added 4 integration tests** at `test/extension-system.test.mjs:597–656` that `import { runExecuteRunCommands }` directly and call the actual production function. Deleting `runExecuteRunCommands` or changing `r.required === true` at `run.mjs:318` now causes test failures.
3. **Fixed ordering bug**: failure flag is now set at `run.mjs:317–321` *before* `writeFileSync` at line 324, so a write error cannot swallow a required-command failure.

The run_1 🔴 (illusory coverage) is **resolved**.

---

## Handshake Claims vs. Evidence

| Claim | Evidence | Status |
|---|---|---|
| Command spawned in task `cwd` | `run.mjs:304` passes `cwd` to `execSync` | ✓ (code trace; no test asserts cwd) |
| stdout/stderr stored as `cli-output` artifact | `run.mjs:323–324` writes `ext-run-${slug}.txt` | Partial — written; artifact tests still inline |
| Non-zero + `required: true` causes task FAIL | Integration tests 597–656 call production function | ✓ verified against real code |
| Failure flag set before writeFileSync | `run.mjs:317` precedes `run.mjs:324` | ✓ ordering correct |
| 576 tests pass | Gate output confirmed | ✓ |

---

## Per-Criterion Results

### Core requirement: spawn + artifact + FAIL — PASS

All three stated behaviors are implemented and the critical test gap from run_1 is fixed. Tests at lines 597–656 call `runExecuteRunCommands` from the production module. Removing or mutating the production logic now breaks tests.

### Scope completeness — PASS

The three handshake behaviors (cwd spawn, cli-output artifact, required-fail) are all present. No scope creep.

### Test coverage adequacy — PARTIAL

The failure-flag path is now properly covered (run_1 🔴 fixed). However, **artifact-writing is not covered by production code**: tests at lines 547–594 still reimplement `execSync`+`writeFileSync` inline. If `run.mjs:323–324` were deleted, the new integration tests (which only assert on `result.failed`) would not catch it. This is a residual 🟡 from run_1.

### Gate output — PASS

576 tests, 0 failures.

---

## Findings

🟡 test/extension-system.test.mjs:547 — Artifact-creation tests still bypass `runExecuteRunCommands` by reimplementing exec+write inline; deleting `run.mjs:323–324` would leave these tests green — replace with calls to `runExecuteRunCommands` and assert that the artifact file exists in the returned artDir (carried over from run_1 🟡, not addressed in run_2)

🟡 bin/lib/run.mjs:323 — `ext-run-*.txt` is written to `artifactsDir` but never registered in any handshake artifact list; harness and dashboard cannot discover these cli-output files — return artifact paths from `runExecuteRunCommands` and register them at the call site (carried over from run_1 PM 🟡, not addressed in run_2)

🟡 bin/lib/run.mjs:1259 — Raw command output unescaped in agent retry brief (confirmed by Security 🟡); triple-backtick in extension output escapes the fence and injects into LLM context

🟡 bin/lib/extension-registry.mjs:8 — `_extensions` cached across outer-loop features; feature A's extensions persist for feature B; add `resetRegistry()` at top of `_runSingleFeature` (confirmed by Security 🟡)

🔵 bin/lib/run.mjs:323 — Two extensions with commands sharing the same 30-char prefix silently overwrite each other's artifact file — add a numeric index suffix to slug

---

## Verdict Rationale

The run_1 🔴 (production code not exercised by tests) is resolved. Integration tests now call `runExecuteRunCommands` directly and would catch mutations to the production failure-detection logic. The ordering bug fix is a genuine correctness improvement. Gate passes with 576 tests.

The four remaining 🟡 findings are real but non-blocking: artifact-test bypass, missing artifact registration, prompt-injection risk, and registry not reset. These go to backlog. No critical issues remain.

**PASS** — the feature delivers its stated contract and its central acceptance criterion is now testable.

---

# Security Review — task-3 run_2: `runExecuteRunCommands` extraction

**Role:** Security specialist
**Run:** run_2 (builder re-implementation after ITERATE verdict)
**Verdict:** PASS (2 warnings, 2 suggestions — no critical findings)

## Files Read

- `bin/lib/run.mjs` (full, 1675 lines) — focused on `runExecuteRunCommands` (lines 294–328), `_runSingleFeature` start (lines 828–836), `buildTaskBrief` fence embedding (lines 581–590), executeRun call site (lines 1252–1262)
- `bin/lib/extension-registry.mjs` (full, 49 lines)
- `bin/lib/extension-runner.mjs` (full, 39 lines)
- `bin/lib/extension-loader.mjs` (full, 57 lines)
- `bin/lib/synthesize.mjs` (full, 167 lines)
- `.team/features/extension-system/tasks/task-3/handshake.json`

## Threat Model

Primary adversary: **malicious or buggy extension** installed in `.team/extensions/` or `~/.team/extensions/`. Secondary: **indirect prompt injection** via extension command output that reaches the agent retry brief.

## What Changed from run_1 (security lens)

The extraction of `runExecuteRunCommands` moved the failure-flag and artifact-write logic from inline in `_runSingleFeature` to a standalone function. The security surface is identical: same `shell: true`, same `lastFailure` construction, same `artifactsDir` origin. The run_1 warnings carry over unchanged at updated line numbers.

## Security Criterion Results

### Input validation on `r.command` — PASS

`run.mjs:298`: `!r || typeof r.command !== "string" || !r.command.trim()` guards null, non-string, and blank commands before `execSync`. Unchanged and correct.

### Artifact filename traversal — PASS

`run.mjs:322`: slug `replace(/[^a-z0-9]+/g, "-")` strips `/`, `\`, `.`, and `..`. `join(artifactsDir, `ext-run-${slug}.txt`)` cannot escape `artifactsDir`.

### `artifactsDir` and `cwd` origin — PASS

`artifactsDir` is constructed at `run.mjs:1158` from framework-controlled path components (`featureDir`, `task.id`). `cwd` is the worktree path set at `run.mjs:1062`. Neither is extension-controlled.

### Failure flag ordering — PASS

`run.mjs:317–321`: `failed = true` and `lastFailure = ...` are assigned **before** `writeFileSync` at line 323. The ordering bug from run_1 is confirmed fixed.

### Command output injected into retry brief — WARN

`run.mjs:320`: `lastFailure` concatenates raw `cmdOut.slice(0, 500)` and `cmdErr.slice(0, 500)`. At `run.mjs:1259`, this value becomes the outer-scope `lastFailure`, passed as `failureContext` to `buildTaskBrief`. At `buildTaskBrief:586`, `failureContext` is embedded verbatim inside triple-backtick fences with no escaping. If extension command output contains ` ``` `, the fence closes early and injects arbitrary content into the LLM's next retry prompt (indirect prompt injection via fence-breaking).

### Extension registry not reset between features — WARN

`extension-registry.mjs:8`: `_extensions` singleton never cleared between outer-loop feature runs. `run.mjs:831` calls `resetRunUsage()` at `_runSingleFeature` start but not `resetRegistry()`. Extensions loaded for feature A's worktree — including any `executeRun` hooks — remain active for feature B.

### Circuit-breaker and `setExtensions()` guard — PASS

Unchanged: 5-second timeout, 3-failure circuit-breaker in `extension-runner.mjs`. `setExtensions()` gate at `extension-registry.mjs:16–18` unchanged.

## Security Findings

🟡 bin/lib/run.mjs:320 — Raw `cmdOut`/`cmdErr` from extension commands embedded unescaped in `lastFailure`; this string flows into a triple-backtick fence at `buildTaskBrief:586`; a ` ``` ` sequence in command output escapes the fence and injects arbitrary LLM instructions into the retry brief — strip triple-backticks from `cmdOut`/`cmdErr` slices before embedding in `lastFailure`, or use a non-guessable unique delimiter

🟡 bin/lib/extension-registry.mjs:8 — Extension registry singleton never reset between outer-loop feature runs; `_runSingleFeature` calls `resetRunUsage()` (run.mjs:831) but not `resetRegistry()`, so feature A's `executeRun` extensions persist and fire for feature B — add `resetRegistry()` at run.mjs:831

🔵 bin/lib/run.mjs:309 — `execSync(cmd, { shell: true })` trust boundary not documented in the `executeRun` hook contract (extension-registry.mjs:34); extension authors who pass through user-controlled input would not know they are introducing shell injection — add a comment stating commands are run in a shell and extensions are fully trusted

🔵 bin/lib/extension-loader.mjs:30 — `startsWith(base + sep)` containment check is correct but non-idiomatic; `!path.relative(base, full).startsWith('..')` is the standard Node.js pattern and handles edge cases more explicitly

## Security Summary

No critical findings. The `runExecuteRunCommands` extraction introduced no new security issues. The two warning findings from run_1 (fence-breaking prompt injection, registry not reset across features) are unchanged and belong in backlog. Neither blocks merge on security grounds alone.

---

# Architect Review — extension-system: executeRun (run_2)

**Reviewer role:** Software Architect
**Focus:** System boundaries, coupling, long-term maintainability
**Date:** 2026-04-26
**Overall Verdict: PASS**

---

## Files Actually Read

- `bin/lib/run.mjs` (full, 1674 lines)
- `bin/lib/extension-registry.mjs` (full)
- `bin/lib/extension-runner.mjs` (full)
- `bin/lib/extension-loader.mjs` (full)
- `bin/lib/synthesize.mjs` (full)
- `test/extension-system.test.mjs` (full)
- All three task handshake.json files

---

## Per-Criterion Results

### Modularity: `runExecuteRunCommands` extraction — PASS

Extracting the loop into an exported, tested function establishes a testable boundary and allows the outer run loop to remain ignorant of artifact-writing details. The function signature `(commands, artifactsDir, cwd)` is minimal and appropriate.

### Module placement — BORDERLINE

`runExecuteRunCommands` lives in `run.mjs`, which is already 1674 lines spanning harness, token tracking, git helpers, agent dispatch, crash recovery, and the full task loop. Acceptable for v1 but the file needs splitting before the next major run-pipeline feature.

### Extension contract consistency: `verdictAppend` scope gap — WARNING

`extension-registry.mjs` JSDoc documents `verdictAppend` as firing "before runCompoundGate/computeVerdict." The task-2 handshake claims "extensions … fire after parseFindings and before runCompoundGate/computeVerdict." This is only true for the standalone `agt-harness synthesize` command (synthesize.mjs:120–131).

In `_runSingleFeature` (run.mjs:1312 single-review, run.mjs:1390 multi-review), the review output goes through `parseFindings` → `runCompoundGate` → `computeVerdict` directly — `fireExtension("verdictAppend", ...)` is never called. An extension declaring `verdictAppend` will silently have no effect during `agt run`. The extension contract published in the JSDoc is incorrect for the main pipeline.

### Ordering fix claim — PARTIALLY CORRECT

The task-3 handshake claims the fix at run.mjs:317 prevents write errors from swallowing required-command failures. `failed` is a local variable. If `writeFileSync` (line 323) throws, `runExecuteRunCommands` throws, and the outer `try/catch` at run.mjs:1254 swallows the exception — `executeRunFailed` remains `false`. The comment overstates the invariant; the actual fix only protects against subsequent code within the loop body after the `failed` assignment (i.e., `console.log`).

### Singleton cwd invariant — ACCEPTABLE

Confirmed (consistent with Security/PM findings): `resetRegistry()` is not called between features. Benign in practice because worktrees share the main project's `.team/extensions/`.

---

## Findings

🟡 bin/lib/run.mjs:317 — Comment "so a write error can never swallow it" overstates the protection: if `writeFileSync` (line 323) throws, `runExecuteRunCommands` propagates the throw to the outer `try/catch` at line 1254, which swallows it and leaves `executeRunFailed=false`. The real fix is wrapping `writeFileSync` in its own `try/catch` inside the loop.

🟡 bin/lib/extension-registry.mjs:28 — JSDoc claims `verdictAppend` fires "before runCompoundGate/computeVerdict" but `_runSingleFeature` never calls `fireExtension("verdictAppend", ...)` — only `cmdSynthesize` does. An extension declaring `verdictAppend` silently has no effect during `agt run`. Update the JSDoc to scope the claim to `cmdSynthesize`, or wire the hook into the `_runSingleFeature` review block at run.mjs:1312 and run.mjs:1390.

🔵 bin/lib/run.mjs:1 — `run.mjs` is 1674 lines and growing; flag for a split before the next run-pipeline feature (candidate: move `runExecuteRunCommands` + extension call sites to `extension-runner.mjs` or a new `run-hooks.mjs`).

🔵 bin/lib/run.mjs:322 — Slug collision confirmed: two commands sharing the same 30-char normalized prefix overwrite each other's artifact. Add a loop index suffix.

---

## Verdict Rationale

The `executeRun` hook delivers its three stated behaviors. The function extraction and direct integration tests are the right architectural moves. Two new findings: the `writeFileSync` protection comment overstates what the code does, and the `verdictAppend` JSDoc contract is wrong for the main pipeline. Neither is a runtime crash, but both set incorrect expectations for extension authors. No blocking issues.

**PASS** — two 🟡 findings go to backlog.

---

# Engineer Review — task-3: executeRun hook (run_2)

**Reviewer role:** Engineer (implementation correctness, code quality, error handling, performance)
**Date:** 2026-04-26
**Overall Verdict: PASS** (2 warnings → backlog)

---

## Files Actually Read

- `bin/lib/run.mjs` (full — 1675 lines; focused on lines 283–328 and 1252–1280)
- `bin/lib/extension-runner.mjs` (39 lines — full)
- `bin/lib/extension-registry.mjs` (49 lines — full)
- `bin/lib/extension-loader.mjs` (57 lines — full)
- `bin/lib/synthesize.mjs` (168 lines — full)
- `test/extension-system.test.mjs` (657 lines — full)
- All handshake.json files (task-1, task-2, task-3)
- `.team/features/extension-system/tasks/task-3/eval.md` (all prior reviews)

---

## Builder Claims vs. Evidence (run_2)

| Claim | Evidence | Status |
|---|---|---|
| `runExecuteRunCommands` extracted as exported function | `run.mjs:294` — `export function runExecuteRunCommands(commands, artifactsDir, cwd)` | ✓ |
| Failure flag set before `writeFileSync` | `run.mjs:317–320` before `writeFileSync` at line 323 | ✓ (see correctness note below) |
| Four simulation tests replaced with integration tests | `test/extension-system.test.mjs:597–657` — 4 tests call `runExecuteRunCommands` directly | ✓ (failure tests; artifact tests still inline) |
| Deleting production logic fails tests | `test/extension-system.test.mjs:601` asserts `result.failed`; deleting `run.mjs:318` breaks it | ✓ |

---

## Per-Criterion Results

### 1. Command spawns in task `cwd` — PASS (code trace; untested)

`run.mjs:1254` passes the worktree path as `cwd` to `runExecuteRunCommands`. Inside, `execSync(cmd, { cwd, ... })` at line 304 uses it correctly.

**Gap:** No test verifies this. A silent regression changing `cwd` to `process.cwd()` would pass all tests.

### 2. stdout/stderr stored as `cli-output` artifact — PASS (code trace; partially untested)

`run.mjs:322–324`: slug computed from sanitized first-30-chars; `writeFileSync` writes `ext-run-${slug}.txt` with command header, stdout, and stderr.

**Gap (carried):** Tests at lines 548–594 still reimplement `execSync` + `writeFileSync` inline without calling `runExecuteRunCommands`. A regression in the production artifact path is undetectable by these tests.

**Spec gap:** Artifacts written but not registered in any handshake artifact list. The task spec says "stored as a `cli-output` artifact" — harness and dashboard cannot discover these files.

### 3. Non-zero exit + `required: true` causes task FAIL — PASS

`run.mjs:317–320`: `failed = true` and `lastFailure` assigned before `writeFileSync` at line 323. The four integration tests at lines 597–657 import and call `runExecuteRunCommands` directly; deleting `run.mjs:318` breaks `test:601`. Coverage is real.

**Correctness caveat (confirmed by Architect review):** The ordering fix is only partially correct. If `writeFileSync` at line 323 throws (disk error, permissions), the exception propagates out of `runExecuteRunCommands` to the outer `try/catch` at `_runSingleFeature:1261`, which swallows it and leaves `executeRunFailed = false`. A required-command failure where the artifact write also fails is still silently dropped. The `// so a write error can never swallow it` comment overstates the protection. The complete fix requires wrapping `writeFileSync` in its own try/catch inside the loop.

### 4. `verdictAppend` contract vs. `_runSingleFeature` — CORRECTNESS GAP

`extension-registry.mjs:28` JSDoc states `verdictAppend` fires "before runCompoundGate/computeVerdict." This is only true for `cmdSynthesize`. In `_runSingleFeature` (single-review path: `run.mjs:1313`; multi-review path: `run.mjs:1390`), the pipeline is `parseFindings` → `runCompoundGate` → `computeVerdict` with no `fireExtension("verdictAppend")` call. Extension authors who install a `verdictAppend` extension and run `agt run` will see it silently ignored. The published contract is incorrect for the main execution path.

### 5. Error handling — PASS with note

`execSync` failures captured in try/catch at `run.mjs:312–316`. `exitCode = err.status ?? 1` is correct. The only unguarded path is `writeFileSync` itself (see §3 note above). All other errors are contained.

---

## Edge Cases Verified Against Source

| Case | Disposition | Source |
|---|---|---|
| `r` is null | Skipped (`!r` guard) | `run.mjs:298` |
| `r.command` is whitespace-only | Skipped (`!r.command.trim()`) | `run.mjs:298` |
| `r.required` is undefined | Non-blocking (`=== true` strict) | `run.mjs:318` |
| `r.required` is false | Non-blocking | `run.mjs:318` |
| Exit 0 with `required: true` | Non-blocking | `run.mjs:317` |
| Two required commands both fail | Both fail; `lastFailure` contains only last failure's context | `run.mjs:319–320` |

---

## Findings

🟡 `bin/lib/run.mjs:317` — `failed` is set before `writeFileSync` (line 323), but if `writeFileSync` throws, the exception propagates through `runExecuteRunCommands` to the outer `try/catch` at `_runSingleFeature:1261` which swallows it, leaving `executeRunFailed=false`; the comment "so a write error can never swallow it" is incorrect — wrap `writeFileSync` in its own try/catch inside the loop to make the invariant true (confirmed by Architect 🟡)

🟡 `bin/lib/extension-registry.mjs:28` — JSDoc claims `verdictAppend` fires "before runCompoundGate/computeVerdict" but `_runSingleFeature` (run.mjs:1313, 1390) never calls `fireExtension("verdictAppend")` — only `cmdSynthesize` does; a `verdictAppend` extension installed by a user is silently inert during `agt run` — update JSDoc to scope this claim to `cmdSynthesize`, or wire the hook into the `_runSingleFeature` review paths (confirmed by Architect 🟡)

🟡 `test/extension-system.test.mjs:548` — "stores stdout/stderr as cli-output artifact" tests still reimplement `execSync` + `writeFileSync` inline without calling `runExecuteRunCommands`; a regression in `run.mjs:322–324` is undetectable — replace with direct calls to `runExecuteRunCommands` and assert artifact file content (carried from prior reviews)

🟡 `bin/lib/run.mjs:294` — No test verifies commands run in the passed `cwd`; the primary task spec claim is untested — add a test passing a known temp dir and asserting command output reflects that directory (carried from prior reviews)

🔵 `bin/lib/run.mjs:323` — `ext-run-*.txt` written but not registered in any handshake artifact list; task spec says "stored as a cli-output artifact" implying discoverability (carried from prior PM review)

🔵 `bin/lib/run.mjs:322` — Slug collision: two commands with same first 30 sanitized characters overwrite each other's artifact — prepend loop index

🔵 `bin/lib/extension-runner.mjs:27` — `setTimeout` handle not cleared when hook resolves before 5s (carried from task-1, unresolved across all tasks)

---

## Verdict Rationale

**PASS.** The three core claimed behaviors are verified by code trace. The prior-round critical finding — failure detection tests exercising inline logic — is resolved: 4 integration tests at lines 597–657 import `runExecuteRunCommands` and would fail if the production failure logic were removed.

Two new 🟡 findings that were not in prior reviews: (1) the writeFileSync protection claim overstates what the code does — a disk error during artifact write still swallows a required-command failure; (2) the verdictAppend JSDoc contract is wrong for the main `agt run` pipeline, silently making those extensions inert. Both are correctness issues that should be backlogged promptly; neither blocks merge for the stated task deliverables.
