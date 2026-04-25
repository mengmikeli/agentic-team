# Eval: task-4 — artifactEmit handshake integration (run_3)

**Role:** Tester
**Date:** 2026-04-26
**Overall Verdict:** PASS (2 warning backlog items, 3 suggestions)

---

## Files Actually Read

- `bin/lib/run.mjs` (full, 1745 lines)
- `bin/lib/synthesize.mjs` (full)
- `bin/lib/extension-registry.mjs` (full)
- `bin/lib/extension-loader.mjs` (full)
- `bin/lib/extension-runner.mjs` (full)
- `test/extension-system.test.mjs` (full, 966 lines)
- `test/synthesize.test.mjs` (full)
- All four `tasks/*/handshake.json`
- Previous `eval.md` (task-4 run_1/run_2 reviewer chain)

## Test Run Evidence

Gate output (provided): 45 tests pass, 0 fail across extension-system.test.mjs and synthesize.test.mjs. All referenced test files execute.

---

## Per-Criterion Results

### 1. `runArtifactEmit` writes content files — PASS

Direct evidence: `run.mjs:360-363` writes content when present. Six tests at lines 730-829 cover write, no-content, skip-invalid, sanitize, null-guard, and empty-input cases with real temp dirs and `existsSync`/`readFileSync` assertions.

### 2. `runArtifactEmit` returns task-dir-relative descriptors — PASS

Test at line 742 asserts `extras[0].path === "artifacts/ext-report.txt"`. All six tests confirm the `"artifacts/"` prefix contract.

### 3. Gate handshake merge — PARTIAL PASS (see Gap 1 below)

Code at `run.mjs:1342-1350` reads the gate handshake, spreads `allExtras` into `artifacts`, and rewrites the file. The test at lines 835-866 verifies a merge produces the right outcome but **re-implements the merge logic manually** rather than calling the production code path. A regression in the actual code (wrong key, dropped `existsSync` guard, lost spread) would not be caught.

### 4. Review handshake includes `allExtras` — PARTIAL PASS (see Gap 2 below)

`run.mjs:1439` and `run.mjs:1517` both include `...allExtras` in the review handshake `artifacts` array. Code is correct. However there is **no test** verifying this. Task-4's primary claimed fix ("preserved artifactEmitExtras in both review handshake paths") has zero test coverage against regression.

### 5. `resetRegistry()` at feature start — PASS (code), no regression test

`run.mjs:873` calls `resetRegistry()` before any extension fires. No test exercises the reset-between-features scenario (outer-loop calling `_runSingleFeature` twice), but the fix is a 1-line call site and the unit machinery under it is covered.

### 6. `parseFindings` startsWith fix — PASS

`synthesize.mjs:26-33` uses `startsWith` per line. Two new regression tests at lines 77-91 of `synthesize.test.mjs` reproduce the false-positive scenario and confirm zero findings for mid-sentence emoji references.

### 7. `runExecuteRunCommands` path registration — PASS

`run.mjs:326-328` pushes `{ type: "cli-output", path: "artifacts/ext-run-${slug}.txt" }` after write. Two tests at lines 872-896 verify the paths array is populated and correctly prefixed.

---

## Coverage Gaps (Backlog)

### Gap 1: Gate handshake merge test re-implements production logic (🟡)

`test/extension-system.test.mjs:853-856` manually replicates the merge:
```js
const hs = JSON.parse(readFileSync(gateHsPath, "utf8"));
hs.artifacts = [...(hs.artifacts || []), ...extras];
writeFileSync(gateHsPath, JSON.stringify(hs, null, 2) + "\n");
```
This tests the pattern, not the production code at `run.mjs:1342-1350`. Mutations that would break production (e.g., removing `existsSync` guard, using wrong spread target, changing the path) leave this test green. The test should call `runGateInline` against a no-op gate in a temp featureDir and verify the final `handshake.json` contains the injected extras.

### Gap 2: Review handshake `allExtras` inclusion — no test (🟡)

`run.mjs:1439` and `run.mjs:1517` pass `...allExtras` into the review/multi-review handshake `artifacts` arrays. This was task-4's stated fix over run_1. **No test exists** verifying these lines. Deleting `...allExtras` from either line would produce a regression invisible to the test suite. A test should simulate the review handshake creation with a populated `allExtras` and assert the final `handshake.json` contains both extension and eval artifacts.

### Gap 3: Hook timeout path — no test (🔵)

`extension-runner.mjs:27-33` races a 5-second timeout against the hook. All circuit-breaker tests use synchronous throws. A hook that hangs (`new Promise(() => {})`) should return `null` and increment the failure counter — this path is unverified. Use a fake timer or set a tiny test-only timeout to exercise it.

### Gap 4: Slug collision in `runExecuteRunCommands` — no test (🔵)

`run.mjs:322` generates a slug from `cmd.slice(0, 30)`. Two commands sharing the same first 30 characters produce the same slug, causing silent file overwrite. The paths array returns two entries pointing to the same file. No test covers this scenario.

### Gap 5: User-global `~/.team/extensions/` — no test (🔵)

`extension-loader.mjs:9-11` loads from both `.team/extensions/` and `~/.team/extensions/`. All `loadExtensions` tests use only the project-local directory. A bug in the second path would be invisible.

---

## Findings

🟡 test/extension-system.test.mjs:853 — Handshake merge test re-implements production merge logic (run.mjs:1342-1350) rather than calling it; regressions in the actual code path are invisible — replace with a test that calls runGateInline on a no-op gate and asserts the final handshake.json contains the extension extras

🟡 test/extension-system.test.mjs — No test covers run.mjs:1439 or run.mjs:1517 (review/multi-review handshake allExtras inclusion); task-4's primary claimed fix has no regression test — add a test that builds a review handshake with a populated allExtras and asserts both extension and eval artifacts appear

🔵 test/extension-system.test.mjs — extension-runner.mjs:27 timeout race path untested; add a test using a never-resolving hook to verify runHook returns null and increments the failure counter

🔵 test/extension-system.test.mjs — runExecuteRunCommands slug collision (run.mjs:322) untested; two commands sharing the first 30 chars silently overwrite the artifact file with no test to catch it

🔵 bin/lib/extension-loader.mjs:9 — user-global ~/.team/extensions/ load path (second entry in dirs) has no test coverage

---

## Anti-Rationalization Checklist

| Claim | Evidence | Status |
|---|---|---|
| "All tests pass" | Gate output: 45 pass 0 fail (provided) | ✓ Direct evidence |
| "Review handshake fix works" | `run.mjs:1439` and `run.mjs:1517` include `...allExtras` — code is correct | ✓ Read and verified |
| "Merge test covers the merge" | Test re-implements logic, not calls it | ✗ Gap confirmed |
| "Review handshake fix is tested" | No test at all for lines 1439/1517 | ✗ Gap confirmed |
| "resetRegistry fix is tested" | Only the unit reset is tested; outer-loop scenario is not | ⚠ partial |

---

## Summary

The implementation is correct. The three stated fixes from task-4 run_3 are confirmed in code: `parseFindings` uses `startsWith`, `allExtras` appears in both review handshake writes, and `resetRegistry()` is called at feature start. All 45 tests pass.

The test strategy has two substantive gaps: the gate handshake merge test re-implements rather than exercises the production code, and the review handshake `allExtras` inclusion (task-4's central fix) has no test at all. Both are backlog items. Neither blocks merge — the implementation is sound — but the missing tests leave two regression windows open.

---

# PM Review — extension-system: artifactEmit (final)

**Role:** Product Manager
**Date:** 2026-04-26
**Overall Verdict: PASS**

---

## Files Actually Read

- `.team/features/extension-system/tasks/task-{1,2,3,4}/handshake.json`
- `.team/features/extension-system/tasks/task-{3,4}/eval.md` (full prior review chains)
- `bin/lib/run.mjs` (lines 294–369, 869–890, 1280–1355, 1410–1527)
- `bin/lib/extension-loader.mjs` (full, 52 lines)
- `bin/lib/extension-registry.mjs` (full, 57 lines)
- `bin/lib/synthesize.mjs` (lines 118–147)
- `test/extension-system.test.mjs` (lines 730–966 in detail; full test structure via grep)
- `test/synthesize.test.mjs` (lines 28–92)

---

## Stated Requirement

> `artifactEmit` returned artifact descriptors are written to the task artifact directory and included in the handshake

Two sub-requirements: (1) write content files to artifacts dir, (2) include descriptors in `handshake.json`.

---

## Per-Criterion Results

### Sub-requirement 1: Written to artifact directory — PASS

Direct evidence: `runArtifactEmit` (run.mjs:349–369) validates each entry, sanitizes filename, writes content to disk when provided, and returns `{ type, path }` descriptors with `"artifacts/"` prefix. Six unit tests confirm this path.

### Sub-requirement 2: Included in handshake — PASS

All three handshake write paths verified in committed code:

| Write site | Code evidence | allExtras included? |
|---|---|---|
| Gate handshake | `run.mjs:1342–1350` — spread into `gateHs.artifacts` after `runGateInline` | ✓ |
| Review handshake | `run.mjs:1439` — `artifacts: [...allExtras, { type: "evaluation", path: "eval.md" }]` | ✓ |
| Multi-review handshake | `run.mjs:1517` — same pattern | ✓ |

The Architect 🟡 gap from the earlier eval round (review handshake dropping extras) is confirmed **resolved** in the committed code.

### Prior sprint blockers — ALL RESOLVED

| Finding | Resolution confirmed |
|---|---|
| Simplicity 🔴 dead-code traversal guard | `extension-loader.mjs:27`: single line, no conditional |
| parseFindings false positive | `synthesize.test.mjs:77–91` regression tests pass |
| Registry not reset between features | `run.mjs:873` calls `resetRegistry()` |
| executeRunPaths unregistered in handshake | `run.mjs:326` returns paths; `run.mjs:1317` captures them; `run.mjs:1341` merges |
| Review handshake dropping artifactEmitExtras | `run.mjs:1439, 1517` include `...allExtras` |

### Test coverage for "included in handshake" — PARTIAL

Two regression windows remain open (carried from Tester above):
1. Gate merge test (line 853) re-implements production logic — production call-site regression invisible
2. Review/multi-review handshake lines (1439, 1517) have no test at all

Both are backlog items. The implementation is correct; the test gaps are risk, not defect.

---

## Findings

🟡 test/extension-system.test.mjs:853 — Gate handshake merge test re-implements run.mjs:1342–1350 inline; a regression at the production call site is invisible — replace with a test that calls through runGateInline and asserts the written handshake.json contains extension descriptors (carried from Tester)

🟡 test/extension-system.test.mjs — No test covers run.mjs:1439 or run.mjs:1517 (review and multi-review handshake allExtras inclusion); task-4's central claimed fix has zero regression coverage — add a test asserting the review handshake contains both extension and eval artifacts (carried from Tester)

🟡 bin/lib/run.mjs:362 — `art.content` written with no size cap; adversarial extension returning a multi-GB string can exhaust disk; cap to ~10 MB to match `runExecuteRunCommands` maxBuffer convention (carried from Security review)

---

## Verdict Rationale

**PASS.** Both sub-requirements are met and directly verified. All sprint blockers are resolved. The three remaining 🟡 items are test-coverage and security backlog concerns — none represent a functional defect in the stated requirement. The `allExtras` composite correctly unifies `artifactEmitExtras` and `executeRunPaths` and is propagated to all three handshake write paths.

---

# Simplicity Review (current pass) — task-4

**Role:** Simplicity Advocate
**Date:** 2026-04-26
**Focus:** `artifactEmit` returned artifact descriptors written to task artifact dir and included in the handshake
**Overall Verdict: PASS**

---

## Files Read

- `bin/lib/extension-loader.mjs`
- `bin/lib/extension-runner.mjs`
- `bin/lib/extension-registry.mjs`
- `bin/lib/synthesize.mjs`
- `bin/lib/run.mjs` (full, 1744 lines)
- `test/extension-system.test.mjs` (full)
- `test/synthesize.test.mjs` (full)
- All four `tasks/*/handshake.json`

---

## Veto Category Results

### Dead code — PASS

No dead code in production files. One concern in test file:

`test/extension-system.test.mjs:550` contains `const { existsSync, readFileSync } = await import("node:fs")` inside a test function, shadowing the module-level static imports at line 13. `test/extension-system.test.mjs:591` contains `const { readFileSync, readdirSync } = await import("node:fs")` — again `readFileSync` shadows the module-level import. The local bindings ARE used within their test functions (not technically dead), but the module-level versions already cover them. Only `readdirSync` at line 591 is genuinely new and could have been added to the top-level import instead of triggering a full dynamic re-import.

Does not trigger the hard veto because the local bindings are not unused.

### Premature abstraction — PASS

- `runArtifactEmit` (run.mjs:349): production call site at line 1304 + direct test invocations. Contains real sanitization and I/O logic — not a thin wrapper. Extraction justified.
- `runExecuteRunCommands` (run.mjs:294): same pattern, pre-existing.
- `setExtensions` (extension-registry.mjs:15): test-only scaffolding gated by `NODE_ENV !== "test"`.

### Unnecessary indirection — PASS

No wrapper-only delegates. The `export const runSingleFeature = _runSingleFeature` alias at run.mjs:1744 is consumed by `bin/lib/cron.mjs:14`. Not dead.

The `fireExtension` JSDoc (extension-registry.mjs:22-43) is 22 lines documenting four hook contracts. Justified given extensions are authored by third parties.

### Gold-plating — PASS

The three-step path sanitization in `runArtifactEmit:350-353` is security-justified: extension-supplied artifact paths are untrusted input at a filesystem write boundary. The "no-content → descriptor-only" design is exercised by a test (line 749-764) and serves a documented use case. Neither constitutes speculative extensibility.

---

## Findings

🟡 test/extension-system.test.mjs:550 — Dynamic `import("node:fs")` shadows module-level imports on line 13; use the already-in-scope `existsSync` and `readFileSync` directly to reduce cognitive load

🟡 test/extension-system.test.mjs:591 — `readFileSync` in dynamic import is redundant with module-level import; add `readdirSync` to the top-level import at line 13 instead of re-importing inside the test function

---

## Summary

No critical (🔴) findings. The production implementation is clean with no simplicity violations. Two warnings are confined to test-file import hygiene and do not block merge.

---

# Security Review (gate) — task-4 (run_3)

**Role:** Security Specialist
**Date:** 2026-04-26
**Overall Verdict:** PASS — 0 critical, 1 warning (backlog), 2 suggestions

---

## Files Actually Read

- `bin/lib/run.mjs` — `runArtifactEmit` at 349-369; call site at 1295-1351; review handshake at 1433-1443; multi-review handshake at 1511-1521; `runExecuteRunCommands` at 294-333
- `bin/lib/synthesize.mjs` — `parseFindings` at 21-35; `verdictAppend` hook at 120-133
- `bin/lib/extension-registry.mjs` — full, 57 lines
- `bin/lib/extension-loader.mjs` — full, 52 lines
- `bin/lib/extension-runner.mjs` — full, 39 lines
- `test/extension-system.test.mjs` — sanitize test 788-803; merge test 835-866
- `test/synthesize.test.mjs` — parseFindings startsWith regression 77-91
- All four `tasks/*/handshake.json`
- `tasks/task-4/eval.md` (tester, PM, simplicity prior sections above)

---

## Per-Criterion Results

### 1. Input validation on extension-returned artifact descriptors — PASS

`runArtifactEmit` (run.mjs:354) rejects any entry missing `type` or `path` as non-strings before use. `r.artifacts` is checked to be an array (line 352); null results are skipped (line 351). `art.content` is only written when explicitly a string (line 360). The `verdictAppend` handler in synthesize.mjs (line 127) validates severity against an explicit three-value allowlist and requires `text` to be a string — a malformed extension finding cannot inject an unknown severity into verdict computation.

### 2. Path traversal in `runArtifactEmit` — PASS with caveat

The sanitizer at run.mjs:356-359 (1) replaces `/` and `\` with `_`, then (2) replaces non-alphanumeric chars (excluding `.`, `_`, `-`) with `-`, then (3) strips leading/trailing `-`. Slash-based traversal is fully blocked: `../../etc/passwd` → `.._.._etc_passwd`, stays within `artifactsDir`.

**Caveat (🔵):** Bare `..` passes all three steps unchanged because `.` is in the `[a-zA-Z0-9._-]` allowlist. `join(artifactsDir, "..")` resolves to the parent directory. Today `writeFileSync` on a directory throws `EISDIR`, silently caught (line 363) — no file escapes and the descriptor returned (`"artifacts/.."`) is harmless to downstream consumers. An explicit guard makes the invariant self-documenting.

### 3. Content size limiting — WARNING (flagged to backlog)

`art.content` (run.mjs:360-363) is written to disk without a size cap. `runExecuteRunCommands` caps subprocess output at `maxBuffer: 10 * 1024 * 1024` (run.mjs:309). No equivalent cap exists in `runArtifactEmit`. An adversarial or buggy extension returning a multi-GB string can exhaust disk space or OOM the harness process.

Threat model: extensions are already trusted (they execute arbitrary JS via dynamic `import()`), so this is not an external-attacker vector. It is relevant for bugs or accidents in extension code, matching the threat profile of the existing `maxBuffer` guard in `runExecuteRunCommands`.

### 4. `parseFindings` startsWith fix — PASS

`synthesize.mjs:26-33` uses `startsWith("🔴")` / `startsWith("🟡")` / `startsWith("🔵")`. The prior `includes` behavior would parse `"The prior 🔴 finding is resolved"` as a new critical finding, incorrectly inflating verdicts to FAIL. Regression tests at `synthesize.test.mjs:77-91` confirm zero findings for three real false-positive sentence forms. The fix cannot suppress a genuine critical finding — false positives only inflate verdict, never suppress.

### 5. `setExtensions()` test-only guard — PASS

`extension-registry.mjs:16` throws if `process.env.NODE_ENV !== "test"`. This prevents `setExtensions()` from being called in production, enforcing that only disk-loaded extensions run in the harness.

### 6. Shell injection via `executeRun` — INFORMATIONAL (pre-existing)

`runExecuteRunCommands` (run.mjs:305) uses `execSync(cmd, { shell: true })` with an extension-provided command string — a pre-existing design surface from task-3. Extensions already execute arbitrary JS via dynamic `import()`, so the shell is not a new privilege escalation vector. No new shell execution was added in task-4.

### 7. Extension loader trust boundary — INFORMATIONAL (by design)

`extension-loader.mjs:30` loads any `.mjs`/`.js` from `.team/extensions/` or `~/.team/extensions/` via dynamic `import()` without signature verification or sandboxing. This is the intentional extension trust model. The module JSDoc does not state explicitly that write access to these directories equals process-level code execution in the harness.

---

## Findings

🟡 bin/lib/run.mjs:360 — No size cap on `art.content` before `writeFileSync`; an extension returning a multi-GB string exhausts disk or OOMs the harness process; cap content to ~10 MB (matching the `executeRun` `maxBuffer: 10 * 1024 * 1024` convention) before the write

🔵 bin/lib/run.mjs:356 — Path sanitizer preserves bare `..` (dot is in `[a-zA-Z0-9._-]` allowlist); `join(artifactsDir, "..")` resolves to parent dir; EISDIR is silently caught today but an explicit `if (safeName === ".." || safeName === ".")` guard before the write would make the invariant self-documenting

🔵 bin/lib/extension-loader.mjs:30 — Dynamic `import()` with no signature verification means any `.mjs`/`.js` in `.team/extensions/` or `~/.team/extensions/` runs as trusted code in the harness process; document this boundary explicitly in the module JSDoc so operators understand that write access to these dirs equals process-level code execution

---

## Anti-Rationalization Checklist

| Claim | Evidence | Verified? |
|---|---|---|
| Input validation rejects bad artifact entries | Traced run.mjs:354 type guards; confirmed by tests at lines 767-786 | ✓ Direct |
| Slash-based path traversal blocked | Traced 3-step sanitizer; `../../etc/passwd` → `.._.._etc_passwd` stays in dir | ✓ Direct |
| Bare `..` caveat is real | `.` is in allowlist; `join(artifactsDir, "..")` resolves to parent; EISDIR catch silent | ✓ Direct |
| No content size cap | No cap in runArtifactEmit; `executeRun` has 10 MB cap as contrast at run.mjs:309 | ✓ Direct |
| `parseFindings` false-positive fixed | `synthesize.mjs:26` uses `startsWith`; regression tests at synthesize.test.mjs:77-91 | ✓ Direct |
| `setExtensions` guard prevents prod bypass | extension-registry.mjs:16 throws when `NODE_ENV !== "test"` | ✓ Direct |

---

# Architect Review — extension-system: artifactEmit (task-4)

**Role:** Software Architect
**Focus:** System design, coupling, long-term maintainability
**Date:** 2026-04-26
**Overall Verdict: PASS**

## Files Actually Read

- `bin/lib/run.mjs` (full, 1744 lines)
- `bin/lib/extension-registry.mjs` (full, 57 lines)
- `bin/lib/extension-runner.mjs` (full, 39 lines)
- `bin/lib/extension-loader.mjs` (full, 52 lines)
- `bin/lib/synthesize.mjs` (full, 169 lines)
- `test/extension-system.test.mjs` (full, 966 lines)
- `test/synthesize.test.mjs` (full, 278 lines)
- All four `tasks/*/handshake.json`

## Prior Sprint Blockers — ALL RESOLVED

| Prior finding | Current evidence |
|---|---|
| 🟡 Review handshake drops `artifactEmitExtras` | `run.mjs:1439,1517`: `artifacts: [...allExtras, { type: "evaluation", path: "eval.md" }]` |
| 🟡 `runExecuteRunCommands` returns no paths | `run.mjs:326,332`: `paths` array returned; captured at 1317 |
| 🟡 `_extensions` not reset between features | `run.mjs:873`: `resetRegistry()` called at feature start |

## Builder Claims vs. Evidence

| Claim | Evidence | Status |
|---|---|---|
| `runArtifactEmit` writes content to artifacts dir | `run.mjs:361-363`: `writeFileSync(join(artifactsDir, safeName), art.content)` in try/catch | ✓ VERIFIED |
| Descriptors merged into gate handshake | `run.mjs:1342-1350`: spreads `allExtras` into gate `handshake.json` | ✓ VERIFIED |
| Descriptors in review handshake | `run.mjs:1439`: `[...allExtras, { type: "evaluation", path: "eval.md" }]` | ✓ VERIFIED |
| Descriptors in multi-review handshake | `run.mjs:1517`: same pattern | ✓ VERIFIED |
| `resetRegistry()` prevents cross-feature leakage | `run.mjs:873` | ✓ VERIFIED |
| `parseFindings` false-positive fixed | `synthesize.mjs:26-34`: `startsWith` + regression tests at synthesize.test.mjs:77-91 | ✓ VERIFIED |

## Architectural Assessment

**`runArtifactEmit` boundary — PASS.** Pure function (run.mjs:349–369): takes results array and artifacts dir, writes files, returns descriptors. No state, no registry coupling. Mirrors `runExecuteRunCommands` in structure and error isolation. Correct pattern.

**`allExtras` composition — PASS.** `const allExtras = [...artifactEmitExtras, ...executeRunPaths]` (run.mjs:1341) computed once per attempt after both hooks fire, before any write. All three handshake write sites reference the same binding. No aliasing, correct lifetime.

**Ordering constraint (note).** `artifactEmit` fires at line 1299 before `executeRun` at line 1311. Extensions receive only builder artifacts as payload — `executeRun` output is not yet available. This implicit constraint is not documented in the `fireExtension` JSDoc. Extension authors need to know.

**Path sanitization (minor).** Sanitizer (run.mjs:356–359): `/` and `\` → `_` (step 1), then `_` → `-` (step 2, `_` absent from `[a-zA-Z0-9._-]`). Test comment at line 795 says "underscores" but behavior produces dashes. Comment discrepancy, not a bug.

**No-content descriptor contract — acceptable.** Descriptors without `content` appear in handshake pointing to potentially non-existent files; documented as intentional. Correct design for the pre-existing-file registration use case.

## Findings

🔵 bin/lib/extension-registry.mjs:30 — `artifactEmit` fires before `executeRun`; document the ordering constraint in the `fireExtension` JSDoc so extension authors know `executeRun` output is not observable in their emit hook payload

🔵 test/extension-system.test.mjs:555 — Hardcoded slug `"echo-cli-output-test"` couples test to slug algorithm; use `readdirSync(artDir)` to find the actual file instead of constructing the expected filename

🔵 bin/lib/extension-runner.mjs:27 — `setTimeout` handle not cleared when hook resolves before 5s; in long outer-loop sessions timers accumulate — store handle and call `clearTimeout` in the resolution path

## Verdict Rationale

**PASS.** All prior sprint blockers confirmed resolved. Core feature claim satisfied: `runArtifactEmit` writes content and returns descriptors; `allExtras` propagated to all three handshake write sites. No new critical or warning findings. Three 🔵 suggestions (ordering doc, slug decoupling, timer cleanup) are optional polish. Two 🟡 test-coverage gaps (gate merge test re-implements production logic; review handshake `allExtras` inclusion untested) are backlog items, not functional defects.
