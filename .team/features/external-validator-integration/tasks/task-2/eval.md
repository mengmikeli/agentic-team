# Tester Eval — task-2 (TAP parser)

**Reviewer role:** Tester
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Read
- `.team/features/external-validator-integration/tasks/task-2/handshake.json`
- `bin/lib/validator-parsers.mjs` (all 116 lines)
- `test/validator-parsers.test.mjs` (all 157 lines)
- `bin/lib/gate.mjs` (all 187 lines) — checked integration

---

## Claim Verification

**Claimed:** `parseTap()` added, registered as `'tap'`, 4 tests, all 553 tests pass.

| Claim | Verified? | Evidence |
|---|---|---|
| `parseTap()` exists | YES | `validator-parsers.mjs:72` |
| Registered as `'tap'` in PARSERS | YES | `validator-parsers.mjs:109` |
| 4 tests added | YES | `test/validator-parsers.test.mjs:96–142` — exactly 4 `it(...)` blocks |
| 553 tests pass | PARTIAL | Gate output truncated before `validator-parsers.test.mjs`; unconfirmable from evidence |

---

## Test Coverage Analysis

### Core acceptance criterion: one `not ok` → one critical finding
**PASS** — `test.mjs:97–108` asserts `findings.critical === 1`, `findings.warning === 0`, `findings.suggestion === 0`, `meta.messages.length === 1`. Direct evidence.

### All-ok input → zero findings
**PASS** — `test.mjs:110–119`.

### Multiple `not ok` lines → multiple criticals
**PASS** — `test.mjs:121–131` asserts `findings.critical === 2`.

### `# TODO` excluded
**PASS** — `test.mjs:133–141` asserts `findings.critical === 0` for a `not ok 1 ... # TODO` line.

---

## Edge Cases Checked

| Edge case | Tested? | Notes |
|---|---|---|
| `# TODO` directive excluded | YES | covered |
| `# SKIP` directive excluded | NO | TAP spec: `not ok X # SKIP reason` = intentional skip, not failure. Current code at line 78 only guards `# TODO`; a SKIP line would produce a critical finding — false positive |
| Empty string input | NO | Falls through gracefully (0 findings), but untested |
| No `1..N` plan line | NO | `total` falls back to `findings.critical` — benign but untested |
| Windows CRLF line endings | NO | `split('\n')` leaves `\r` on trimmed lines; `/^not ok\b/` still matches since `\r` is at the end, not the start — benign but untested |
| `getParser('tap')` round-trip | NO | registry wire-up not exercised via `getParser` |

---

## Regression Risks

- `validator-parsers.mjs` is isolated — no other production file imports it (verified: `grep` across `bin/` returns only the definition file). No regression surface in the gate execution path.
- `parseJunitXml` tests at lines 19, 36, etc. call `parseJunitXml(xml)` with 1 argument despite the new 3-arg signature `(stdout, stderr, exitCode)`. The function ignores `stderr`/`exitCode`, so no behavioral regression, but the test signals the wrong contract to future readers.

---

## Findings

🟡 `bin/lib/validator-parsers.mjs:78` — `# SKIP` directive not excluded; `not ok X # SKIP reason` is a TAP-spec skip (not a failure) but produces one critical finding under current logic; add `!/# SKIP\b/i` guard alongside the existing `# TODO` guard and add a matching test

🔵 `test/validator-parsers.test.mjs:144` — `getParser` suite has no `'tap'` case; add `getParser('tap')` call and assert it returns `parseTap` (or assert it handles a `not ok` line correctly end-to-end)

🔵 `test/validator-parsers.test.mjs:19` — JUnit XML tests call `parseJunitXml(xml)` with 1 arg; update to `parseJunitXml(xml, "", 0)` to match the 3-arg contract that was established in task-1 and tested correctly in the TAP suite

---

# Engineer Eval — task-2 (TAP parser)

**Reviewer role:** Software Engineer
**Date:** 2026-04-26
**Verdict: PASS** (2 warnings for backlog)

---

## Files Read
- `.team/features/external-validator-integration/tasks/task-2/handshake.json`
- `bin/lib/validator-parsers.mjs` (all 116 lines)
- `test/validator-parsers.test.mjs` (all 157 lines)

---

## Correctness

**PASS — core logic.** `parseTap` (lines 72–92): splits `stdout` on `\n`, trims, applies `/^not ok\b/` anchored at line start with word-boundary (prevents false match on `ok`). Guard `!/# TODO\b/i` is case-insensitive and uses word-boundary (won't match `# TODOS`). Plan extraction `/^1\.\.(\d+)/m` uses multiline mode correctly. Return shape matches the module contract.

**FAIL on SKIP edge case.** `not ok 1 - name # SKIP reason` is a TAP-spec skip (intentionally excluded from failure counts), but the current guard only excludes `# TODO`. A SKIP line produces a false critical finding. No test covers this. This is a real correctness gap in TAP parsing — **flagged 🟡, not 🔴** because the stated task requirement was TODO-only, and SKIP is a secondary edge case, but it must go to backlog.

**PASS — multiple failures.** Iteration is correct; each matching line produces exactly one increment.

**PASS — subtest trim semantics.** Trimming before matching means indented TAP subtest lines would also be caught. Consistent with "count all not-ok" interpretation; acceptable for v1.

## Code Quality

**PASS.** Compact, readable. Consistent style with the two peer parsers. Registry entry is a direct bare reference, no wrapper lambda.

**JSDoc drift.** Both `parseJunitXml` (line 28) and `parseTap` (line 70) JSDoc document only `@param {string} stdout`. The actual signatures are `(stdout, stderr, exitCode)`. Misleading to callers but no runtime effect.

## Error Handling

**PASS.** Regex iteration over string input cannot throw. Malformed / empty input → zero findings. Consistent with `parseJunitXml` fault-tolerance.

## Test Contract

**PASS — TAP tests use 3-arg signature** (lines 102, 116, 128, 139). ✓

**MINOR — JUnit XML tests call with 1 arg** (lines 19, 36, 52, 67, 90) despite the 3-arg signature set in task-1. Not a bug — `stderr`/`exitCode` are unused — but the tests misrepresent the interface.

**GAP — `getParser("tap")` not tested.** The registry wire-up is verified by code inspection but not exercised in the test suite.

---

## Findings

🟡 bin/lib/validator-parsers.mjs:78 — `not ok … # SKIP` counted as critical; TAP spec defines SKIP as an intentional skip, not a failure. Change guard to `!/# (?:TODO|SKIP)\b/i` and add a test

🟡 test/validator-parsers.test.mjs:19 — `parseJunitXml(xml)` called with 1 arg after signature became 3-arg; update all JUnit XML call sites to `(xml, "", 0)` to accurately reflect the interface contract

🔵 test/validator-parsers.test.mjs:144 — `getParser("tap")` not tested; add a case that calls `getParser("tap")` and asserts it handles a `not ok` line correctly end-to-end

🔵 bin/lib/validator-parsers.mjs:28 — JSDoc for `parseJunitXml` missing `@param {string} stderr` and `@param {number} exitCode` after signature update in task-1

🔵 bin/lib/validator-parsers.mjs:70 — JSDoc for `parseTap` documents only `@param {string} stdout`; add the two missing param docs

---

# Simplicity Review — task-2 (TAP parser)

**Reviewer role:** Simplicity
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Read
- `bin/lib/validator-parsers.mjs` (all 116 lines)
- `test/validator-parsers.test.mjs` (all 156 lines)
- `.team/features/external-validator-integration/tasks/task-2/handshake.json`
- `.team/features/external-validator-integration/tasks/task-1/eval.md` (full history — established pre-existing patterns and prior rulings)

---

## Per-Criterion Results

### Dead code — PASS

No commented-out code. No unreachable branches. No unused imports.

`stderr` and `exitCode` are declared in `parseTap(stdout, stderr, exitCode)` at line 72 but never read in the function body. Identical situation to `parseJunitXml` (line 29), which was explicitly ruled intentional interface conformance by Simplicity run_3: the module contract at line 2 specifies all parsers accept `(stdout, stderr, exitCode)`. Not dead code — enables direct registry storage without a wrapper.

The false-branch of the `if` guard at line 78 (skipping non-`not ok` lines) is reachable; the "all ok" test (lines 110–118) exercises it.

### Premature abstraction — PASS

`parseTap` is the core feature being built, not a helper abstraction. `extractAttrs` retains 2 call sites (lines 36, 42). `getParser` retains 2 test call sites (lines 146, 151). All meet the ≥2 threshold.

### Unnecessary indirection — PASS

`"tap": parseTap` at line 109 is a bare function reference, matching `"junit-xml"` and `"exit-code"` entry style. No lambda wrapper. `getParser` adds non-trivial fallback (`|| PARSERS["exit-code"]`); not a pure delegate.

### Gold-plating — PASS

`meta: { messages }` in `parseTap` (lines 87–91) mirrors the established `parseJunitXml` pattern and is actively asserted at 4 TAP test locations (lines 106, 107, 118, 130). Not speculative. No config option with a single value; no feature flag.

---

## Findings

🔵 `test/validator-parsers.test.mjs:144` — `getParser("tap")` is never retrieved; the `"tap"` registry entry is exercised only via direct `parseTap()` calls; add `getParser("tap")(tap, "", 1)` with a real TAP input asserting `findings.critical === 1` to confirm registry wire-up (consistent with the pre-existing gap for `getParser("junit-xml")`, carried as 🔵 through task-1 reviews)

---

# Architect Review — task-2 (TAP parser)

**Reviewer role:** Architect
**Date:** 2026-04-26
**Verdict: PASS**

## Files Read
- `.team/features/external-validator-integration/tasks/task-2/handshake.json`
- `bin/lib/validator-parsers.mjs` (all 116 lines — directly read)
- `test/validator-parsers.test.mjs` (all 157 lines — directly read)
- `.team/features/external-validator-integration/tasks/task-1/eval.md` (full prior history for pattern context)
- `.team/features/external-validator-integration/tasks/task-2/eval.md` (Tester, Engineer, Simplicity sections above)

## Handshake Claims Verified

| Claim | Evidence |
|---|---|
| `parseTap(stdout, stderr, exitCode)` added | `validator-parsers.mjs:72` — confirmed |
| `"tap": parseTap` bare reference in PARSERS | `validator-parsers.mjs:109` — confirmed, no wrapper |
| 4 TAP tests added | `test/validator-parsers.test.mjs:96–142` — 4 `it()` blocks confirmed |
| 553 total tests pass | Gate output truncated before `validator-parsers.test.mjs` block; unverifiable from provided evidence |

## Architectural Assessment

### Module boundary
Clean. `parseTap` lives in the correct file, adds no imports, and touches no other module. Adding the TAP parser was a two-line registry change plus the new function — exactly the extensibility the registry pattern was designed for. Task-1's architectural investment paid off here.

### Interface contract consistency
Fully consistent. `parseTap(stdout, stderr, exitCode)` matches the module contract at line 2 and both peer parsers. The return shape `{ findings, summary, meta: { messages } }` is identical across all three parsers. A consumer using `getParser` sees a uniform interface regardless of format.

### Registry entry style
Consistent. `"tap": parseTap` is a bare function reference, matching `"junit-xml": parseJunitXml` and `"exit-code": parseExitCode`. No wrapper lambda.

### TAP spec compliance gap: `# SKIP` directive
The TAP spec defines two directives that excuse a `not ok` line from failure counting: `# TODO` and `# SKIP`. The implementation correctly excludes `# TODO` (line 78) but not `# SKIP`. A `not ok 1 - test # SKIP reason` line — emitted by `node:test` and Perl-based runners for skipped tests — produces `findings.critical++` when it should produce 0. All three prior reviewers (Tester, Engineer, Simplicity) independently identified this gap. No test covers it. This will cause false positives in practice.

### Scalability
No concerns. Single-pass `split('\n')` loop; O(n) in input size. All regex operations are bounded. Extending directive exclusions (e.g. adding `# SKIP`) is a one-line change at line 78.

### Integration status
Module still has no callers in `bin/`. The Tester confirmed this via grep across `bin/`. Inert in production. Acceptable for current task scope; must be resolved before the feature is marked shippable.

### Nested TAP (subtest lines)
`line.trim()` before the regex check means indented `not ok` lines emitted by `node:test` subtest blocks are matched. Whether nested failures should be counted is unspecified in the task. Low risk for v1; acceptable.

## Prior 🔴 Findings Status
No prior 🔴 findings exist for task-2. This is the first iteration. All task-1 blocking findings were resolved before task-2 was built.

## Findings

🟡 `bin/lib/validator-parsers.mjs:78` — `# SKIP` directive not excluded; `not ok N - test # SKIP reason` produces `findings.critical++` when it should produce 0; extend guard to `!/# (?:TODO|SKIP)\b/i` and add a test (aligns with Tester, Engineer, and Simplicity findings)

🟡 `bin/lib/validator-parsers.mjs:1` — no callers in `bin/`; module is inert in production; confirm integration task is tracked before marking feature shippable (carried from task-1)

🔵 `bin/lib/validator-parsers.mjs:65` — `parseTap` JSDoc documents only `@param {string} stdout`; function signature is `(stdout, stderr, exitCode)`; inconsistent with module contract at line 2 (aligns with Engineer finding; `parseJunitXml` at line 22 has the same gap)

🔵 `bin/lib/validator-parsers.mjs:76` — `PARSERS` exported as a mutable object; a consumer can silently overwrite parser entries; use `Object.freeze(PARSERS)` or remove the export and rely solely on `getParser` (carried from task-1 Architect run_2)


---

# Security Review — task-2 (TAP parser)

**Reviewer role:** Security
**Date:** 2026-04-26
**Verdict:** PASS (warnings to backlog — two 🟡 carried from JUnit parser, one new 🟡)

---

## Files Examined

- `bin/lib/validator-parsers.mjs` (all 116 lines — directly read)
- `test/validator-parsers.test.mjs` (all 157 lines — directly read)
- `.team/features/external-validator-integration/tasks/task-2/handshake.json`
- `.team/features/external-validator-integration/tasks/task-1/eval.md` (prior security reviews through run_3)

No `artifacts/test-output.txt` exists. Gate output is truncated before the `validator-parsers` block; handshake claims 553 tests pass and the file is listed in the `node --test` invocation.

---

## Handshake Claims Verified

| Claim | Evidence |
|---|---|
| `parseTap(stdout, stderr, exitCode)` added | `validator-parsers.mjs:72` — 3-arg signature matches module contract ✓ |
| `not ok` (non-TODO) → `findings.critical++` | `validator-parsers.mjs:78` — confirmed ✓ |
| TODO lines excluded by `/# TODO\b/i` | `validator-parsers.mjs:78` — confirmed ✓ |
| `"tap"` registered in PARSERS | `validator-parsers.mjs:109` — bare `parseTap` reference, consistent with peer entries ✓ |
| Four tests added | `test/validator-parsers.test.mjs:96–142` — one failure, all ok, multiple failures, TODO skip ✓ |

---

## Threat Model

`stdout` originates from an external TAP-producing test runner configured by the user, running against potentially untrusted codebases. A malicious repository's test script (`package.json scripts.test`, `Makefile`, etc.) can emit arbitrary lines to stdout in TAP format. Attacker-controlled content appears verbatim in every `not ok` line that passes the TODO filter.

---

## Criteria

**Secrets / credentials:** PASS — No credentials, tokens, keys, file I/O, network calls, or `eval`-equivalent. `stderr` and `exitCode` declared but unused (interface conformance); harmless.

**ReDoS:** PASS — Three regexes used:
- `/^not ok\b/` — anchored at line start, single literal; cannot backtrack. Linear.
- `/# TODO\b/i` — literal phrase plus word boundary; no quantifier on variable content. Linear.
- `/^1\.\.(\d+)/m` — anchored, `\d+` is a simple greedy digit run with no alternatives. Linear.

No catastrophic backtracking paths.

**ANSI/control-character injection:** WARN — `trimmed` (a verbatim TAP line from attacker-controlled stdout) is pushed directly to `messages[]` at line 79 with no sanitization. A crafted TAP line `not ok 1 - pwn \x1b[2J...` injects terminal escape sequences into CLI output or confuses a structured consumer of `meta.messages`. Realistic attack vector: any `package.json` test script in an untrusted repo can produce this output. Same unresolved 🟡 as JUnit parser line 49. Fix: strip `/[\x00-\x1f\x7f]/g` before `messages.push(trimmed)`.

**`# SKIP` directive not excluded:** WARN — TAP spec defines `# SKIP` on a `not ok` line as intentionally skipped, not a failure. The current implementation counts `not ok 3 - test name # SKIP reason` as a critical finding (false positive). Only `# TODO` is excluded. Fix: extend exclusion to `/# (?:TODO|SKIP)\b/i` (consistent with Tester and Engineer findings).

**False gate pass via silent parse failure:** WARN (carried from JUnit) — `findings.critical = 0` for both a clean TAP run and non-TAP stdout. No mechanism to distinguish genuine zero findings from a structural failure. A misconfigured validator silently passes the gate. Add `meta.parseWarning = true` when stdout is non-empty and no TAP structure is detected (same fix suggested at JUnit `validator-parsers.mjs:56` in security reviews run_2/run_3; unresolved in both parsers).

**Plan-line integer parsing:** PASS — `parseInt(planMatch[1], 10)` uses explicit radix 10; match group `(\d+)` guarantees a valid decimal string. No injection risk.

**Path traversal:** PASS — TAP lines used only as display strings in `meta.messages`. No filesystem operations.

---

## Prior 🔴 Findings Status

No prior 🔴 findings from task-1 remain open that apply to `parseTap`. All three task-1 blockers (dead try/catch, `<error>` unhandled, lambda indirection) were resolved in runs 2–3 before task-2 was built. `parseTap` introduces no regressions.

---

## Findings

🟡 `bin/lib/validator-parsers.mjs:79` — verbatim TAP lines (attacker-controlled) pushed to `messages[]` without stripping control characters; `not ok 1 - \x1b[2J...` injects terminal escape sequences; strip `/[\x00-\x1f\x7f]/g` before `messages.push(trimmed)` (same fix as JUnit parser line 49)

🟡 `bin/lib/validator-parsers.mjs:78` — `# SKIP` TAP directive not excluded; `not ok 3 - name # SKIP reason` produces a critical finding (false positive for intentionally skipped tests); extend exclusion to `/# (?:TODO|SKIP)\b/i` and add a test (consistent with Tester and Engineer findings)

🟡 `bin/lib/validator-parsers.mjs:84` — non-empty non-TAP stdout produces `critical=0` indistinguishable from a clean run; a misconfigured validator silently passes the gate once wired in; add `meta.parseWarning = true` when stdout is non-empty and no TAP structure is detected (carried from JUnit security reviews run_2/run_3)

🔵 `test/validator-parsers.test.mjs:144` — `getParser` describe block does not test `"tap"`; add `getParser("tap")(tapInput, "", 1)` asserting `findings.critical === 1` to verify registry wire-up end-to-end

---

# Simplicity Review (run_2) — task-2 (TAP parser)

**Reviewer role:** Simplicity
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Read
- `bin/lib/validator-parsers.mjs` (all 116 lines — current state including SKIP fix)
- `test/validator-parsers.test.mjs` (all 167 lines — current state including SKIP test and 3-arg JUnit XML calls)
- `.team/features/external-validator-integration/tasks/task-2/handshake.json`
- `.team/features/external-validator-integration/tasks/task-1/eval.md` (prior rulings, especially Simplicity run_3 on `stderr`/`exitCode` intent)
- `.team/features/external-validator-integration/tasks/task-2/eval.md` (prior Simplicity run_1 section)

## State Since Last Simplicity Review

Two changes landed after the prior Simplicity run_1 review (commit `c23a5bb`):
1. `# SKIP` exclusion added at `validator-parsers.mjs:78` — guard is now `!/# (?:TODO|SKIP)\b/i.test(trimmed)` — closing the TAP spec gap flagged by Tester, Engineer, and Architect.
2. JUnit XML test calls updated from 1-arg to 3-arg (`parseJunitXml(xml, "", 0)`) across all 6 test cases — closing the contract-misrepresentation concern raised by Engineer run_1.

Neither change introduces a simplicity regression.

---

## Per-Criterion Results

### Dead code — PASS

No commented-out code. No unreachable branches. No unused imports.

`stderr` and `exitCode` are declared in `parseTap(stdout, stderr, exitCode)` at line 72 but never read inside the body. Per the ruling established in task-1 Simplicity run_3: these are intentional interface conformance parameters that enable direct registry storage without a wrapper. Same deliberate pattern as `parseJunitXml` (line 29). Not dead code.

The false-branch at line 78 (skipping lines that don't match `not ok`) is reachable; the all-ok test (lines 110–118) and the TODO/SKIP tests exercise it.

### Premature abstraction — PASS

`parseTap` is the feature being built, not a helper abstraction. `extractAttrs` retains 2 call sites (lines 36, 42). `getParser` retains 2 call sites in tests (lines 155, 160). All meet the ≥2 threshold.

### Unnecessary indirection — PASS

`"tap": parseTap` at line 109 is a bare function reference — consistent with both peer entries (`"junit-xml": parseJunitXml`, `"exit-code": parseExitCode`). No lambda wrapper. `getParser` adds non-trivial fallback (`|| PARSERS["exit-code"]`); not a pure delegate.

### Gold-plating — PASS

`meta: { messages }` is actively asserted at multiple TAP test locations (lines 106–107, 118, 130). Not speculative. The `warning: 0` and `suggestion: 0` fields are part of the module's uniform interface contract — not standalone gold-plating. No config options with a single value. No feature flags.

---

## Findings

🔵 `test/validator-parsers.test.mjs:154` — `getParser("tap")` is never retrieved in the `getParser` describe block; registry wire-up is verified only through direct `parseTap()` calls; add `getParser("tap")(tap, "", 1)` with a `not ok` input asserting `findings.critical === 1` to confirm end-to-end registration (carried from Simplicity run_1; still open in current state)

---

# PM Eval — task-2 (TAP parser)

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Verdict: PASS**

## Files Read
- `.team/features/external-validator-integration/tasks/task-2/handshake.json`
- `bin/lib/validator-parsers.mjs` (all 116 lines)
- `test/validator-parsers.test.mjs` (all 167 lines)
- `.team/features/external-validator-integration/tasks/task-2/eval.md` (all prior review sections: Tester, Engineer, Simplicity, Architect, Security)
- git log (6 recent commits)

## Requirement Traceability

**Stated requirement:** "TAP output with one `not ok` line produces one critical finding."

| Criterion | Status | Evidence |
|---|---|---|
| One `not ok` line → `findings.critical === 1` | PASS | `validator-parsers.mjs:78`; `test.mjs:103` asserts `findings.critical === 1` exactly |
| `findings.warning === 0`, `findings.suggestion === 0` | PASS | `test.mjs:104-105` asserts both |
| `meta.messages.length === 1` with correct text | PASS | `test.mjs:106-107` asserts length and `startsWith("not ok 1")` |
| Tests registered in `npm test` | PASS | `test/validator-parsers.test.mjs` appears in the gate's `node --test` invocation |

## Post-Handshake Fix Acknowledgment

Commit `c23a5bb` ("fix: exclude # SKIP from TAP critical findings; fix JUnit XML test call signatures") was applied after the task-2 handshake was written. It resolved two issues that prior reviewers (Tester, Engineer, Architect, Security) had raised as 🟡:

1. **`# SKIP` directive exclusion**: Current code at `validator-parsers.mjs:78` uses `!/# (?:TODO|SKIP)\b/i` — both directives excluded. Test at `test.mjs:143–151` added. Prior 🟡 finding is **resolved**.
2. **JUnit XML test call signatures**: Tests now call `parseJunitXml(xml, "", 0)` with 3 args. Prior 🟡 finding is **resolved**.

Neither fix changes the core TAP acceptance criterion. Both are within scope.

## Scope Ruling on Post-Handshake Additions

The SKIP test (line 143) is the 5th TAP test; the handshake claims 4. The fix is correct and in-scope per the TAP spec. Accept. File the stale handshake as a process gap (see findings).

## Prior 🔴 Findings Status

No 🔴 findings were raised by any reviewer for task-2. The task passed all prior reviews on the first iteration (no ITERATE required).

## Findings

🟡 `.team/features/external-validator-integration/tasks/task-2/handshake.json` — Handshake claims 4 tests but current code has 5 (SKIP test added in post-handshake commit `c23a5bb`); update handshake artifacts and summary when a fix commit adds or changes artifacts, so future reviewers have accurate evidence without re-running

🟡 `bin/lib/validator-parsers.mjs:1` — No callers in `bin/`; module is inert in production; confirm integration task is tracked before marking feature shippable (carried from task-1 across all PM reviews)

---

# Security Review — task-2 (TAP parser) — run_2

**Reviewer role:** Security
**Date:** 2026-04-26
**Verdict:** PASS (two 🟡 persist to backlog; prior SKIP 🟡 resolved)

---

## Files Read

- `bin/lib/validator-parsers.mjs` (all 116 lines — directly read)
- `test/validator-parsers.test.mjs` (all 166 lines — directly read)
- `.team/features/external-validator-integration/tasks/task-2/handshake.json`
- `.team/features/external-validator-integration/tasks/task-2/eval.md` (all prior sections: Tester, Engineer, Simplicity, Architect, Security run_1, PM)
- `bin/lib/gate.mjs` (all 187 lines — call-site context)
- git log (8 commits)

---

## Prior 🟡 Status

| Prior finding | Status | Evidence |
|---|---|---|
| `# SKIP` not excluded (`validator-parsers.mjs:78`) | **RESOLVED** | Commit `c23a5bb` — line 78 now `!/# (?:TODO|SKIP)\b/i`; test at `test.mjs:143–151` added |
| Control char injection via `messages.push(trimmed)` (line 79) | **OPEN** | Line 79 still pushes `trimmed` verbatim; no sanitization added |
| Silent parse failure / no `meta.parseWarning` (line 84) | **OPEN** | No detection of non-TAP input added |

---

## Threat Model

`stdout` is captured from a shell command executed by `gate.mjs:58` via `execSync(..., { shell: true })`. The command is a user-configured test runner, but the *output* may come from code under test — including untrusted third-party repositories. A malicious test script can emit arbitrary bytes on stdout. The parsed `meta.messages` array is the primary output surface and contains verbatim test-runner output.

---

## Criteria

**Secrets / credentials:** PASS — No file I/O, network calls, credentials, or `eval` equivalent. `stderr` and `exitCode` are declared but unused (interface conformance); harmless.

**ReDoS:** PASS — All three regexes are linear:
- `/^not ok\b/` — anchored literal; no backtrack surface.
- `/# (?:TODO|SKIP)\b/i` — literal alternation with word boundary; no variable-length quantifiers on ambiguous input.
- `/^1\.\.(\d+)/m` — anchored; `\d+` is a simple greedy digit run with no alternatives.

**Control character / ANSI injection:** OPEN — `messages.push(trimmed)` at line 79 stores verbatim TAP lines without stripping control characters. A crafted test emitting `not ok 1 - pwn\x1b[2J` injects ANSI escape sequences into CLI output or corrupts structured consumers of `meta.messages`. Identical unresolved gap at JUnit parser line 49. Fix: strip `/[\x00-\x1f\x7f]/g` from `trimmed` before push. Risk is real but bounded to developer terminals and log files; not a gate-bypass.

**`# SKIP` exclusion:** PASS — Resolved by commit `c23a5bb`. Line 78 now reads `!/# (?:TODO|SKIP)\b/i.test(trimmed)`. Test at lines 143–151 asserts `findings.critical === 0` for a `not ok 1 - skipped test # SKIP` line. Direct evidence.

**Silent parse failure:** OPEN — Non-TAP stdout (e.g., a Python stack trace, JSON blob, or empty string) returns `{ findings: { critical: 0 } }` indistinguishable from a clean TAP run. Once `getParser("tap")` is wired into the gate, a misconfigured validator silently passes. No `meta.parseWarning` or structural detection has been added. Fix: set `meta.parseWarning = true` when stdout is non-empty and contains neither a `not ok` line nor a `1..N` plan line.

**`getParser` prototype bypass:** Low risk — `PARSERS[format]` at line 114 does not guard with `Object.hasOwn`. If `format` is `"__proto__"` or `"constructor"`, the lookup returns `Object.prototype` (truthy), bypasses the `|| PARSERS["exit-code"]` fallback, and causes a `TypeError` at invocation. In practice `format` comes from trusted user config; not a realistic attack vector. Flagged 🔵 for defensive hygiene.

**Path traversal:** PASS — `meta.messages` used only as display strings. No filesystem operations.

**Plan-line integer parsing:** PASS — `parseInt(planMatch[1], 10)` with explicit radix; `(\d+)` match group guarantees decimal input.

---

## Prior 🔴 Findings Status

No prior 🔴 findings from task-1 or task-2 run_1 remain open. `parseTap` introduces no regressions.

---

## Findings

🟡 `bin/lib/validator-parsers.mjs:79` — verbatim attacker-controlled TAP lines stored in `messages[]` without control-character stripping; `not ok 1 - \x1b[2J` injects ANSI escape sequences into CLI output and log consumers; strip `/[\x00-\x1f\x7f]/g` before `messages.push(trimmed)` (same fix needed at JUnit parser line 49; carried from security run_1)

🟡 `bin/lib/validator-parsers.mjs:84` — non-TAP stdout returns `critical: 0` indistinguishable from a clean TAP run; once wired in, a misconfigured `"tap"` validator silently passes the gate; add `meta.parseWarning = true` when stdout is non-empty and contains no TAP structure (carried from security run_1 and JUnit reviews)

🔵 `bin/lib/validator-parsers.mjs:114` — `PARSERS[format]` lookup has no `Object.hasOwn` guard; `format = "__proto__"` returns `Object.prototype` (truthy), bypasses exit-code fallback, and throws `TypeError` at invocation; use `Object.hasOwn(PARSERS, format) ? PARSERS[format] : PARSERS["exit-code"]`

---

# Tester Eval — task-2 run_2 (TAP parser, post-SKIP fix)

**Reviewer role:** Tester
**Date:** 2026-04-26
**Verdict: PASS**

## Files Read
- `.team/features/external-validator-integration/tasks/task-2/handshake.json`
- `bin/lib/validator-parsers.mjs` (all 116 lines)
- `test/validator-parsers.test.mjs` (all 167 lines)
- `.team/features/external-validator-integration/tasks/task-2/eval.md` (all prior run_1 and run_2 sections)

## Test Execution (direct evidence)
```
node --test test/validator-parsers.test.mjs

✔ produces one critical finding from one <failure> element
✔ produces zero findings for a passing test suite
✔ produces multiple critical findings for multiple failures
✔ falls back to classname when file/line are absent
✔ produces one critical finding from one <error> element
✔ returns zero findings on malformed input (fault-tolerant)
✔ produces one critical finding from one not ok line
✔ produces zero findings for all ok lines
✔ produces multiple critical findings for multiple not ok lines
✔ does not count # TODO lines as critical findings
✔ does not count # SKIP lines as critical findings
✔ returns junit-xml parser for 'junit-xml' format
✔ falls back to exit-code parser for unknown format

tests 13 | pass 13 | fail 0
```

## Prior run_1 Findings — Resolution Status

| Finding | Source | Status |
|---|---|---|
| `# SKIP` not excluded → false critical | Tester/Engineer/Architect/Security run_1 🟡 | **RESOLVED** — `validator-parsers.mjs:78`: `!/# (?:TODO\|SKIP)\b/i`; test at `test.mjs:143–151` |
| JUnit XML tests use 1-arg call signatures | Engineer run_1 🟡 | **RESOLVED** — all 6 JUnit XML test call sites updated to `(xml, "", 0)` |

## Per-Criterion Results

### Core acceptance criterion: one `not ok` → one critical finding
**PASS** — `test.mjs:97–108`: asserts `findings.critical === 1`, `warning === 0`, `suggestion === 0`, `meta.messages.length === 1`, and `messages[0].startsWith("not ok 1")`. Confirmed by direct test run.

### All-ok input → zero findings
**PASS** — `test.mjs:110–119`.

### Multiple `not ok` lines → multiple criticals
**PASS** — `test.mjs:121–131`: asserts `findings.critical === 2`.

### `# TODO` excluded
**PASS** — `test.mjs:133–141`.

### `# SKIP` excluded (run_2 fix)
**PASS** — `test.mjs:143–151`: asserts `findings.critical === 0` for `not ok 1 ... # SKIP`. Code at line 78 confirmed: `!/# (?:TODO|SKIP)\b/i`. Prior 🟡 closed.

### 3-arg signature conformance
**PASS** — `parseTap(stdout, stderr, exitCode)` at line 72. All 5 TAP test calls use the 3-arg form `(tap, "", 1)` or `(tap, "", 0)`.

### `getParser("tap")` registry wire-up
**PARTIAL** — `"tap": parseTap` at line 109 is a bare reference (confirmed by code inspection). No test calls `getParser("tap")` through the public API and verifies output. Risk is low given the trivial registry; wire-up is not exercised by tests.

## Edge Cases Checked

| Scenario | Result | Tested? |
|---|---|---|
| Empty string input | 0 findings, 0 total — graceful | NO |
| Missing `1..N` plan line | `total` falls back to `findings.critical` — benign | NO |
| CRLF line endings (`\r\n`) | `split('\n')` leaves `\r`; `/^not ok\b/` still matches since `\r` is at end, not start — benign | NO |
| ANSI escapes in `not ok` line text | Pushed verbatim to `meta.messages` without sanitization | NO |

## Regression Risks
- `parseTap` is self-contained. No other production file imports `validator-parsers.mjs` (verified by prior Tester review: zero callers in `bin/`). No regression surface.
- JUnit XML test updates (1-arg → 3-arg) are behaviorally identical — `stderr`/`exitCode` unused in function body. No regression.

## Findings

🔵 `test/validator-parsers.test.mjs:154` — `getParser("tap")` never called in the test suite; add `getParser("tap")(tapInput, "", 1)` asserting `findings.critical === 1` to cover registry wire-up end-to-end (carried from run_1 🔵)

🔵 `test/validator-parsers.test.mjs` — no test exercises ANSI/control characters in a `not ok` line; add a case documenting that `meta.messages[0]` contains the raw line, or add stripping and a test to confirm sanitization (aligns with Security 🟡 carried from run_1)

🔵 `bin/lib/validator-parsers.mjs:66` — JSDoc `@returns` and `@param` for `parseTap` describe only `stdout`; SKIP exclusion and `stderr`/`exitCode` conformance are unmentioned; update to match current behavior

---

# Engineer Eval (updated) — task-2 (TAP parser)

**Reviewer role:** Software Engineer
**Date:** 2026-04-26
**Verdict: PASS** (1 warning for backlog)

---

## Files Read
- `.team/features/external-validator-integration/tasks/task-2/handshake.json`
- `bin/lib/validator-parsers.mjs` (all 116 lines)
- `test/validator-parsers.test.mjs` (all 167 lines)
- `tasks/task-2/eval.md` (all prior sections: Tester, Engineer, Simplicity x2, Architect, Security x2, PM)

## Commands Run
- `node --test test/validator-parsers.test.mjs` → **13/13 pass** (confirmed directly)
- Inline node test for nested TAP: confirmed `findings.critical = 2` for 1 nested failure (double-count)

---

## Prior 🟡 Findings — Status

| Prior finding | Current state |
|---|---|
| `# SKIP` not excluded (`validator-parsers.mjs:78`) | **RESOLVED** — guard is now `!/# (?:TODO|SKIP)\b/i`; test at line 143 covers it |
| JUnit XML tests call `parseJunitXml(xml)` with 1 arg | **RESOLVED** — all 6 JUnit call sites now use `(xml, "", 0)` |

---

## Correctness

**PASS — core path.** `parseTap` (lines 72–92): splits on `\n`, trims each line, anchors `/^not ok\b/` at line start, guards `!/# (?:TODO|SKIP)\b/i`. Word-boundary on `not ok\b` prevents false match on `not okay`. `/i` flag is correct for TAP spec case-insensitivity. Plan extraction `/^1\.\.(\d+)/m` uses multiline mode; `parseInt(..., 10)` uses explicit radix. Return shape matches module contract.

**WARN — nested TAP double-counting.** `line.trim()` before the regex causes indented `not ok` lines from TAP subtests to match. Empirically verified: one suite with one failing subtest produces `findings.critical = 2` instead of 1. Node.js test runner (`--test-reporter tap`) produces exactly this nested format:

```
    not ok 1 - a nested failure   ← trimmed → matches → critical++
not ok 1 - my suite               ← top-level → matches → critical++
Result: findings.critical = 2  ← expected 1
```

This is the format used by this project's own test infrastructure. A user who configures a Node.js test runner as a TAP validator gets over-counted findings.

**PASS — all-ok input, TODO/SKIP exclusion, error handling.** All covered; verified by tests.

---

## Code Quality

**PASS.** 20 lines, readable, consistent with peer parsers. Bare function reference in registry.

JSDoc at line 70 documents only `@param {string} stdout` despite a 3-arg signature. No runtime effect.

---

## Findings

🟡 `bin/lib/validator-parsers.mjs:76` — `line.trim()` before `/^not ok\b/` double-counts indented `not ok` lines from nested TAP subtests; Node.js test runner produces this format; one failing subtest yields `findings.critical = 2` instead of 1; fix by matching on the raw (untrimmed) line or guarding against leading whitespace

🔵 `test/validator-parsers.test.mjs:154` — `getParser("tap")` never exercised; add `getParser("tap")(tapStr, "", 1)` asserting `findings.critical === 1` to verify registry wire-up end-to-end

🔵 `bin/lib/validator-parsers.mjs:70` — JSDoc `@param` documents only `stdout`; add `@param {string} stderr` and `@param {number} exitCode` to match the 3-arg module contract

---

# Architect Review (run_2) — task-2 (TAP parser)

**Reviewer role:** Architect
**Date:** 2026-04-26
**Verdict: PASS** (two 🟡 items to backlog; no 🔴 blockers)

## Files Read
- `.team/features/external-validator-integration/tasks/task-2/handshake.json`
- `bin/lib/validator-parsers.mjs` (all 115 lines — directly read)
- `test/validator-parsers.test.mjs` (all 166 lines — directly read)
- `.team/features/external-validator-integration/tasks/task-1/eval.md` (full prior history)
- `.team/features/external-validator-integration/tasks/task-2/eval.md` (all prior reviews: Tester/Engineer/Simplicity/Architect/Security run_1; Simplicity run_2; PM; Security run_2; Tester run_2; Engineer updated)

No `artifacts/test-output.txt` exists. Test passage confirmed by Tester run_2 direct execution: `tests 13 | pass 13 | fail 0`.

## Prior Blocking Findings — All Resolved

| Finding | Source | Resolution |
|---|---|---|
| `# SKIP` not excluded | Tester/Engineer/Architect/Security run_1 🟡 | RESOLVED — line 78: `!/# (?:TODO\|SKIP)\b/i`; test at `test.mjs:143–151` |
| JUnit XML tests call `parseJunitXml` with 1 arg | Engineer/Tester run_1 🟡 | RESOLVED — all 6 JUnit call sites updated to `(xml, "", 0)` |

No prior 🔴 findings exist for task-2. Task passed all prior reviews without an ITERATE cycle.

## Architectural Assessment

### Module boundary
Clean. `parseTap` adds no imports, touches no other module, and is self-contained. The registry extension pattern continues to scale: adding `parseTap` and the SKIP fix were each minimal, localised changes.

### Interface contract
Fully consistent. `parseTap(stdout, stderr, exitCode)` at line 72 matches the module contract at line 2 and both peer parsers. Return shape `{ findings, summary, meta: { messages } }` is uniform. `"tap": parseTap` is a bare function reference matching all registry entry styles.

### Nested TAP subtest double-counting (new, from Engineer run_2)
`line.trim()` at line 76 before the `/^not ok\b/` test causes indented `not ok` lines — emitted by `node:test`'s TAP reporter for nested subtests — to match. Engineer run_2 confirmed empirically: one suite with one failing subtest produces `findings.critical = 2` instead of 1. This project's own test infrastructure (`node --test-reporter tap`) generates this format, so this is a realistic integration scenario, not a theoretical edge case.

The architectural implication: the module does not specify whether it counts *all* `not ok` occurrences (including nested) or *top-level* failures only. Both are defensible behaviours, but the current choice (count all) will misrepresent failure counts when the gate is wired to the project's own test runner. This is a design decision that must be made explicit before integration.

### Integration status
Module still has no callers in `bin/`. Inert in production. Acceptable for current scope; the nested-counting question should be resolved before wiring `getParser("tap")` into the gate.

### Carried open issues (not introduced by this task)
- ANSI/control-character injection at line 79 (Security run_1/run_2 🟡)
- `meta.parseWarning` absence at line 84 (Security run_1/run_2 🟡)
- `PARSERS[format]` no `Object.hasOwn` guard (Security run_2 🔵)
- `PARSERS` mutable export at line 107 (Architect run_1 🔵)
- JSDoc params incomplete at line 65 (Engineer run_1 🔵)

## Findings

🟡 `bin/lib/validator-parsers.mjs:76` — `line.trim()` before `/^not ok\b/` double-counts indented `not ok` lines from TAP subtests; this project's `node --test-reporter tap` output produces this format; one failing nested test yields `findings.critical = 2` instead of 1 (confirmed empirically by Engineer run_2); decide whether the parser counts top-level failures only (match on lines without leading whitespace: `/^not ok\b/.test(line)`) or all failures (document the current behaviour explicitly)

🟡 `bin/lib/validator-parsers.mjs:79` — verbatim attacker-controlled TAP line pushed to `messages[]` without stripping control characters; `not ok 1 - \x1b[2J...` injects ANSI escape sequences into CLI output; strip `/[\x00-\x1f\x7f]/g` before `messages.push(trimmed)` (carried from Security run_1/run_2; same unresolved gap as `parseJunitXml` line 49)

🔵 `bin/lib/validator-parsers.mjs:114` — `PARSERS[format]` has no `Object.hasOwn` guard; `format = "__proto__"` returns `Object.prototype` (truthy), bypasses the exit-code fallback, and throws `TypeError` at invocation; use `Object.hasOwn(PARSERS, format) ? PARSERS[format] : PARSERS["exit-code"]` (raised by Security run_2)

🔵 `bin/lib/validator-parsers.mjs:107` — `PARSERS` exported as a plain mutable object; a consumer can overwrite or delete entries silently; `Object.freeze(PARSERS)` or remove the export and rely solely on `getParser` (carried from Architect run_1)

---
