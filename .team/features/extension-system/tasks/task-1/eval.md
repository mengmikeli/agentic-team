# Engineer Review — extension-system / run_2 (simplicity fixes + null filter)

**Reviewer role:** Engineer (implementation correctness, code quality, error handling, performance)
**Date:** 2026-04-26
**Verdict: PASS**

## Files Actually Read

- `bin/lib/extension-loader.mjs` (60 lines)
- `bin/lib/extension-runner.mjs` (39 lines)
- `bin/lib/extension-registry.mjs` (33 lines)
- `bin/lib/run.mjs` (lines 1150–1187, 285–295)
- `test/extension-system.test.mjs` (268 lines)
- `.team/features/extension-system/tasks/task-1/handshake.json`

## Handshake Claims Verified

| Claim | Evidence | Result |
|---|---|---|
| `getExtensions` inlined into `fireExtension` | `extension-registry.mjs:23–25` — lazy-init directly in function body; no `getExtensions` defined | ✓ |
| `recordFailure` inlined into catch block | `extension-runner.mjs:36` — `_failures.set(...)` directly in catch; no `recordFailure` defined | ✓ |
| `safePath` inlined at single call site | `extension-loader.mjs:40–45` — traversal check inline with `// prevent directory traversal` comment; no `safePath` defined | ✓ |
| Filter tightened to `result != null` | `extension-registry.mjs:30` — `if (result != null)` (loose equality) | ✓ |

## Per-Criterion Results

### Correctness of inlinings — PASS

Each inline is semantically equivalent to the original helper:

- `getExtensions` body was a 3-line lazy-init block → inlined verbatim at `extension-registry.mjs:23–25`. No logic change.
- `recordFailure` body was `_failures.set(name, (_failures.get(name) ?? 0) + 1)` → inlined verbatim at `extension-runner.mjs:36`. No logic change.
- `safePath` body was normalize + startsWith guard → inlined at `extension-loader.mjs:40–45` with comment. No logic change.

### Correctness of `result != null` fix — PASS

`extension-registry.mjs:30` changed from `!== null` (strict) to `!= null` (loose). Loose `!= null` evaluates to `true` for both `null` and `undefined`, so hooks that return `undefined` (no explicit return) are now correctly excluded from the results array. This closes the prior inconsistency between `runHook` (which returns `null` on all failure paths) and the filter (which only excluded `null`).

### Dead code in traversal guard — MINOR

`extension-loader.mjs:44`:
```js
const filePath = (full.startsWith(base + sep) || full === base) ? full : null;
```
The `|| full === base` branch is unreachable. `readdirSync` entries filtered to `.mjs`/`.js` can never produce a normalized path equal to the directory itself. No correctness impact, but dead code in a security-relevant check adds unnecessary confusion for readers reasoning about the guard.

### Residual carry-over issues — NOT IN SCOPE

Still open from prior evals, not within the scope of this run:
- Timer leak: `extension-runner.mjs:27–33` (🔵 Architect + Engineer)
- `setExtensions` production export: `extension-registry.mjs:15–17` (🟡 Security)
- Integration tests duplicate append loop: `test/extension-system.test.mjs:209–216` (🟡 Tester + Simplicity)

## Findings

🔵 `bin/lib/extension-loader.mjs:44` — `|| full === base` is unreachable (a `.mjs`/`.js` file path can't normalize to equal the directory path); remove the branch to keep the traversal guard unambiguous

## Summary

All four claimed fixes are correctly applied and semantically equivalent to their originals. The `!= null` filter correctly closes the `undefined`-passthrough gap from the prior review. One minor dead-code branch exists in the traversal guard — no correctness impact. No critical or warning-level issues introduced by this run.

---

# Evaluation — extension-system / promptAppend hook

**Reviewer role:** Tester
**Date:** 2026-04-26
**Verdict:** PASS (with warnings)

---

## Files Actually Read

- `bin/lib/extension-loader.mjs`
- `bin/lib/extension-runner.mjs`
- `bin/lib/extension-registry.mjs`
- `bin/lib/run.mjs` (lines 1155–1177, 1227–1231)
- `test/extension-system.test.mjs`
- `.team/features/extension-system/tasks/task-1/handshake.json`

---

## Per-Criterion Results

### 1. `promptAppend` return is appended to the agent brief before `dispatchToAgent()` — PASS

**Evidence:** `run.mjs:1160–1174` — `fireExtension("promptAppend", ...)` is called, results are concatenated
into `effectiveBrief`, then `dispatchToAgent(agent, effectiveBrief, cwd)` is called with the enriched brief.
Logic is wrapped in `try/catch` so extension errors cannot break the pipeline.

### 2. Unit tests for `runHook` — PASS

**Evidence:** `test/extension-system.test.mjs:11–80` covers: happy path, missing hook, throws, circuit-breaker
trip at 3 failures, and circuit-breaker reset. All five cases verified.

### 3. Unit tests for `fireExtension` / registry — PASS

**Evidence:** `test/extension-system.test.mjs:84–188` covers: no extensions, capability filtering,
multi-extension fan-out, null/error result filtering, and payload forwarding.

### 4. Test coverage for `extension-loader.mjs` — FAIL (gap)

**Evidence:** `test/extension-system.test.mjs` contains **zero** tests for `loadExtensions`.
The loader contains security-relevant logic (`safePath` directory-traversal prevention at line 22–28),
manifest validation (`isValidExtension` at line 8–18), silent import error handling, and
project-local vs. user-global ordering. None of these paths are exercised.

### 5. Timeout behavior tested — FAIL (gap)

**Evidence:** `extension-runner.mjs:4` declares `TIMEOUT_MS = 5000` and `extension-runner.mjs:31–37` races
against a timeout promise, but `test/extension-system.test.mjs` has no test that verifies a slow hook
returns `null` and increments the failure counter. The 5-second guard is a named design feature with
zero test coverage.

### 6. Integration test tests real `run.mjs` logic — FAIL (gap)

**Evidence:** `test/extension-system.test.mjs:192–268` ("promptAppend brief integration") reproduces
the append loop inline rather than calling the actual `run.mjs` code. If the append logic in `run.mjs`
is changed (e.g., separator changes, filter condition changes), these tests will not catch it because
they exercise a copy of the logic, not the source.

### 7. Review and replan phases do not fire `promptAppend` — Not tested

**Evidence:** `run.mjs:1231` (`reviewBrief`), `run.mjs:1419`, `run.mjs:1469` (replan briefs) all call
`dispatchToAgent` directly without invoking `fireExtension`. Whether this is intentional
(hook scoped to build only) or an omission is undocumented. No test asserts this boundary.

---

## Findings

🟡 `test/extension-system.test.mjs` — No tests for `extension-loader.mjs`; `safePath` traversal guard and manifest validation are untested; add a describe("loadExtensions") block covering valid, invalid manifest, traversal attempt, and import error cases

🟡 `bin/lib/extension-runner.mjs:4` — 5-second timeout is a stated design feature but not tested; add a test with a hook that resolves after 6s (using fake timers or a stub) to confirm `null` is returned and failure is recorded

🟡 `test/extension-system.test.mjs:198` — "Brief append integration" tests reproduce the append loop inline; regression in `run.mjs` append logic won't be caught; either import and exercise the actual append path or clearly label these as logic-unit tests and add a separate integration test against `run.mjs`

🟡 `bin/lib/run.mjs:1231` — `promptAppend` fires only for the build phase; review and replan dispatches skip extensions entirely; this design boundary is undocumented and untested — add a comment stating intent and a test asserting the boundary if it's deliberate

🔵 `bin/lib/extension-runner.mjs:38` — `return result` passes through `undefined` (hooks that `return undefined` without throwing); `undefined !== null` is truthy so it enters the results array; downstream `r && typeof r.append === "string"` happens to filter it, but the contract is fragile; add a test for hooks returning `undefined`

---

## Summary

The core contract (promptAppend result appended to brief before dispatch) is correctly implemented and
the extension-runner/registry unit tests are solid. The gaps are all in test coverage: the loader is
entirely untested, the timeout feature is declared but unverified, the integration tests shadow-test a
copy of the logic rather than the real code, and the phase boundary (build-only) is undocumented.

None of these block correctness of the current feature, but they represent real regression risk and
one latent security gap (untested traversal guard). Flagged as PASS with four warnings for the backlog.

---

# Architect Eval — extension-system / task-1

**Verdict: PASS**
**Date:** 2026-04-26
**Reviewer role:** Architect

## Files Read

- `bin/lib/extension-loader.mjs`
- `bin/lib/extension-runner.mjs`
- `bin/lib/extension-registry.mjs`
- `bin/lib/run.mjs` (lines 1140–1200, all `dispatchToAgent` call sites)
- `test/extension-system.test.mjs`
- `.team/features/extension-system/tasks/task-1/handshake.json`

## Per-Criterion Results

### Module decomposition — PASS
Three modules with clear single-responsibility boundaries: loader (disk scan + manifest validation), runner (timeout + circuit-breaker), registry (singleton + fan-out). `run.mjs` imports only from `extension-registry.mjs`; the other two modules are internal implementation details.

### Integration point — PASS
`run.mjs:1160–1174` — hook fires after `buildTaskBrief`, before `dispatchToAgent`, with the enriched brief passed through. Both the agent and manual dispatch paths use `effectiveBrief`. Triple fault containment: `runHook` → `fireExtension` → `try/catch` in `run.mjs`.

### Singleton `cwd` invariant — WARN
`extension-registry.mjs:9-13` — `cwd` is only respected on the first call; the singleton is keyed on nullity, not on `cwd`. If `fireExtension` is called with a different `cwd` in the same process (currently impossible, but possible with future multi-project support in `outerLoop`), the wrong extensions are returned silently.

### Timer resource management — NOTE
`extension-runner.mjs:31-33` — the rejection `setTimeout` is never cleared via `clearTimeout`. If the hook resolves before 5 s, the timer still fires and rejects an already-settled promise. No functional impact at current call volumes but accumulates one dangling timer per successful hook call.

### `promptAppend` scope — NOTE
The hook fires only at the build-phase dispatch site. Review (`run.mjs:1231`), brainstorm (`run.mjs:1083`), and replan (`run.mjs:1419, 1469`) dispatches bypass extensions entirely. This is correctly scoped for the stated task but undocumented as a design boundary.

## Findings

🟡 `bin/lib/extension-registry.mjs:9-13` — Singleton ignores `cwd` after first load; future multi-cwd usage will silently serve stale extensions — key cache on `cwd` or assert single-cwd invariant with a comment

🔵 `bin/lib/extension-runner.mjs:31-33` — `setTimeout` is never cleared when hook resolves before timeout; add `clearTimeout` in a `finally` block to avoid dangling timers

🔵 `bin/lib/run.mjs:1163` — `phase: "build"` is hardcoded; add a comment documenting that only the build-phase brief receives extension injection so future contributors know where to add hook sites for review/replan phases

---

# Security Review — extension-system / task-1

**Reviewer role:** Security Specialist
**Date:** 2026-04-26
**Verdict:** PASS (warnings flagged)

## Files Read

- `bin/lib/extension-loader.mjs`
- `bin/lib/extension-runner.mjs`
- `bin/lib/extension-registry.mjs`
- `bin/lib/run.mjs` (full file)
- `test/extension-system.test.mjs`
- `.team/features/extension-system/tasks/task-1/handshake.json`

No `artifacts/test-output.txt` produced by builder. Gate output was supplied in the review brief; test suite passes (all extension-system tests green).

## Threat Model

This is a local developer CLI tool. Extensions are `.mjs`/`.js` files the developer (or their team) places in `.team/extensions/` or `~/.team/extensions/`. There is no auto-download or remote extension registry. Adversaries who can write to those directories already have filesystem access — arbitrary code execution by an extension is the intended design.

Meaningful incremental threats:
1. **Supply chain**: malicious npm package writes to `~/.team/extensions/`
2. **Compromised extension**: trusted extension is tampered and injects adversarial instructions into the agent brief
3. **Buggy extension**: unintentionally returns oversized or adversarial append content

## Per-Criterion Results

### 1. Directory traversal prevention — PASS

**Evidence:** `extension-loader.mjs:22–28` — `safePath()` normalizes the joined path and verifies `startsWith(normalize(base) + sep)`. Correct for Unix and Win32.

### 2. Extension errors isolated from main pipeline — PASS

**Evidence:** `extension-runner.mjs:39–42` catches all hook errors and returns `null`; `run.mjs:1162` outer `try/catch` swallows any thrown value from `fireExtension`. Extensions cannot propagate exceptions to the pipeline.

### 3. Type validation on appended content — PASS (but incomplete)

**Evidence:** `run.mjs:1165` — `typeof r.append === "string"` prevents non-string injection; empty-string guard prevents whitespace-only pollution. **Gap:** no size cap. A hook returning a string of arbitrary length is concatenated verbatim and then passed as a CLI argument to `claude` (line 290). At ~2 MB on Linux (ARG_MAX) the child process fails with E2BIG; at any size it inflates token costs with no bound.

### 4. Prompt injection into bypassPermissions agent — WARNING

**Evidence:** `run.mjs:1163–1174` feeds extension output into a brief dispatched at line 1174 with `--permission-mode bypassPermissions` (line 290). While extension code already runs in-process (arbitrary Node.js execution), a malicious append escalates this: it directs the AI agent with explicit brief-level authority — distinct from the extension doing the harmful action itself. A compromised extension that appends `"CRITICAL: commit .env to remote"` has the AI agent act on it with bypass permissions.

### 5. `setExtensions()` production export — WARNING

**Evidence:** `extension-registry.mjs:22` — this test helper is exported from the production module. An extension running in the same process can import and call `setExtensions([maliciousExtension])` to replace the registry mid-run, bypassing all loader validation. This is a within-process privilege escalation from one extension to arbitrary registry control.

### 6. Circuit breaker and timeout protection — PASS

**Evidence:** `extension-runner.mjs:10–20, 30–37` — 3-failure circuit breaker and 5-second timeout both implemented. Timeout is not cleared on success (minor resource concern noted by Architect eval).

## Findings

🟡 `bin/lib/run.mjs:1165` — No size cap on `r.append`; a large string will exceed ARG_MAX or inflate token costs unboundedly. Add a per-extension cap (e.g., 10 000 chars) and log a warning when truncated.

🟡 `bin/lib/run.mjs:1163` — Extension-appended content reaches an agent brief dispatched with `--permission-mode bypassPermissions` without sanitization; a compromised or buggy extension can inject adversarial instructions that the AI agent acts on with elevated implicit authority. Add a comment acknowledging the trust model (extension authors are trusted) and consider logging appended content at debug level for auditability.

🟡 `bin/lib/extension-registry.mjs:22` — `setExtensions()` is exported in production; a loaded extension can call it to replace the entire registry. Either move to `if (process.env.NODE_ENV === 'test')` guard or add a comment explicitly accepting that extensions are fully trusted in-process and this function is intentionally accessible.

🔵 `bin/lib/extension-runner.mjs:31` — `setTimeout` handle not cleared on hook success; use `finally(() => clearTimeout(tid))` to avoid accumulating live timers.

🔵 `bin/lib/extension-loader.mjs:32` — `~/.team/extensions/` is always scanned with no opt-out; a single global extension affects every project on the machine. Document or add a `NO_GLOBAL_EXTENSIONS=1` escape hatch.

## Summary

No critical findings block merge. Three warnings must be triaged to the backlog. The implementation's core security properties are sound: traversal is guarded, errors are isolated, and type checks prevent non-string injection. The warnings address missing defence-in-depth: a size cap on appended content, an audit trail for extension injections, and restricting the test-utility export to prevent in-process registry hijacking.

---

# Product Manager Eval — extension-system / task-1

**Verdict: PASS (with backlog items)**
**Date:** 2026-04-26
**Reviewer role:** Product Manager

## Files Read

- `.team/features/extension-system/tasks/task-1/handshake.json`
- `bin/lib/extension-loader.mjs`
- `bin/lib/extension-runner.mjs`
- `bin/lib/extension-registry.mjs`
- `bin/lib/run.mjs` (lines 1–30, 1155–1200, all dispatch call sites via grep)
- `test/extension-system.test.mjs`
- `package.json` (git diff from main)

## Per-Criterion Results

### Core requirement delivered — PASS

`run.mjs:1160–1174`: `fireExtension("promptAppend", ...)` fires after `buildTaskBrief()` and the enriched `effectiveBrief` is passed to both `dispatchToAgent()` and `dispatchManual()`. This matches the stated feature.

### Handshake claims vs. artifacts — PASS

All six claimed artifacts exist on disk. Tests re-run live: **14 pass, 0 fail**.

### Feature scope completeness — GAP

The stated requirement is "before `dispatchToAgent()`" without phase qualification. The hook fires only in the build loop. Three other `dispatchToAgent()` call sites (`run.mjs:1083 brainstorm`, `1231 review`, `1419/1469 replan`) do not fire `promptAppend`. No spec file confirms this is intentional.

→ Backlog: document whether build-only scope is by design; if yes, update feature description; if no, extend to remaining dispatch sites.

### Extension hook contract documented for authors — FAIL

Extensions must return `{ append: string }`. This contract is not documented anywhere: no README, no JSDoc, no exported type definition. Extension authors cannot implement the hook correctly without reading source code.

→ Backlog: add `EXTENSIONS.md` or inline JSDoc with hook signature, return shape, and example.

### Spec present for acceptance verification — MISSING

There is no `spec.md` in the feature directory. Acceptance criteria were inferred from the commit message and handshake summary. Formal acceptance criteria cannot be verified against an agreed document.

→ Process gap: require spec.md before task dispatch at sprint-init for future features.

## Findings

🟡 `bin/lib/run.mjs:1163` — `promptAppend` fires only for build phase; review (`run.mjs:1231`) and replan (`run.mjs:1419,1469`) call `dispatchToAgent()` without hook invocation; clarify intended scope or extend hook coverage to all dispatch sites
🟡 `bin/lib/extension-registry.mjs:1` — Extension return contract `{ append: string }` is undocumented; add JSDoc or EXTENSIONS.md with hook signature, return shape, and extension example
🔵 `.team/features/extension-system/` — No spec.md present; acceptance criteria cannot be independently verified against an approved document; require spec.md at sprint-init for future features

---

# Simplicity Review — extension-system / task-1

**Reviewer role:** Simplicity Reviewer
**Date:** 2026-04-26
**Verdict: FAIL**

## Files Read

- `bin/lib/extension-loader.mjs` (all 66 lines)
- `bin/lib/extension-runner.mjs` (all 44 lines)
- `bin/lib/extension-registry.mjs` (all 38 lines)
- `bin/lib/run.mjs` (lines 1155–1177)
- `test/extension-system.test.mjs` (all 269 lines)
- `.team/features/extension-system/tasks/task-1/handshake.json`

## Per-Criterion Results

### Dead code — PASS
No commented-out code, unreachable branches, or unused imports. All three modules are imported and used.

### Premature abstraction — FAIL

**`getExtensions` (`extension-registry.mjs:9–14`):** Private function with 1 call site (line 29). Body is a 3-line lazy-init check that could be inlined into `fireExtension` without loss of readability.

**`recordFailure` (`extension-runner.mjs:18–20`):** Private function with 1 call site (line 40 in `runHook`). Body is a single statement: `_failures.set(name, (_failures.get(name) ?? 0) + 1)`. Naming overhead outweighs the value.

**`safePath` (`extension-loader.mjs:22–28`):** Private function with 1 call site (line 49). The traversal check is security-relevant, but a single inline comment achieves the same legibility without the function boundary.

### Unnecessary indirection — PASS
No wrapper-only delegates. Each module transforms its inputs.

### Gold-plating — PASS
`phase: "build"` (run.mjs:1163) is a low-cost string field. Not architectural gold-plating.

### Cognitive load — WARN
`test/extension-system.test.mjs:199–268` ("promptAppend brief integration") reproduces the append loop verbatim from `run.mjs`. A reader must mentally diff the copy against the source to understand coverage gaps. Aligns with Tester 🟡.

## Findings

🔴 `bin/lib/extension-registry.mjs:9` — `getExtensions` private function used at 1 call site; inline the 3-line lazy-init check directly into `fireExtension`

🔴 `bin/lib/extension-runner.mjs:18` — `recordFailure` private function used at 1 call site; inline `_failures.set(name, (_failures.get(name) ?? 0) + 1)` into the `catch` block

🔴 `bin/lib/extension-loader.mjs:22` — `safePath` private function used at 1 call site; inline the traversal check at line 49 with a `// prevent directory traversal` comment

🟡 `test/extension-system.test.mjs:199` — append loop duplicated inline instead of exercising the real `run.mjs` path; change to filter or separator in `run.mjs` won't be caught (aligns with Tester 🟡)

## Summary

Three private helper functions extracted at exactly one call site each. None carry enough complexity to justify the indirection — they add function-boundary overhead without improving comprehension. All three fixes are mechanical: delete the function, inline 1–3 lines, add a comment where needed. No architectural changes required.

---

# Tester Re-Review — extension-system / task-1 (run_2)

**Reviewer role:** Tester
**Date:** 2026-04-26
**Verdict:** PASS

---

## What Changed in run_2

Builder inlined three single-call-site private helpers (`getExtensions`, `recordFailure`, `safePath`) and changed the `null` filter in `fireExtension` from `!== null` (strict) to `!= null` (loose equality) to also exclude `undefined` hook returns.

## Files Actually Read

- `bin/lib/extension-loader.mjs` (60 lines — `safePath` inlined at line 40–45, confirmed)
- `bin/lib/extension-runner.mjs` (39 lines — `recordFailure` inlined at line 36, confirmed)
- `bin/lib/extension-registry.mjs` (33 lines — lazy-init inlined in `fireExtension`, `result != null` filter at line 30, confirmed)
- `test/extension-system.test.mjs` (268 lines — unchanged from run_1)
- `.team/features/extension-system/tasks/task-1/handshake.json`

---

## Per-Criterion Results

### 1. Inlining refactors are behavior-preserving — PASS

**Evidence traced:**
- `extension-registry.mjs:23–25` — lazy-init check is textually identical to the old `getExtensions` body; no logic change.
- `extension-runner.mjs:36` — `_failures.set(name, (_failures.get(name) ?? 0) + 1)` matches the old `recordFailure` body exactly.
- `extension-loader.mjs:40–45` — traversal check preserved with `// prevent directory traversal` comment; condition `full.startsWith(base + sep) || full === base` unchanged.

All 14 existing tests still pass (per gate output). The refactors introduce no new behavioral risk.

### 2. `result != null` fix is correct but untested — GAP

**Evidence:** `extension-registry.mjs:30` now uses loose equality (`!= null`), which correctly excludes both `null` and `undefined`. The fix was motivated by the Engineer's finding that a hook returning nothing passes `undefined` through to `fireExtension`. **No test was added** to assert that a hook returning `undefined` is excluded from results. The correct behavior is implemented but a regression to `!== null` would be undetected by the test suite.

### 3. Previously-flagged gaps remain open — CARRIED

All four 🟡 warnings from the run_1 Tester eval remain unaddressed (run_2 scope was simplicity only; this is expected):
- No tests for `loadExtensions` (traversal guard, manifest validation, import errors)
- No test for 5-second timeout path
- Integration tests reproduce append logic inline rather than exercising `run.mjs`
- Build-phase-only scope of `promptAppend` undocumented and untested

---

## Findings

🟡 `test/extension-system.test.mjs` — No test for a hook that returns `undefined`; the `!= null` fix in `extension-registry.mjs:30` is untested — add a case to "skips null results" describe block with a hook that returns `undefined` explicitly

🟡 `test/extension-system.test.mjs` — No tests for `loadExtensions`: `safePath` traversal guard (now inlined at loader:40–45), `isValidExtension` manifest check (loader:8–18), and import error handling are zero-coverage security-relevant paths; add a `describe("loadExtensions")` block using temp dirs

🟡 `bin/lib/extension-runner.mjs:4` — 5-second timeout declared and used but never verified by any test; add a test with a hook that hangs beyond `TIMEOUT_MS` (using fake timers or an AbortController stub) to confirm `null` is returned and failure counter increments

🟡 `test/extension-system.test.mjs:198` — "promptAppend brief integration" tests reproduce the append loop inline; a change to separator or filter logic in `run.mjs:1162–1169` won't be caught; label clearly as logic-unit tests or add a separate test that imports and calls the actual `run.mjs` path

---

## Summary

The run_2 refactors are clean and behavior-preserving; all 14 tests continue to pass. One new minor gap: the `!= null` loose-equality fix is unverified. All four run_1 test coverage warnings remain in backlog. No critical findings; PASS.

---

# Simplicity Re-Review — extension-system / task-1 (run_2)

**Reviewer role:** Simplicity Reviewer
**Date:** 2026-04-26
**Verdict: FAIL**

## Builder Claim Verification

Handshake (run_2) claims three inlinings were done plus a `null` filter tightening. Verified against source:

| Claim | File | Evidence | Status |
|---|---|---|---|
| `getExtensions` inlined | `extension-registry.mjs` | No such function; lazy-init at line 23–25 of `fireExtension` | ✓ |
| `recordFailure` inlined | `extension-runner.mjs` | No such function; `_failures.set(...)` inline at line 36 | ✓ |
| `safePath` inlined | `extension-loader.mjs` | No such function; traversal check inline at lines 41–44 with comment | ✓ |
| `result != null` loose equality | `extension-registry.mjs:30` | `if (result != null)` confirmed | ✓ |

All four claimed fixes are present and correct.

## Files Actually Read

- `bin/lib/extension-loader.mjs` (60 lines, full)
- `bin/lib/extension-runner.mjs` (39 lines, full)
- `bin/lib/extension-registry.mjs` (33 lines, full)
- `bin/lib/run.mjs` (lines 1150–1190)
- `test/extension-system.test.mjs` (268 lines, full)
- `.team/features/extension-system/tasks/task-1/handshake.json`
- `.team/features/extension-system/tasks/task-1/eval.md` (prior reviews)

## Per-Criterion Results

### Dead code — PASS

No commented-out code, unreachable branches, or unused imports in the three modified files.

### Premature abstraction — FAIL

The three previously-flagged private helpers are gone. One remains unflagged from run_1:

**`isValidExtension` (`extension-loader.mjs:8–19`):** Private unexported function. Single call site at line 50. The 8-condition boolean predicate (`ext !== null`, `typeof ext === "object"`, `typeof ext.name === "string"`, `ext.name.length > 0`, `typeof ext.version === "string"`, `Array.isArray(ext.capabilities)`, `typeof ext.hooks === "object"`, `ext.hooks !== null`) fits in a single `if` with a `// validate extension manifest` comment. Naming overhead outweighs value at 1 call site.

### Unnecessary indirection — PASS

No wrapper-only delegates post-inlining. Each module transforms its inputs.

### Gold-plating — PASS

No config options with a single possible value; no speculative extensibility.

### Cognitive load — WARN (carried)

`test/extension-system.test.mjs:199–268` still reproduces the `run.mjs` append loop inline. Unchanged from run_1; still in backlog.

## Findings

🔴 `bin/lib/extension-loader.mjs:8` — `isValidExtension` private function has 1 call site (line 50); inline the 8-condition predicate directly into the `if` at line 50 with a `// validate extension manifest` comment

🟡 `test/extension-system.test.mjs:199` — append loop still duplicated inline from `run.mjs`; carried from run_1 backlog; unchanged

## Summary

The three run_1 🔴 fixes are confirmed present and behavior-preserving. One pre-existing private function at a single call site (`isValidExtension`) was missed by the run_1 reviewer and remains unfixed. Mechanical fix: delete the function, inline the compound condition, add a comment. All other simplicity criteria pass.

---

# Engineer Review — extension-system / task-1

**Reviewer role:** Engineer (implementation correctness, code quality, error handling, performance)
**Date:** 2026-04-26
**Verdict: PASS**

## Files Actually Read

- `bin/lib/extension-loader.mjs` (65 lines)
- `bin/lib/extension-runner.mjs` (43 lines)
- `bin/lib/extension-registry.mjs` (37 lines)
- `bin/lib/run.mjs` (full file, focused on lines 1157–1177 and all `dispatchToAgent` call sites)
- `test/extension-system.test.mjs` (268 lines)
- `.team/features/extension-system/tasks/task-1/handshake.json`

## Per-Criterion Results

### Correctness — PASS

**Logic path traced end-to-end (build phase, happy path)**:
1. `buildTaskBrief(...)` produces `brief` (`run.mjs:1158`)
2. `fireExtension("promptAppend", { prompt: brief, taskId: task.id, phase: "build" }, cwd)` fans out to all extensions declaring the capability (`extension-registry.mjs:28–37`)
3. Each non-null result with a non-empty string `.append` field is concatenated with `\n\n` (`run.mjs:1163–1169`)
4. `effectiveBrief` is passed to `dispatchToAgent(agent, effectiveBrief, cwd)` or `dispatchManual(effectiveBrief)` (`run.mjs:1174, 1176`)

**Edge cases verified against source**:
- Empty/whitespace `.append` → `.trim()` truthiness guard prevents concatenation ✓
- Non-string `.append` → `typeof r.append === "string"` check ✓
- Hook throws → `runHook` catch swallows, records failure, returns `null`; `fireExtension` filters `null` ✓
- `fireExtension` itself throws → outer try/catch at `run.mjs:1162` preserves `effectiveBrief = brief` ✓
- No extensions registered → `setExtensions([])` → `fireExtension` returns `[]` → loop body skips → `effectiveBrief === brief` ✓
- Circuit-broken extension → `isCircuitBroken(name)` returns early with `null` before hook invoked ✓

**Tests confirm all paths**: 14/14 pass (confirmed by live run).

### Code Quality — PASS with warnings

Clean three-module split. Naming is accurate. The outer `try/catch` in `run.mjs` with its explanatory comment is appropriate defensive design.

**Warning 1 — inconsistent `null`/`undefined` contract**: `runHook` explicitly returns `null` for all failure paths, but the success path (`return result`, line 38) passes through `undefined` if the hook returns nothing. `fireExtension` filters `result !== null` — strict equality means `undefined` enters the results array. The `run.mjs` guard `if (r && ...)` catches this, but the two-layer inconsistency is a latent quality issue.

**Warning 2 — singleton `cwd` silently ignored after first call**: `extension-registry.mjs:9–13` only uses `cwd` when `_extensions === null`. A second call with a different `cwd` silently reuses the first result. In the current architecture (worktrees share git-tracked `.team/extensions/` content), practical impact is zero, but the API contract is misleading. The `cwd` parameter should be documented as "only honored on first call" or the cache should be keyed on `cwd`.

### Error Handling — PASS

All three layers are correctly wired:
- `loadExtensions`: per-file `import()` failures silently skipped; per-directory `readdirSync` failures caught ✓
- `runHook`: timeout via `Promise.race`; all sync/async hook exceptions caught; `null` returned on any failure ✓
- `fireExtension`: designed never to throw; errors absorbed by `runHook` ✓
- `run.mjs:1162`: outer `try/catch` as final safety net ✓

Circuit-breaker increments on both throws and timeouts (timeout rejects → falls into catch → `recordFailure(name)` called). Verified in test "circuit-breaks after 3 consecutive failures."

### Performance — PASS with suggestion

**Dangling timer on successful hook**: `extension-runner.mjs:31–33` creates a `setTimeout` that is never cancelled when the hook resolves first. `Promise.race` absorbs the eventual rejection (no unhandled rejection warning), but the timer reference stays live for 5 seconds per successful hook invocation. With N extensions and M tasks, this is N×M live timers overlapping. At typical scales this is negligible, but a `clearTimeout` call on success is the correct fix.

No N+1 query patterns. No blocking I/O in the hot path (loader is one-time; runner is the single async hook call).

## Findings

🟡 `bin/lib/extension-runner.mjs:38` — `return result` passes through `undefined` when a hook returns nothing; `fireExtension`'s `!== null` filter lets it through; downstream `r &&` in run.mjs happens to guard it, but the contract is inconsistent — change filter to `result != null` (loose equality) in `fireExtension:33` to treat both `null` and `undefined` as "no output"

🟡 `bin/lib/extension-registry.mjs:9` — `cwd` parameter is only honoured on first call; subsequent calls with a different `cwd` silently reuse cached extensions — add a comment documenting the single-cwd invariant, or reset the registry at the start of `_runSingleFeature` (analogous to `resetRunUsage()` at `run.mjs:784`)

🔵 `bin/lib/extension-runner.mjs:31` — `setTimeout` not cleared when hook resolves before timeout; add `clearTimeout` via a `finally` block or store the timer ID and clear it after `Promise.race` resolves to avoid accumulating live timers

🔵 `test/extension-system.test.mjs:1` — `extension-loader.mjs` has zero test coverage; `safePath()` directory traversal guard and `isValidExtension()` manifest check are untested paths; add a `describe("loadExtensions")` block with a mock filesystem or temp dir

## Summary

The implementation is correct. The core contract — build-phase brief is enriched by extension output before dispatch — is implemented accurately and protected by a three-layer error boundary. 14/14 tests pass against live execution. Two warnings (inconsistent null/undefined contract, misleading cwd cache parameter) should be backlogged. No critical issues.

---

# Product Manager Review — extension-system / promptAppend hook

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Verdict:** PASS (with backlog items)

## Files Actually Read

- `.team/features/extension-system/tasks/task-1/handshake.json`
- `bin/lib/extension-registry.mjs` (34 lines, full)
- `bin/lib/extension-runner.mjs` (39 lines, full)
- `bin/lib/extension-loader.mjs` (60 lines, full)
- `bin/lib/run.mjs` lines 1155–1177 and all `dispatchToAgent` call sites (grep)
- Glob scans for `EXTENSIONS.md` and any spec file under `.team/features/extension-system/`

## Per-Criterion Results

### Core requirement delivered — PASS

**Evidence:** `run.mjs:1160–1174` — after `buildTaskBrief()` produces `brief`, `fireExtension("promptAppend", ...)` is called; results with a non-empty string `.append` field are concatenated into `effectiveBrief` which is then passed to `dispatchToAgent(agent, effectiveBrief, cwd)` or `dispatchManual(effectiveBrief)`. The append loop is wrapped in `try/catch` so extension errors cannot break the pipeline. Core contract is met.

### Handshake claims vs. artifacts — PASS

Three claimed artifacts (`extension-loader.mjs`, `extension-runner.mjs`, `extension-registry.mjs`) all exist. Gate output shows tests pass. Simplicity fixes claimed in run_2 summary (inlining `getExtensions`, `recordFailure`, `safePath`) are confirmed in the current source — none of those single-call-site helpers appear in the final code.

### Scope: "before dispatchToAgent()" — GAP

The stated feature is "`promptAppend` return string is appended to the agent brief before `dispatchToAgent()`" with no phase qualifier. Four other `dispatchToAgent()` call sites are present:
- `run.mjs:1083` — brainstorm dispatch
- `run.mjs:1231` — review dispatch
- `run.mjs:1419` — replan dispatch
- `run.mjs:1469` — replan dispatch

None invoke `fireExtension`. Whether build-only scope is intentional is undocumented. No spec file exists to verify intent.

→ Backlog: document whether build-only is by design; if yes, update the feature title/description; if no, extend hook to remaining dispatch sites.

### Extension authoring contract documented — FAIL

Extensions must export `{ append: string }` from their `promptAppend` hook. This contract appears nowhere: no `EXTENSIONS.md`, no JSDoc on `fireExtension`, no README section. An extension author has no discoverable interface definition — they must read `run.mjs:1165` to infer the return shape.

→ Backlog: add `EXTENSIONS.md` or JSDoc covering hook name, payload shape `{ prompt, taskId, phase }`, expected return `{ append: string }`, and an example extension.

### Spec present for acceptance verification — MISSING

No `spec.md` in `.team/features/extension-system/`. Acceptance criteria were reconstructed from the commit message and handshake summary. The scope ambiguity above cannot be resolved against an agreed document.

→ Process gap: require `spec.md` before task dispatch at sprint-init for future features.

### Test-utility export in production API surface — FLAGGED

`extension-registry.mjs:15` — `setExtensions()` is exported from the production module with the comment "used in tests to bypass disk scan." A test fixture is part of the module's public surface; nothing prevents production callers (or extensions themselves) from importing and calling it.

→ Backlog: guard with `if (process.env.NODE_ENV === "test")` or relocate to a test-helper file.

## Findings

🟡 `bin/lib/run.mjs:1163` — `promptAppend` fires only for the build phase; `run.mjs:1083` (brainstorm), `1231` (review), `1419` and `1469` (replan) call `dispatchToAgent()` without the hook; document build-only intent or extend coverage to all dispatch sites
🟡 `bin/lib/extension-registry.mjs:15` — `setExtensions()` is a test utility exported from production code; guard with `NODE_ENV === "test"` or relocate to prevent production callers from using it
🟡 `bin/lib/extension-registry.mjs:1` — Extension return contract `{ append: string }` is undocumented; add JSDoc on `fireExtension` or create `EXTENSIONS.md` with hook name, payload shape, return type, and example
🔵 `.team/features/extension-system/` — No `spec.md` present; acceptance criteria cannot be verified against an agreed document; require spec at sprint-init for future features

---

# Architect Eval — extension-system / task-1 / run_2 (simplicity fixes)

**Reviewer role:** Architect
**Date:** 2026-04-26
**Verdict: PASS**

## Files Actually Read

- `bin/lib/extension-loader.mjs` (60 lines — full)
- `bin/lib/extension-runner.mjs` (39 lines — full)
- `bin/lib/extension-registry.mjs` (33 lines — full)
- `bin/lib/run.mjs` (lines 1–30, 1140–1177, all `dispatchToAgent`/`fireExtension` call sites via grep)
- `test/extension-system.test.mjs` (268 lines — full)
- `.team/features/extension-system/tasks/task-1/handshake.json`

## Builder Claims vs. Evidence

| Claim | Evidence | Status |
|---|---|---|
| `getExtensions` inlined into `fireExtension` | `extension-registry.mjs:22–25`: lazy-init check is directly inside `fireExtension`; no separate function exists | ✓ |
| `recordFailure` inlined into catch block | `extension-runner.mjs:35–37`: catch block directly does `_failures.set(name, (_failures.get(name) ?? 0) + 1)` | ✓ |
| `safePath` inlined at its call site | `extension-loader.mjs:40–45`: inline traversal check with `// prevent directory traversal` comment | ✓ |
| `result != null` loose equality | `extension-registry.mjs:30`: `if (result != null) results.push(result)` — excludes both null and undefined | ✓ |

## Per-Criterion Results

### Module decomposition — PASS (unchanged)

Three modules with the same clean single-responsibility split as the prior review. Inlining the three helpers reduced function-boundary overhead without blurring responsibility. `extension-registry.mjs` is now 33 lines; all three modules are readable end-to-end in one pass.

### Prior 🟡 resolved: `cwd` singleton invariant — PASS

`extension-registry.mjs:7` now carries: `// Single-cwd invariant: extensions are loaded once per process; all calls must share the same cwd.` The architectural contract is documented at the module boundary. No code change was needed given the current single-process model.

### Prior 🟡 resolved: `result != null` filter — PASS

`fireExtension:30` now uses loose equality, correctly excluding both `null` (explicit failure return) and `undefined` (hook returns nothing). The prior two-layer inconsistency between `runHook`'s return contract and `fireExtension`'s filter is eliminated.

### Circuit-breaker lifespan undocumented — NOTE

`extension-runner.mjs:8`: `const _failures = new Map()` is module-level process state. `run.mjs` imports only `fireExtension` — it never calls `resetCircuitBreakers()` between feature iterations. A flaky extension that trips the breaker in feature A is silenced for features B and C in the same `agt run` process. Unlike `_extensions` — which carries an explicit single-cwd comment — `_failures` has no lifespan documentation. If session-wide silencing is intentional (the likely correct behavior), a comment analogous to the `_extensions` invariant should say so.

### Prior 🔵 still open: `setTimeout` not cleared — NOTE

`extension-runner.mjs:27–28`: the rejection timer is still not cleared when the hook resolves before 5 s. No functional impact at current call volumes; carried from prior review.

### Prior 🔵 still open: `phase: "build"` undocumented boundary — NOTE

`run.mjs:1163`: `phase: "build"` is passed in the payload with no comment documenting that `promptAppend` fires only in the build loop. Carried from prior review.

## Findings

🔵 `bin/lib/extension-runner.mjs:8` — `_failures` Map has no lifespan comment; session-wide circuit-breaking (never reset between features) is undocumented — add a comment analogous to the `_extensions` cwd invariant, e.g. "session-scoped: a circuit-broken extension stays broken for the full agt run process"

🔵 `bin/lib/extension-runner.mjs:27` — `setTimeout` handle still not cleared when hook resolves before 5 s; store the ID and call `clearTimeout` in a `finally` block (carried from prior review)

🔵 `bin/lib/run.mjs:1163` — `phase: "build"` in the payload is undocumented; add a comment stating that `promptAppend` fires only at the build-phase dispatch site (carried from prior review)

## Summary

The simplicity fixes are mechanically correct and cleanly applied. All four builder claims are confirmed against source. The `result != null` tightening and `cwd` invariant comment resolve the two prior 🟡 items. No new architectural issues were introduced. Three 🔵 items remain open: session-scoped `_failures` lifespan documentation, dangling `setTimeout`, and build-only phase boundary comment. No blockers.

---

# Security Review — extension-system / task-1 / run_3 (promptAppend integration)

**Reviewer role:** Security Specialist
**Date:** 2026-04-26
**Verdict:** PASS (warnings — three carry-forward, one resolved since run_2)

## Files Actually Read

- `bin/lib/extension-loader.mjs` (57 lines — full)
- `bin/lib/extension-runner.mjs` (39 lines — full)
- `bin/lib/extension-registry.mjs` (44 lines — full)
- `bin/lib/run.mjs` (lines 282–296, 1155–1177, via grep for all fireExtension/bypassPermissions/effectiveBrief call sites)
- `.team/features/extension-system/tasks/task-1/handshake.json`
- `.team/features/extension-system/tasks/task-1/eval.md` (all prior security reviews)

No `artifacts/test-output.txt` produced by builder. Gate output supplied in review brief; all extension-system tests pass.

## Delta Since run_2 Security Review

Three warnings from prior reviews are now **resolved** in the current source:

| Prior Finding | Status | Evidence |
|---|---|---|
| `setExtensions()` exported in production with no guard | **RESOLVED** | `extension-registry.mjs:16-18` — `if (process.env.NODE_ENV !== "test") throw` |
| `\|\| full === base` dead code in traversal guard | **RESOLVED** | `extension-loader.mjs:31` — branch is gone; only `full.startsWith(base + sep)` remains |
| Extension return contract `{ append: string }` undocumented | **RESOLVED** | `extension-registry.mjs:22-32` — JSDoc added with payload and return shapes |

## Threat Model (unchanged from run_1)

Local developer CLI. Extensions are `.mjs`/`.js` files the developer places in `.team/extensions/` or `~/.team/extensions/`. No auto-download. Adversaries with write access to those directories already have arbitrary code execution — that is the intended design.

Meaningful incremental threats:
1. **Supply chain**: compromised npm package writes to `~/.team/extensions/`
2. **Tampered extension**: trusted extension injects adversarial instructions into the `bypassPermissions` agent brief
3. **Buggy extension**: unintentionally returns oversized or structured content that inflates token costs or crashes the subprocess

## Per-Criterion Results

### 1. Directory traversal prevention — PASS

**Evidence:** `extension-loader.mjs:28-32` — `normalize(join(dir, file))` compared against `normalize(dir) + sep`. The dead `|| full === base` branch flagged in run_2 has been removed; the guard is now unambiguous. Correct for Unix; `sep` is platform-sensitive.

### 2. `setExtensions()` production guard — PASS (resolved)

**Evidence:** `extension-registry.mjs:15-20` — function throws `Error("setExtensions() is only available in test environments (NODE_ENV=test)")` when `process.env.NODE_ENV !== "test"`. An in-process extension can no longer call this to replace the registry. Prior warning is closed.

### 3. Extension errors isolated from main pipeline — PASS

**Evidence:** `extension-runner.mjs:35-38` — catch swallows all errors, records failure, returns `null`. `run.mjs:1162/1169` — outer `try/catch` prevents any `fireExtension` throw from breaking the pipeline.

### 4. Type validation on appended content — PASS (incomplete — carry-forward)

**Evidence:** `run.mjs:1165` — `typeof r.append === "string"` and `.trim()` truthiness guard are present. Non-string injection is blocked. **Still no size cap.** A hook returning an unbounded string is concatenated verbatim and passed as a positional CLI argument at `run.mjs:290`. On macOS, `ARG_MAX` is ~256 KB per process argument; on Linux ~2 MB. A runaway extension can trigger `E2BIG` or balloon token costs with no bound check.

### 5. Prompt injection into bypassPermissions agent — WARNING (carry-forward)

**Evidence:** `run.mjs:1163-1174` → `run.mjs:290` — `effectiveBrief` (which may include extension-appended content) is passed as the final positional argument to `claude ... --permission-mode bypassPermissions`. No logging of appended content occurs before dispatch. A compromised extension can inject adversarial instructions that the AI agent acts on with elevated implicit authority. The fix is not to reject the brief (extension code already has arbitrary Node.js execution) but to log appended content at debug level so operators have an audit trail.

### 6. Module-execution-before-manifest-validation — WARNING (carry-forward)

**Evidence:** `extension-loader.mjs:35` — `await import(filePath)` executes all module-level code before the manifest check at lines 38-47. A supply-chain-compromised `.mjs` that passes the filename filter but fails the manifest check still runs. This is an inherent Node.js dynamic-import constraint (exports cannot be inspected without execution), but it is not documented as an accepted design boundary.

### 7. Circuit-breaker does not reset between features — NOTE

**Evidence:** `extension-runner.mjs:8` — `_failures` is module-level process state. `run.mjs` imports `fireExtension` but never calls `resetCircuitBreakers()`. A flaky extension that trips the breaker in feature A is silenced for features B and C in the same `agt run` process. Not a vulnerability — silencing a broken extension is safer than continuing — but the behavior is undocumented (noted by Architect review; minor carry-forward).

## Findings

🟡 `bin/lib/run.mjs:1165` — No size cap on `r.append`; unbounded string passed as CLI positional arg (`run.mjs:290`) risks `E2BIG` and unbounded token inflation — add a per-extension truncation cap (e.g. 10 000 chars) with a `console.warn` when truncated; carry-forward from run_1/run_2 security evals

🟡 `bin/lib/run.mjs:1163` — Extension output reaches `--permission-mode bypassPermissions` agent with no audit trail; a compromised or buggy extension can inject adversarial instructions — add a debug-level log of each appended string before dispatch (e.g. `console.debug("[extension] promptAppend from %s: %s", ext.name, r.append)`); carry-forward from run_1/run_2 security evals

🟡 `bin/lib/extension-loader.mjs:35` — `import(filePath)` executes all top-level module code before manifest validation at line 38; a supply-chain-compromised file runs even if it fails the manifest check — document as accepted design constraint with a comment; carry-forward from run_2 security eval

🔵 `bin/lib/extension-runner.mjs:27` — `setTimeout` handle not cleared when hook resolves before 5 s; add `clearTimeout` in a `finally` block to avoid accumulating live timers; carry-forward from run_1/run_2/Architect evals

## Summary

No critical findings. No new vulnerabilities introduced in this run. Three prior warnings resolved: `setExtensions()` is now test-env guarded, the dead traversal-guard branch is removed, and the extension hook contract is documented via JSDoc. Three warnings carry forward unaddressed (size cap, bypassPermissions audit trail, module-exec-before-validation documentation). The overall security posture is incrementally improved.

---

# Product Manager Review — extension-system / promptAppend hook (current state)

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Verdict:** PASS (with backlog items)

## Files Actually Read

- `.team/features/extension-system/tasks/task-1/handshake.json`
- `bin/lib/extension-registry.mjs` (44 lines, full)
- `bin/lib/extension-runner.mjs` (39 lines, full)
- `bin/lib/extension-loader.mjs` (57 lines, full)
- `bin/lib/run.mjs` lines 1155–1177 and all `dispatchToAgent`/`fireExtension` call sites (grep)
- `test/extension-system.test.mjs` (361 lines, full)
- Prior `eval.md` reviews (all rounds)
- `git log --oneline -10`

## Handshake vs. Actual State

The handshake claims `runId: "run_2"` with 4 changes (3 inlinings + `null` filter) across 3 artifacts. Git log shows 2 additional commits after that point:
- `552bb99` — inline `isValidExtension`, guard `setExtensions`, add `loadExtensions` tests
- `26ff550` — another `promptAppend` commit

Modifications to `test/extension-system.test.mjs` are not listed in the handshake artifact set despite the file growing from 268 to 361 lines. The handshake does not reflect the current delivery.

## Per-Criterion Results

### Core requirement delivered — PASS

**Evidence:** `run.mjs:1160–1177` — `fireExtension("promptAppend", ...)` fires after `buildTaskBrief()` and before `dispatchToAgent()`/`dispatchManual()`. Results with a non-empty string `.append` are concatenated into `effectiveBrief` with `"\n\n"` separator. Wrapped in `try/catch` so extensions cannot break the pipeline. Contract met.

### Handshake accuracy — GAP

Handshake claims 3 artifacts and 4 changes. Code has at minimum 2 further commits with distinct changes (isValidExtension inline, setExtensions env guard, loadExtensions test suite). `test/extension-system.test.mjs` is not listed as an artifact despite growing by 93 lines. Prior PM reviews in this file evaluated against intermediate states — the most recent prior PM review flagged `setExtensions` as unguarded, which is now resolved but not recorded in the handshake. The handshake is not a reliable record of the current delivery.

### Scope: build-phase only — GAP (carried)

The stated requirement — "`promptAppend` return string is appended to the agent brief before `dispatchToAgent()`" — has no phase qualifier. Four call sites bypass the hook:
- `run.mjs:1083` — brainstorm dispatch
- `run.mjs:1231` — review dispatch
- `run.mjs:1419` — replan dispatch
- `run.mjs:1469` — replan dispatch

No spec file exists to confirm build-only scope is intentional. Carried from all prior PM reviews.

### Extension authoring contract — PARTIALLY RESOLVED

JSDoc on `fireExtension` (`extension-registry.mjs:22–32`) now documents payload `{ prompt, taskId, phase }` and return `{ append: string }`. Prior finding about zero documentation is closed. No `EXTENSIONS.md` exists for external authors who would not read source. Adequate for in-repo contributors; insufficient for distributable extension authors.

### Test coverage for `loadExtensions` — PARTIAL (gap)

4 tests added: valid load, invalid manifest, import throws, missing directory. Missing: no test verifies that a file at a traversal path (e.g., `../../outside.mjs`) is blocked by the traversal guard at `extension-loader.mjs:31`. The traversal guard is the primary security boundary of the loader and its correctness is unverified by the test suite.

### `setExtensions()` production guard — RESOLVED

`extension-registry.mjs:16–18` now throws `Error` when `NODE_ENV !== "test"`. Prior 🟡 from multiple rounds is closed.

### Integration tests reproduce append loop inline — GAP (carried)

`test/extension-system.test.mjs:236–240, 260–264, 283–287` reproduce the `run.mjs:1164–1168` append loop verbatim. A change to separator, filter condition, or trim behavior in `run.mjs` will not be caught. Carried from prior Tester reviews.

### Spec.md — MISSING (carried)

No `spec.md` in `.team/features/extension-system/`. Acceptance criteria reconstructed from commit messages. Carried from all prior PM reviews.

## Findings

🟡 `.team/features/extension-system/tasks/task-1/handshake.json` — Handshake reflects run_2 state; at least 2 subsequent commits (`552bb99`, `26ff550`) modified the codebase and test suite without updating the handshake; `test/extension-system.test.mjs` is absent from the artifacts list despite 93 lines added; update handshake to reflect final delivery or require a closing run with an accurate summary

🟡 `bin/lib/run.mjs:1163` — `promptAppend` fires only in the build phase; `run.mjs:1083`, `1231`, `1419`, `1469` call `dispatchToAgent()` without hook invocation; document build-only intent with a comment or extend to remaining dispatch sites; carried from all prior PM reviews

🟡 `test/extension-system.test.mjs` — `loadExtensions` test suite has no traversal attempt test; `extension-loader.mjs:31` traversal guard (the primary security boundary of the loader) is unverified — add a test that attempts to load from a path outside the extensions directory and asserts it is skipped

🟡 `test/extension-system.test.mjs:236` — brief-append integration tests reproduce the `run.mjs:1164–1168` append loop inline; a change to separator, filter, or trim logic in `run.mjs` won't be caught; label clearly as logic-unit tests or add a test that exercises the actual `run.mjs` path; carried from prior Tester reviews

🔵 `bin/lib/extension-registry.mjs:1` — No `EXTENSIONS.md`; JSDoc covers in-source readers but external extension authors have no discoverable interface spec; add an `EXTENSIONS.md` with hook name, payload shape, return type, and example; carried from prior PM reviews

🔵 `.team/features/extension-system/` — No `spec.md`; acceptance criteria cannot be verified against an approved document; require `spec.md` at sprint-init for future features

## Summary

The core contract is met: `promptAppend` results are appended to the agent brief before `dispatchToAgent()`, with proper error isolation and type validation. Several prior warnings are resolved (setExtensions guard, undefined result filter, dead traversal branch, JSDoc contract). Two open scope questions remain: build-phase-only scope is undocumented, and the traversal guard is untested despite loadExtensions tests being added. The handshake is stale relative to current code — a process finding, not a correctness blocker. PASS with four backlog items.

---

# Security Review — extension-system / task-1 / run_2

**Reviewer role:** Security Specialist
**Date:** 2026-04-26
**Verdict:** PASS (warnings — three carried forward, one new)

## Files Actually Read

- `bin/lib/extension-loader.mjs` (61 lines — traversal check inlined at 40–45, dynamic import at 48, manifest check at 50)
- `bin/lib/extension-runner.mjs` (39 lines — failure recording inlined at 36, timeout race at 27–33)
- `bin/lib/extension-registry.mjs` (33 lines — lazy-init inlined, `result != null` filter at line 30, `setExtensions` at line 15)
- `bin/lib/run.mjs` (all `fireExtension`, `bypassPermissions`, `effectiveBrief` call sites via grep)
- `test/extension-system.test.mjs` (268 lines — full read)
- `.team/features/extension-system/tasks/task-1/handshake.json`
- Prior eval.md (run_1 security review findings)

No `artifacts/test-output.txt` produced. Gate output supplied in review brief; all extension-system tests pass.

## run_2 Delta (security-relevant changes only)

1. `safePath` inlined — traversal logic preserved verbatim; `|| full === base` was already in the original function, not a regression
2. `recordFailure` inlined — no security impact
3. `getExtensions` lazy-init inlined — no security impact
4. `result != null` loose equality — **security improvement**: `undefined` returned by a hook that returns nothing previously passed the `!== null` guard and entered the results array; now correctly excluded at the registry layer

## Per-Criterion Results

### Traversal prevention after inlining — PASS

**Evidence:** `extension-loader.mjs:40–45` — inlined check is behavior-identical to the former `safePath` function. `normalize(join(dir, file))` compared against `normalize(dir) + sep` correctly anchors within the directory. The `|| full === base` branch was present before inlining; it is dead code (see finding), not a new vulnerability.

### `result != null` change — SECURITY IMPROVEMENT

**Evidence:** `extension-registry.mjs:30` — loose equality now excludes both `null` and `undefined`. Removes reliance on the downstream `if (r && typeof r.append === "string")` guard in `run.mjs` as the sole defence against undefined hook returns.

### Module-execution-before-validation — NEW WARNING

**Evidence:** `extension-loader.mjs:48` — `import(filePath)` runs the module (including all top-level side effects) before `isValidExtension()` validates the manifest at line 50. A supply-chain-compromised `.mjs` in `~/.team/extensions/` executes even if its exports fail the manifest check. This is an inherent Node.js dynamic-import limitation — you cannot inspect exports without executing the module — but the implication is undocumented.

### Size cap on appended content — STILL ABSENT

**Evidence:** `run.mjs:1165–1166` — `r.append.trim()` concatenated with no length bound. Carry-forward from run_1 security eval.

### Prompt injection to bypassPermissions — STILL ABSENT

**Evidence:** `run.mjs:1163–1174` → `run.mjs:290` — extension output reaches an agent dispatched with `--permission-mode bypassPermissions` with no audit logging. Carry-forward from run_1 security eval.

### `setExtensions()` production export — STILL PRESENT

**Evidence:** `extension-registry.mjs:15` — no test/env guard. An in-process extension can call it to replace the entire registry. Carry-forward from run_1 security eval.

## Findings

🟡 `bin/lib/extension-loader.mjs:48` — `import(filePath)` executes all module-level code before `isValidExtension()` validates the manifest at line 50; a supply-chain-compromised `.mjs` in `~/.team/extensions/` runs even if it fails the manifest check — add a comment documenting this as an accepted design constraint inherent to dynamic import, or note it in extension authoring docs

🟡 `bin/lib/run.mjs:1165` — No size cap on `r.append`; unbounded string passed as final CLI arg risks ARG_MAX (`E2BIG`) and unbounded token inflation — add a per-extension truncation cap (e.g. 10 000 chars) with a warning log; carry-forward from run_1 security eval

🟡 `bin/lib/run.mjs:1163` — Extension output reaches `--permission-mode bypassPermissions` agent with no audit trail; a compromised extension can inject adversarial instructions — add debug-level logging of appended content; carry-forward from run_1 security eval

🟡 `bin/lib/extension-registry.mjs:15` — `setExtensions()` exported in production; a loaded extension can call it to replace the registry mid-run, bypassing all loader validation — move behind `process.env.NODE_ENV === "test"` guard or explicitly document that extensions are fully trusted in-process; carry-forward from run_1 security eval

🔵 `bin/lib/extension-loader.mjs:44` — `|| full === base` branch in the traversal check is dead code (`readdirSync` never returns `.`; `.mjs`/`.js` filter blocks directory-named paths) — remove the dead branch so the traversal guard cannot be misread as permitting directory imports

## Summary

No critical findings. No new vulnerabilities introduced by the run_2 inlining refactors. The `result != null` change is a minor security improvement. Three warnings carry forward unaddressed from run_1 (size cap, bypassPermissions audit trail, setExtensions production export). One new warning added: module-execution-before-manifest-validation is an inherent dynamic-import constraint that should be documented as an accepted design boundary.

---

# Engineer Review — extension-system / promptAppend hook (current state)

**Reviewer role:** Engineer (implementation correctness, code quality, error handling, performance)
**Date:** 2026-04-26
**Verdict: PASS**

## Files Actually Read

- `bin/lib/extension-loader.mjs` (57 lines — full)
- `bin/lib/extension-runner.mjs` (39 lines — full)
- `bin/lib/extension-registry.mjs` (44 lines — full)
- `bin/lib/run.mjs` (lines 1155–1184; all `fireExtension`/`dispatchToAgent` call sites via grep)
- `test/extension-system.test.mjs` (361 lines — full)
- `.team/features/extension-system/tasks/task-1/handshake.json`

## Handshake Claims vs. Current Source

| Claim (run_2) | Evidence | Status |
|---|---|---|
| `getExtensions` inlined into `fireExtension` | `extension-registry.mjs:34–36` — lazy-init directly in function body; no `getExtensions` defined | ✓ |
| `recordFailure` inlined into catch block | `extension-runner.mjs:36` — `_failures.set(...)` directly in catch; no `recordFailure` defined | ✓ |
| `safePath` inlined at single call site | `extension-loader.mjs:28–32` — traversal check inline with `// prevent directory traversal` comment | ✓ |
| `result != null` loose equality | `extension-registry.mjs:41` — `if (result != null) results.push(result)` confirmed | ✓ |

Beyond the run_2 claims, subsequent commits applied all prior actionable findings: `isValidExtension` inlined (Simplicity 🔴), `setExtensions` NODE_ENV-guarded (Security 🟡), `loadExtensions` tests added (Tester 🟡), `undefined` return test added (Tester 🟡), dead `|| full === base` branch removed (Engineer 🔵), JSDoc on `fireExtension` added (PM 🟡).

## Per-Criterion Results

### Correctness — PASS

**Logic path traced end-to-end (build phase, happy path)**:
1. `buildTaskBrief(...)` produces `brief` (`run.mjs:1158`)
2. `fireExtension("promptAppend", { prompt: brief, taskId: task.id, phase: "build" }, cwd)` fans out to all extensions declaring the capability (`extension-registry.mjs:38–43`)
3. Each non-null result with a non-empty string `.append` field is concatenated with `\n\n` (`run.mjs:1164–1168`)
4. `effectiveBrief` is passed to `dispatchToAgent(agent, effectiveBrief, cwd)` or `dispatchManual(effectiveBrief)` (`run.mjs:1174, 1176`)

**Edge cases verified against source**:
- Empty/whitespace `.append` → `.trim()` truthiness guard prevents concatenation (`run.mjs:1165`) ✓
- Non-string `.append` → `typeof r.append === "string"` check ✓
- Hook throws → `runHook` catch swallows, increments `_failures`, returns `null`; filtered by `result != null` ✓
- `fireExtension` itself throws → outer try/catch at `run.mjs:1162` preserves `effectiveBrief = brief` ✓
- No extensions registered → loop skips → `effectiveBrief === brief` ✓
- Circuit-broken extension → `isCircuitBroken(name)` at `extension-runner.mjs:21` returns early with `null` before hook invoked ✓
- Hook returns `undefined` → loose `!= null` filter correctly excludes it (`extension-registry.mjs:41`) ✓

### Code Quality — PASS with notes

**Note 1 — `_failures` session scope undocumented**: `extension-runner.mjs:7` has "Per-extension failure counters (keyed by extension name)" but does not state the map is session-scoped. `run.mjs` never calls `resetCircuitBreakers()` between feature iterations. A flaky extension that trips the breaker on feature A is silenced for features B–N in the same `agt run` process.

**Note 2 — build-only phase boundary undocumented**: `run.mjs:1163` hardcodes `phase: "build"` but no comment documents that review (`run.mjs:1231`), replan (`run.mjs:1419, 1469`), and brainstorm (`run.mjs:1083`) dispatches bypass `fireExtension` entirely.

### Error Handling — PASS

All three containment layers correctly wired:
- `runHook`: `Promise.race` timeout; all sync/async exceptions caught; `null` returned on any failure ✓
- `fireExtension`: designed never to throw; errors absorbed by `runHook` ✓
- `run.mjs:1162`: outer try/catch as final safety net ✓

Circuit-breaker increments on both throws and timeouts (timeout rejects → falls into catch → `_failures.set(...)` called). Confirmed by test "circuit-breaks after 3 consecutive failures."

### Performance — PASS with warning

`extension-runner.mjs:27-28` creates a `setTimeout` that is never cancelled when the hook resolves before 5s. `Promise.race` absorbs the eventual rejection, but the timer remains live for the full TIMEOUT_MS per successful hook invocation. With N extensions × M tasks per session this is N×M dangling timers. Negligible at typical scale; one-line fix.

### Test Coverage — PASS with gaps

**Covered:**
- `runHook`: 5/5 paths (happy path, missing hook, throw, circuit-break, reset) ✓
- `fireExtension`: 7 tests — empty, single, multi, capability filter, null filter, undefined filter, payload forward ✓
- `loadExtensions`: 4 tests — valid, invalid manifest, import throws, missing directory ✓
- Brief integration: 3 tests — concatenation, empty append, non-string append ✓

**Gap 1 — No timeout test**: `TIMEOUT_MS = 5000` is declared and used in `extension-runner.mjs:4,27-33` but no test verifies that a slow hook returns `null` and increments the failure counter.

**Gap 2 — Integration tests duplicate append loop**: `test/extension-system.test.mjs:222–291` reproduce the filter + concatenation logic inline. A change to `run.mjs:1164–1168` (separator, trim, type check) won't be caught.

## Findings

🟡 `bin/lib/extension-runner.mjs:4` — 5-second timeout declared and used but zero test coverage; no test verifies a slow hook returns `null` and increments the failure counter — add a test using fake timers or a hook stub that never resolves within TIMEOUT_MS

🟡 `test/extension-system.test.mjs:222` — "promptAppend brief integration" tests reproduce the append loop inline instead of calling the actual `run.mjs` path; changes to `run.mjs:1164–1168` (separator, filter) won't be caught — label clearly as logic-unit tests or add a separate test exercising the real code path

🔵 `bin/lib/extension-runner.mjs:27` — `setTimeout` handle not stored or cleared when hook resolves before 5s; store the ID and call `clearTimeout(tid)` in a `finally` block to avoid N×M live timers per session

🔵 `bin/lib/extension-runner.mjs:7` — `_failures` Map is session-scoped but undocumented; a circuit-broken extension stays broken for the full `agt run` process — add a comment documenting this as intentional session-wide behavior

🔵 `bin/lib/run.mjs:1163` — `phase: "build"` hardcoded with no comment; review, replan, and brainstorm dispatches bypass `fireExtension` entirely — add a comment documenting the build-only extension hook boundary

## Summary

All four run_2 claimed fixes are present and behavior-preserving. Subsequent commits resolved all prior reviewer findings that were actionable without architectural changes. The core contract is correct: build-phase brief is enriched by extension output before dispatch, protected by a three-layer error boundary. Two warnings remain (no timeout test, integration tests duplicate inline logic). Three suggestions remain open (dangling timer, session-scope comment, build-only boundary comment). No critical issues.

---

# Simplicity Review — extension-system / task-1 / run_3

**Reviewer role:** Simplicity Reviewer
**Date:** 2026-04-26
**Verdict: PASS**

## Files Actually Read

- `bin/lib/extension-loader.mjs` (57 lines — full)
- `bin/lib/extension-runner.mjs` (39 lines — full)
- `bin/lib/extension-registry.mjs` (44 lines — full, including JSDoc)
- `bin/lib/run.mjs` (lines 1150–1177 + grep for all `fireExtension` call sites)
- `test/extension-system.test.mjs` (361 lines — full)
- `.team/features/extension-system/tasks/task-1/handshake.json`

## Handshake vs. Code Reconciliation

The handshake describes run_2 (three inlinings + `!= null` fix). The code on disk reflects subsequent commits (`552bb99`, `26ff550`): `isValidExtension` inlined, `|| full === base` removed, `setExtensions()` guarded by NODE_ENV, JSDoc added on `fireExtension`, `loadExtensions` tests added, `undefined` return test added. Reviewing the current code state.

## Per-Criterion Results

### Dead code — PASS

No commented-out code, unreachable branches, or unused imports.
- `|| full === base` dead branch noted in run_2 is **gone**: `loader:31` is now `full.startsWith(base + sep) ? full : null` with no dead OR. ✓
- All exports consumed: `fireExtension` in `run.mjs:26`; `runHook`/`isCircuitBroken`/`resetCircuitBreakers` in tests; `loadExtensions`/`resetRegistry`/`setExtensions` in tests. No export is uncalled.

### Premature abstraction — PASS

All prior single-call-site private helpers are gone:
- `getExtensions` — inlined into `fireExtension` (run_2). ✓
- `recordFailure` — inlined into catch block (run_2). ✓
- `safePath` — inlined with comment (run_2). ✓
- `isValidExtension` — inlined as compound `if` with `// validate extension manifest` comment (run_3). ✓

Remaining functions pass the 2-call-site bar:
- `isCircuitBroken`: 1 internal call (`runHook:21`) + 3 test call sites. Justified exported predicate for testability.
- `resetCircuitBreakers`, `resetRegistry`, `setExtensions`: test utilities with multiple test call sites each.

### Unnecessary indirection — PASS

No wrapper-only delegates. Each module transforms its inputs. Three-module split is genuine responsibility separation.

### Gold-plating — PASS

`phase: "build"` is a contextual payload field documented in JSDoc at `registry:27`. It enables extensions to conditionally branch by phase. Not a config option or feature flag. Not gold-plating.

### Cognitive load — WARN (carried)

`test/extension-system.test.mjs:236–264` — The "promptAppend brief integration" tests reproduce the append loop inline (the `for (const r of appendResults)` block with `typeof r.append === "string"` and `r.append.trim()` guards) rather than calling `run.mjs:1164–1168` directly. A change to the separator, trim logic, or type guard in the real code won't be caught. Carried unchanged from run_1 and run_2.

## Findings

🟡 `test/extension-system.test.mjs:236` — Append loop duplicated inline from `run.mjs:1164–1168`; regression in separator or filter logic in production won't be caught; label as logic-unit tests or add a test exercising the actual `run.mjs` path (carried from run_1 / run_2 backlog)

## Summary

All prior simplicity 🔴 findings are confirmed resolved. No dead code, no premature abstractions, no unnecessary indirection, no gold-plating. One carried 🟡 (integration test append loop duplication) remains in the backlog. No blockers.

---

# Tester Review — extension-system / task-1 / run_3 (post-loadExtensions tests)

**Reviewer role:** Tester
**Date:** 2026-04-26
**Verdict:** PASS (with warnings)

---

## Files Actually Read

- `test/extension-system.test.mjs` (362 lines — full)
- `bin/lib/extension-runner.mjs` (39 lines — full)
- `bin/lib/extension-registry.mjs` (44 lines — full)
- `bin/lib/extension-loader.mjs` (57 lines — full)
- `bin/lib/run.mjs` (lines 1155–1184 — integration point)
- `.team/features/extension-system/tasks/task-1/handshake.json`
- `.team/features/extension-system/tasks/task-1/eval.md` (all prior reviews)

---

## Handshake vs. Evidence

| Claim | Evidence | Result |
|---|---|---|
| Artifacts exist on disk | `extension-loader.mjs`, `extension-runner.mjs`, `extension-registry.mjs` all present | ✓ |
| Inlinings complete (`getExtensions`, `recordFailure`, `safePath`) | None of these functions appear in source; lazy-init at registry:34, `_failures.set` at runner:36, traversal check at loader:27–32 | ✓ |
| `result != null` loose-equality filter | `extension-registry.mjs:41`: `if (result != null)` confirmed | ✓ |
| `artifacts/test-output.txt` | Absent — gate output supplied in review brief | N/A |

**State delta since run_2 Tester Re-Review:** `loadExtensions` tests added (4 cases); `setExtensions` guarded behind `NODE_ENV !== "test"` — both gaps from the run_2 tester review are resolved.

---

## Per-Criterion Results

### 1. Core contract: `promptAppend` appended to brief before `dispatchToAgent` — PASS

**Evidence:** `run.mjs:1160–1174` — `fireExtension("promptAppend", ...)` fires after `buildTaskBrief()` and before `dispatchToAgent(agent, effectiveBrief, cwd)`. `effectiveBrief` defaults to `brief`; the extension block is wrapped in `try/catch`.

### 2. Unit tests for `runHook` — PASS

**Evidence:** `test/extension-system.test.mjs:15–84` — five cases: happy path, missing hook, throws + null return, circuit-break at 3 failures, `resetCircuitBreakers`. All branch paths covered.

### 3. Unit tests for `fireExtension` / registry — PASS

**Evidence:** `test/extension-system.test.mjs:88–211` — seven cases including the new "skips undefined results" test (lines 172–190) that was absent in run_2.

### 4. `loadExtensions` coverage — PARTIAL

**Evidence:** `test/extension-system.test.mjs:296–361` — four cases added. **Gap 1:** no test for traversal guard at `extension-loader.mjs:31` — the guard is effectively unreachable (`readdirSync` returns bare filenames that cannot contain `/`), so it is dead code with no testable contract. **Gap 2:** no test for extension whose default export is `null` (covers `ext !== null` at loader:39).

### 5. Timeout behavior — FAIL (gap)

**Evidence:** `extension-runner.mjs:4` declares `TIMEOUT_MS = 5000`; runner:27–33 races against it. No test exercises the timeout branch. "Slow hook returns null and records failure" is entirely untested — a regression here is invisible.

### 6. Integration tests copy `run.mjs` logic inline — FAIL (gap)

**Evidence:** `test/extension-system.test.mjs:235–240` reproduces `run.mjs:1163–1168` verbatim: same `"\n\n"` separator, same `.trim()` guard, same `typeof r.append === "string"` check. A change to any of these in `run.mjs` leaves these tests green while the real behavior diverges.

### 7. Build-phase-only scope — undocumented, untested

**Evidence:** `run.mjs:1083` (brainstorm), `1231` (review), `1419/1469` (replan) call `dispatchToAgent()` without `fireExtension`. No comment documents this as intentional; no test asserts the boundary.

### 8. Session-wide circuit-breaker lifespan — undocumented, untested

**Evidence:** `extension-runner.mjs:8` — `_failures` is module-level; `run.mjs` never calls `resetCircuitBreakers()` between feature iterations. A flaky extension that trips the breaker in feature A is silenced for the rest of the session. Undocumented and untested.

---

## Findings

🟡 `bin/lib/extension-runner.mjs:4` — 5-second timeout is a named design feature with zero tests; add a test using fake timers or a never-resolving hook stub to confirm the timeout branch returns `null` and increments the failure counter

🟡 `test/extension-system.test.mjs:235` — "promptAppend brief integration" tests reproduce the `run.mjs:1163–1168` append loop verbatim; a separator or filter change in `run.mjs` won't be caught; label these as registry-API unit tests or replace with a test exercising the actual `run.mjs` code path

🟡 `bin/lib/run.mjs:1163` — `promptAppend` fires only at the build-phase dispatch site; brainstorm (`1083`), review (`1231`), and replan (`1419/1469`) dispatches bypass extensions; document build-only intent with a comment and add a test asserting the boundary if deliberate

🟡 `bin/lib/extension-runner.mjs:8` — `_failures` Map is session-global but undocumented; a circuit-broken extension is silenced for the full `agt run` process; add a comment documenting this as intentional session-wide behavior (or add `resetCircuitBreakers()` to the outer loop if per-feature isolation is desired) and add a test verifying the expected lifespan

🔵 `bin/lib/extension-loader.mjs:31` — traversal guard is unreachable: `readdirSync` returns bare filenames that cannot contain path separators, so `full` can never fail `startsWith(base + sep)`; remove the dead guard or add a comment explaining it defends against future path-construction changes

🔵 `test/extension-system.test.mjs` (loadExtensions) — no test for extension with `null` default export (covers `ext !== null` at `extension-loader.mjs:39`); add one case to the describe block

---

## Summary

Core contract is correctly implemented and main unit tests are solid. Prior gaps (zero loader coverage, unguarded `setExtensions` export) are resolved. Four 🟡 warnings remain: timeout path untested, integration tests duplicate logic inline, build-phase boundary undocumented, session-scoped circuit-breaker undocumented. Two 🔵 minor suggestions. No critical blockers.

---

# Architect Review — extension-system / task-1 (promptAppend integration)

**Reviewer role:** Architect
**Date:** 2026-04-26
**Verdict: PASS**

## Files Actually Read

- `bin/lib/extension-loader.mjs` (60 lines — full)
- `bin/lib/extension-runner.mjs` (39 lines — full)
- `bin/lib/extension-registry.mjs` (44 lines — full)
- `bin/lib/run.mjs` lines 1079–1090 and 1150–1177, all `fireExtension`/`dispatchToAgent` call sites (via grep)
- `test/extension-system.test.mjs` (362 lines — full)
- `.team/features/extension-system/tasks/task-1/handshake.json`
- `.team/features/extension-system/tasks/task-1/eval.md` (all prior reviews)

## Builder Claims vs. Evidence

| Claim | Evidence | Status |
|---|---|---|
| `promptAppend` return appended to brief before `dispatchToAgent` | `run.mjs:1160–1174`: `fireExtension` called after `buildTaskBrief`, result concatenated into `effectiveBrief`, passed to both `dispatchToAgent` and `dispatchManual` | ✓ |
| Fault isolation: extensions cannot break pipeline | `runHook` catch at `:35`, `fireExtension` designed never to throw, outer `try/catch` at `run.mjs:1169` | ✓ |
| run_2: three single-call-site helpers inlined | No `getExtensions`, `recordFailure`, or `safePath` functions in current source; all inlined | ✓ |
| run_2: `result != null` loose equality | `extension-registry.mjs:41`: `if (result != null) results.push(result)` | ✓ |

**Discrepancy noted**: The run_2 Simplicity Re-Review flagged `isValidExtension` as still present (🔴). Evidence from actual source: no `isValidExtension` function exists — the 8-condition predicate is inlined at `extension-loader.mjs:38–49` with a `// validate extension manifest` comment. That 🔴 finding is resolved in current code.

## Per-Criterion Results

### Module decomposition — PASS

Three modules with clean single-responsibility boundaries: loader (disk scan + manifest validation, 60 lines), runner (timeout + circuit-breaker, 39 lines), registry (singleton + capability fan-out, 44 lines). `run.mjs` imports only `fireExtension` from `extension-registry.mjs`; the other two modules are internal. Dependency graph is acyclic and correct.

### Integration point — PASS

`run.mjs:1160–1174`: hook fires after `buildTaskBrief()`, before both dispatch paths (`dispatchToAgent` and `dispatchManual`). Both paths receive `effectiveBrief`. Three-layer fault containment:
1. `runHook` catch swallows per-hook errors, returns `null`
2. `fireExtension` never throws by design
3. Outer `try/catch` at `run.mjs:1162` preserves `effectiveBrief = brief` on any registry-layer failure

### Lazy-init double-initialization race — WARN

`extension-registry.mjs:34–36`:
```js
if (_extensions === null) {
  _extensions = await loadExtensions(cwd);
}
```
Node.js yields at `await`. Two concurrent callers that both enter before either resolves will both invoke `loadExtensions`, and the second assignment silently overwrites the first. Inert for the current sequential task loop in `run.mjs` — `fireExtension` has exactly one call site per task and tasks are processed sequentially. But if a caller ever wraps tasks in `Promise.all`, the race activates without any diagnostic signal. Standard fix: cache the in-flight Promise to serialize initialization:
```js
if (_extensionsPromise === null) _extensionsPromise = loadExtensions(cwd);
_extensions = await _extensionsPromise;
```

### `_failures` lifespan asymmetry — NOTE

`extension-runner.mjs:8`: `_failures` Map is module-level state. `run.mjs` never calls `resetCircuitBreakers()`. Unlike `_extensions` (which carries `// Single-cwd invariant: extensions are loaded once per process`), `_failures` has no lifespan comment. A circuit-broken extension stays silenced for the full `agt run` session across all features. If session-wide silencing is intentional, the comment should say so; if per-feature isolation is desired, `run.mjs` should call `resetCircuitBreakers()` at the feature loop boundary.

### `setTimeout` not cleared — NOTE (carried)

`extension-runner.mjs:27–33`: rejection timer never stored. When a hook resolves before 5 s the dangling timer fires into an already-settled `Promise.race` (no functional impact). Accumulates one live timer per successful hook invocation. Unchanged from prior reviews.

### `promptAppend` phase scope — NOTE (carried)

`run.mjs:1163`: `promptAppend` fires only at build-phase dispatch. Brainstorm (`1083`), review (`1231`), and replan (`1419`, `1469`) call `dispatchToAgent` directly without the hook. Undocumented. Unchanged from prior reviews.

## Findings

🟡 `bin/lib/extension-registry.mjs:34` — Lazy-init has a double-initialization race: two concurrent async callers both see `_extensions === null` and both invoke `loadExtensions`; second write silently overwrites the first. Inert for current sequential usage but activates on any `Promise.all`-style parallelism. Fix: cache the in-flight Promise — `if (!_extensionsPromise) _extensionsPromise = loadExtensions(cwd); _extensions = await _extensionsPromise`

🔵 `bin/lib/extension-runner.mjs:8` — `_failures` Map is session-scoped but carries no lifespan comment; a circuit-broken extension stays silenced for the full `agt run` process — add a comment documenting this (e.g. "session-scoped: stays broken for the full agt run process; call resetCircuitBreakers() between runs if per-feature isolation is needed") (carried from prior Architect reviews)

🔵 `bin/lib/extension-runner.mjs:27` — `setTimeout` handle not stored or cleared when hook resolves before 5 s; store the timer ID and call `clearTimeout(tid)` in a `finally` block (carried from prior Architect reviews)

🔵 `bin/lib/run.mjs:1163` — `phase: "build"` hardcoded with no comment explaining that `promptAppend` fires only at the build-phase dispatch; brainstorm, review, and replan dispatches bypass extensions entirely — add a comment documenting the deliberate scope boundary (carried from prior Architect reviews)

## Summary

Module decomposition is clean and the integration point is correctly implemented with three-layer fault containment. All builder claims verified against actual source. One new architectural finding: the lazy-init singleton has a double-initialization race under concurrent async callers — safe for today's sequential loop but a silent latent trap for any future parallelism. Three 🔵 suggestions carried from prior reviews unchanged. No critical or blocking issues.
