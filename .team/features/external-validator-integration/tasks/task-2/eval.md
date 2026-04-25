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
