# Eval: task-3 — executeRun hook (Tester Review)

**Role:** Tester
**Verdict:** ITERATE

---

## Files Actually Read

- `test/extension-system.test.mjs` (full, 697 lines)
- `bin/lib/run.mjs` (lines 1205–1260, executeRun block)
- `bin/lib/extension-registry.mjs` (full)
- `bin/lib/extension-runner.mjs` (full)
- `bin/lib/extension-loader.mjs` (full)

---

## Per-Criterion Results

### Criterion 1: executeRun fires and spawns command in task `cwd`

**PARTIAL** — `run.mjs:1217` passes `cwd` to `execSync`. Evidence is code reading only. No test exercises this path or asserts the working directory of the spawned process.

### Criterion 2: stdout/stderr stored as `cli-output` artifact

**FAIL (untested production path)** — The artifact tests at `test/extension-system.test.mjs:547–594` replicate the artifact-writing logic inline using their own temp dir and their own `execSync` calls. They bypass `run.mjs:1229–1232` entirely. If that production block were deleted or broken, these tests would still pass.

### Criterion 3: Non-zero exit + `required: true` causes task FAIL

**FAIL (illusory coverage)** — The three tests at lines 596–626 hand-code the conditional directly in the test body:

```js
if (exitCode !== 0 && r.required === true) executeRunFailed = true;
```

They test *a literal if-statement*, not the production code in `run.mjs:1234`. If that line were changed or removed, all three tests would still pass. The downstream FAIL path (`run.mjs:1241–1255` — `appendProgress`, `harness("transition")`, `pushTaskStatus`, `blocked++`) is never exercised.

### Criterion 4: Gate output (npm test) — PASS

566 tests, 0 failures, exit 0.

---

## Findings

🔴 test/extension-system.test.mjs:596 — Failure-detection tests assert on hand-coded conditionals, not on run.mjs; delete run.mjs:1234 and all three still pass — replace with an integration test that exercises the actual run loop

🟡 test/extension-system.test.mjs:547 — Artifact-creation tests bypass run.mjs:1229–1232 by reimplementing logic inline; a regression in production artifact writing is undetectable

🟡 bin/lib/run.mjs:1217 — Task spec claims command spawns in task cwd but no test verifies the cwd option is passed to execSync; add a test using pwd or similar

🟡 bin/lib/run.mjs:1210 — Empty/whitespace command guard is untested; an extension returning { command: "  " } should be silently skipped

🔵 bin/lib/run.mjs:1230 — Two extensions with commands sharing the same 30-char prefix silently overwrite each other's artifact file

🔵 bin/lib/run.mjs:1239 — Outer catch swallows writeFileSync failures when artifactsDir is missing; this silent failure path is untested

---

## Verdict Rationale

Unit tests for fireExtension, circuit-breaker, loader, and registry are solid. However, the three central claims — spawn in cwd, artifact storage, task FAIL on non-zero exit — are not verified against the production run.mjs code path. The spawn/artifact/failure test suite tests its own inline logic. A regression in run.mjs:1205–1255 would go completely undetected.

**ITERATE**: Inline simulation tests must be replaced or augmented with tests that exercise the actual run.mjs executeRun block.

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

# Product Manager Review — task-3: executeRun hook

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Overall Verdict: ITERATE**

---

## Files Actually Read

- `.team/features/extension-system/tasks/task-3/handshake.json`
- `bin/lib/run.mjs` (lines 1205–1255, the executeRun block)
- `bin/lib/extension-registry.mjs` (full — JSDoc at lines 22–36)
- `test/extension-system.test.mjs` (lines 480–697, executeRun sections)
- `.team/features/extension-system/tasks/task-3/eval.md` (Tester and Security reviews above)

---

## Handshake Claims vs. Evidence

| Claim | Evidence | Status |
|---|---|---|
| Command spawned in task `cwd` | `run.mjs:1208` + `run.mjs:1216` | ✓ (code only; no test verifies cwd) |
| stdout/stderr stored as `cli-output` artifact | `run.mjs:1230–1232` writes `ext-run-${slug}.txt` | Partial — file written; artifact tests bypass production path |
| Non-zero + `required: true` causes task FAIL | `run.mjs:1234–1237` + `run.mjs:1241–1255` | ✓ (code only; tests simulate inline logic, not production) |
| JSDoc updated | `extension-registry.mjs:29–36` | ✓ |
| 10 unit tests added | 10 tests exist in file | Central claims unverified against production code |

---

## Per-Criterion Results

### Core requirement implemented — PASS (code), UNVERIFIED (tests)

The `run.mjs:1205–1255` block correctly implements all three stated behaviors by code trace. Spawn uses task `cwd`, artifact is written, `executeRunFailed` flag is set on required failure, and the retry/block lifecycle is correct.

However, as the Tester documents with one 🔴: none of the tests exercise this block. Deleting `run.mjs:1234` would leave all failure-detection tests green. The feature cannot be called "done" when its acceptance criteria are untestable by the current test suite.

### Scope completeness — PASS

All three stated behaviors are present in source code and match the handshake summary. No scope creep observed.

### Test coverage adequacy — FAIL

The Tester's 🔴 is confirmed: the tests do not verify the production code path. From a PM perspective this means the feature is not shippable — any regression in the critical path would be invisible.

### Gate output — PASS

566 tests, 0 failures. Gate passes. This does not change the test-quality finding.

---

## Findings

🔴 `test/extension-system.test.mjs:596` — Failure-detection tests hand-code the if-condition from `run.mjs:1234` locally; deleting that production line leaves all three tests green; replace with integration tests that exercise the actual `run.mjs` executeRun block (confirmed by Tester 🔴)

🟡 `test/extension-system.test.mjs:547` — Artifact-creation tests bypass `run.mjs:1229–1232` by reimplementing logic in a local temp dir; a regression in production artifact writing is undetectable (confirmed by Tester 🟡)

🟡 `bin/lib/run.mjs:1232` — `ext-run-*.txt` written to `artifactsDir` but not registered in any handshake artifact list; harness and dashboard cannot discover it — register as `{ type: "cli-output" }`

🟡 `bin/lib/run.mjs:1236` — Raw command stdout/stderr concatenated unescaped into agent retry brief; triple-backtick in extension output escapes the fence and injects into LLM context (confirmed by Security 🟡)

🔵 `bin/lib/run.mjs:1230` — Two extensions with commands sharing the same 30-char prefix silently overwrite each other's artifact file — add index suffix

---

## Verdict Rationale

The implementation is correct by code inspection and the gate passes. The feature delivers its stated user value. The ITERATE verdict is driven by the Tester's 🔴: the three tests that claim to verify the central contract (required-fail → task FAIL) test inline-simulated logic, not the production code. This is a test coverage gap that must be fixed before the feature can be considered verified. The fix is targeted and does not require architectural changes.
