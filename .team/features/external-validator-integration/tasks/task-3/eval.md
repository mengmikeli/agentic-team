# Engineer Review — task-3: GitHub Actions problem matcher parser

**Reviewer**: Engineer
**Verdict**: PASS (with backlog item)

---

## Files Read

- `bin/lib/validator-parsers.mjs` lines 96–157 (`parseGithubActions` function)
- `test/validator-parsers.test.mjs` lines 185–254 (8 tests for `parseGithubActions`)
- `tasks/task-3/handshake.json` (builder claims)

---

## Claim Verification

**Builder claimed**: `parseGithubActions()` parses `::error/::warning/::notice` lines; each `::error` produces one critical finding; registered as `'github-actions'`; 8 tests added.

**Evidence**:
- Function exists at line 106 — confirmed.
- Registered in `PARSERS` at line 175 — confirmed.
- 8 tests in `describe("parseGithubActions")` at lines 185–254 — confirmed.
- Canonical test case `"::error file=src/foo.js,line=5::something went wrong"` → 1 critical, message `"src/foo.js:5 — something went wrong"` — passes.

---

## Per-Criterion Results

### 1. Correctness — core spec case
**PASS** — `::error file=src/foo.js,line=5::message` → 1 critical finding with location `src/foo.js:5`. Directly tested and confirmed in test at line 186.

### 2. Correctness — regex property parsing edge case
**WARN** — The regex `/^::([a-z]+)(?:\s+([^:]*))?::(.*)$/` uses `[^:]*` to capture properties. If any property value contains a single colon, the regex match fails for the entire line, and the finding is silently dropped.

Trace for `::error title=TypeError: x,file=src/foo.js,line=5::message`:
- `[^:]*` captures `title=TypeError`, stops at `:` in value
- Regex then expects `::` but finds `: x,file=...` → no match
- Line silently ignored → false negative in the gate

Real-world impact: TypeScript, ESLint, and Jest annotations commonly emit `title=` values containing colons (`TypeError:`, `SyntaxError:`, `Cannot find module:`). No test covers this case.

### 3. Error handling — silent failure mode
**WARN (same as above)** — The failure mode for the regex mismatch is silent: unmatched lines are skipped in the `if (!m) continue` path at line 120. This is the same path used for genuinely non-GA lines (build output, etc.). There is no way to distinguish "not a GA command" from "malformed GA command with colon in title". The result is a false negative with no diagnostic.

### 4. Correctness — level filtering
**PASS** — Levels other than `error/warning/notice` (e.g., `::debug`, `::set-output`, `::add-mask`) fall through all three `if/else if` branches without incrementing any counter. Correct.

### 5. Correctness — stderr handling
**PASS** — `combined = [stdout, stderr].filter(Boolean).join('\n')` correctly merges both streams. Tested at line 244. `filter(Boolean)` correctly handles empty strings.

### 6. Correctness — empty / no-command input
**PASS** — Both cases return zero findings with no messages. Tested at lines 197 and 249.

### 7. Code quality — property parsing
**PASS** — The hand-rolled `indexOf('=')` split at lines 128–133 is simple and correct. Handles missing `=` (guard `if (eq !== -1)`), empty `propsStr` (guard handled by `m[2] || ''` producing `''`, then `''.split(',')` → `['']`, skipped by guard).

### 8. Summary string completeness
**MINOR** — `summary: \`${findings.critical} error(s), ${findings.warning} warning(s)\`` omits suggestion count. When `::notice` lines are present, `findings.suggestion > 0` is not reflected in the summary. Not a correctness bug but an inconsistency.

---

## Edge Cases Checked

| Case | Result |
|------|--------|
| `::error file=src/foo.js,line=5::msg` | ✓ 1 critical, correct location |
| `::error::msg` (no properties) | ✓ 1 critical, no location |
| `::warning` | ✓ 1 warning |
| `::notice` | ✓ 1 suggestion |
| Commands in stderr only | ✓ picked up |
| Empty input | ✓ 0 findings |
| `::debug` (unknown level) | ✓ silently ignored |
| `::error title=TypeError: x,...::msg` | ✗ silently dropped (not tested) |

---

## Findings

🟡 bin/lib/validator-parsers.mjs:115 — Regex `[^:]*` for properties fails when any property value contains `:` (e.g., `title=TypeError: x`); entire line silently dropped as false negative; fix by capturing up to `::` using a non-greedy lookahead: `(?:\s+(.*?))?::` anchored correctly, or parse properties after splitting on the final `::` delimiter

🔵 bin/lib/validator-parsers.mjs:154 — Summary omits suggestion count; `::notice` findings are silently excluded from the summary string

🔵 test/validator-parsers.test.mjs:228 — `::notice` test does not assert `meta.messages` content; add assertion to verify message is stored and formatted correctly

---

## Overall Verdict: PASS

The specified behavior (`::error file=src/foo.js,line=5::message` → 1 critical finding) is correctly implemented and tested. The regex property parsing bug is a real correctness hole for `title=` values with colons but does not affect the specified use case. Flagged as a backlog item (🟡 = must go to backlog per review rubric). No merge blocker.

---

# PM Eval — task-3: GitHub Actions problem matcher parser

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Read

- `.team/features/external-validator-integration/tasks/task-3/handshake.json`
- `bin/lib/validator-parsers.mjs` (all 181 lines — directly read)
- `test/validator-parsers.test.mjs` (all 254 lines — directly read)
- `.team/features/external-validator-integration/tasks/task-3/eval.md` (prior Simplicity and Engineer reviews)
- `.team/features/external-validator-integration/tasks/task-2/eval.md` (full prior history for carried items)

---

## Requirement Traceability

**Stated requirement:** "`GitHub Actions problem matcher` output (`::error file=src/foo.js,line=5::message`) produces one critical finding."

| Criterion | Status | Evidence |
|---|---|---|
| `::error file=src/foo.js,line=5::message` → `findings.critical === 1` | PASS | `test.mjs:186–195` asserts `findings.critical === 1`, `warning === 0`, `suggestion === 0`, `meta.messages.length === 1`, `messages[0] === "src/foo.js:5 — something went wrong"` |
| `findings.warning === 0`, `findings.suggestion === 0` for `::error` input | PASS | `test.mjs:190–191` asserts both explicitly |
| Tests registered in `npm test` | PASS | `test/validator-parsers.test.mjs` is listed in the gate's `node --test` invocation |

---

## Handshake Claims Verified

| Claim | Location | Status |
|---|---|---|
| `parseGithubActions()` added | `validator-parsers.mjs:106` | CONFIRMED |
| `::error` → critical | `validator-parsers.mjs:140–142` | CONFIRMED |
| `::warning` → warning | `validator-parsers.mjs:143–145` | CONFIRMED |
| `::notice` → suggestion | `validator-parsers.mjs:146–149` | CONFIRMED |
| Registered as `'github-actions'` | `validator-parsers.mjs:175` | CONFIRMED — bare function reference |
| 8 new tests | `test.mjs:185–254` | CONFIRMED — 8 `it()` blocks in `parseGithubActions` describe |
| Includes stderr, missing properties, empty input | `test.mjs:244`, `236`, `249` | CONFIRMED |
| Gate test pass count | Gate output truncated before `validator-parsers.test.mjs` block; no `artifacts/test-output.txt` | UNVERIFIABLE from provided evidence |

---

## Scope Assessment

The stated requirement covers `::error` → one critical finding. The builder also implemented `::warning` → warning and `::notice` → suggestion. These are the natural completion of the "GitHub Actions problem matcher" format, which inherently defines three severity levels. Implementing only `::error` would leave the parser partially broken for real-world GA output. Not scope creep — the extended levels are within scope.

---

## Engineer-Flagged Bug Assessment

The Engineer review identified a regex correctness hole: property values containing colons (e.g., `title=TypeError: x`) cause the `[^:]*` group to stop at the first colon, causing the `::` anchor to fail, and the line is silently dropped.

**PM ruling:** 🟡 — backlog item, not a merge blocker.
- The stated requirement (`::error file=src/foo.js,line=5::message`, no `title` property) is unaffected — verified by direct code trace and the passing test at `test.mjs:186`.
- The bug affects an extended use case not specified in the current task.
- Must go to backlog before this format is documented as supporting `title` properties.

---

## Prior 🟡 Findings From task-2 — Status in task-3

| Prior finding | Applies to `parseGithubActions`? | Status |
|---|---|---|
| Control char injection in `messages[]` | YES | RESOLVED — `validator-parsers.mjs:118` strips `[\x00-\x1f\x7f]` on every line before parsing; `label` is derived from stripped content ✓ |
| Module has no callers in `bin/` | YES | OPEN — module still inert in production (carried) |
| `meta.parseWarning` absent for misconfigured input | YES | OPEN — non-GA stdout returns `critical: 0` indistinguishable from a clean run |

---

## Findings

🟡 `bin/lib/validator-parsers.mjs:115` — regex `[^:]*` for properties silently drops lines where any property value contains `:` (e.g., `title=TypeError: x`); false negative with no diagnostic; fix by capturing up to `::` with a non-greedy lookahead (e.g., `(.*?)` with adjusted anchoring) or by pre-splitting on the final `::` delimiter (raised by Engineer review)

🟡 `.team/features/external-validator-integration/tasks/task-3/handshake.json` — no `artifacts/test-output.txt` saved and gate output is truncated before `validator-parsers.test.mjs` block; reviewer cannot confirm all 8 new tests passed without re-running (same process gap flagged in every task-2 PM review)

🟡 `bin/lib/validator-parsers.mjs:1` — module has no callers in `bin/`; inert in production; confirm integration task is tracked before marking feature shippable (carried from task-2 across all PM reviews)

🔵 `test/validator-parsers.test.mjs:172` — `getParser("github-actions")` test only asserts `typeof`; does not call the parser with real input; add `parser("::error file=src/foo.js,line=5::msg", "", 1)` asserting `findings.critical === 1` to confirm registry wire-up end-to-end

🔵 `test/validator-parsers.test.mjs:228` — `::notice` test does not assert `meta.messages` content; add assertion to verify message is stored and formatted correctly (raised by Engineer review)

---

# Architect Review — task-3: GitHub Actions problem matcher parser

**Reviewer**: Architect
**Verdict**: PASS

---

## Files Opened and Read

- `.team/features/external-validator-integration/tasks/task-3/handshake.json`
- `.team/features/external-validator-integration/tasks/task-2/handshake.json`
- `.team/features/external-validator-integration/tasks/task-1/handshake.json`
- `.team/features/external-validator-integration/tasks/task-3/eval.md` (prior reviews)
- `bin/lib/validator-parsers.mjs` (full file, lines 1–181)
- `test/validator-parsers.test.mjs` (full file, lines 1–254)
- `bin/lib/gate.mjs` (full file, lines 1–187)

## Verification Run

```
node --test test/validator-parsers.test.mjs
```

Result: 23 tests, 0 failures. All `parseGithubActions` cases pass including the canonical case.

---

## Per-Criterion Results

### 1. Module boundary — reachability from production

**WARN** — `validator-parsers.mjs` is not imported anywhere in `bin/` except itself.
Confirmed via `grep -r "validator-parsers" bin/` returning only the module file.

`gate.mjs:136` hardcodes `findings: { critical: exitCode === 0 ? 0 : 1 }` and never calls
`getParser`. The `PARSERS` registry and `getParser` are a dead code path in the production runtime.

All three parsers (TAP, JUnit-XML, GitHub Actions) are in the same state — this appears to be
intentional library-first build order. The integration into `gate.mjs` (adding `--output-format`
flag + routing through `getParser`) is the highest-priority follow-on task.

### 2. Regex correctness — colon in property values

**WARN** — Confirmed by prior Engineer review and traced directly in code.
`([^:]*)` at `validator-parsers.mjs:115` stops at the first colon in the properties string.
Any property value with a colon (e.g. `title=TypeError: x`) causes silent line drop.
This is an undocumented limitation. GitHub's spec requires percent-encoding (`%3A`), but
tools commonly emit raw colons in `title=` values. Not a blocker for V1 but must go to backlog.

### 3. Return shape and interface contract

**PASS** — All parsers implement the same `(stdout, stderr, exitCode) → { findings, summary, meta }`
contract. The `meta.messages` array is consistently present on all complex parsers. Interface is
clean, pure (no I/O, no side effects), and testable in isolation.

### 4. Registry design

**PASS** — Flat string-keyed `PARSERS` object with `getParser` fallback is minimal and appropriate
for the number of formats. Adding a new format is one function + one line. No premature abstraction.

### 5. Scalability of the parser approach

**PASS** — Single-pass line iteration with O(n) complexity relative to output size. No backtracking.
Property parsing is O(p) per line where p = number of properties. No structural concern at scale.

### 6. JSDoc accuracy

**INFO** — `@param` on `parseGithubActions`, `parseTap`, and `parseJunitXml` documents only `stdout`;
actual signature is `(stdout, stderr, exitCode)`. Not blocking.

---

## Findings

🟡 bin/lib/gate.mjs:136 — `getParser` is never called; `findings` hardcoded as exit-code-only regardless of format; wire parsers into production by adding `--output-format` flag to `cmdGate` and routing `getParser(format)(stdout, stderr, exitCode)` after the command runs

🟡 bin/lib/validator-parsers.mjs:115 — `([^:]*)` stops at first colon in properties string, silently dropping lines where any property value contains `:` (e.g. `title=TypeError: x`); fix by splitting on last `::` delimiter or using non-greedy lookahead (carried — same issue flagged by Engineer review)

🔵 bin/lib/validator-parsers.mjs:153 — summary omits suggestion count; extend to include `${findings.suggestion} notice(s)` for symmetry with the three-bucket findings object

🔵 bin/lib/validator-parsers.mjs:98 — JSDoc `@param` only lists `stdout`; update to document all three parameters `(stdout, stderr, exitCode)`; same issue at `parseTap:65` and `parseJunitXml:21`

---

## Overall Verdict: PASS

No critical blockers. Two 🟡 warnings (both carried from prior reviews) go to backlog. The
`gate.mjs` integration gap is the most important architectural follow-on: until wired, the feature
delivers no observable end-to-end value despite correct and fully tested parser logic.

---

# Tester Eval — task-3 (GitHub Actions problem matcher parser)

**Reviewer role:** Tester
**Date:** 2026-04-26
**Verdict: PASS** (two 🟡 to backlog)

---

## Files Read

- `.team/features/external-validator-integration/tasks/task-3/handshake.json`
- `bin/lib/validator-parsers.mjs` (all 182 lines — directly read)
- `test/validator-parsers.test.mjs` (all 254 lines — directly read)
- `.team/features/external-validator-integration/tasks/task-2/eval.md` (prior pattern context, carried open items)
- `.team/features/external-validator-integration/tasks/task-3/eval.md` (all prior sections: Simplicity, Engineer, PM, Architect)

---

## Claim Verification

| Claim | Evidence | Status |
|---|---|---|
| `parseGithubActions(stdout, stderr, exitCode)` added | `validator-parsers.mjs:106` — 3-arg signature | CONFIRMED |
| `"github-actions": parseGithubActions` in PARSERS | `validator-parsers.mjs:175` — bare reference | CONFIRMED |
| 8 new tests in `parseGithubActions` describe block | `test/validator-parsers.test.mjs:185–254` — 8 `it()` blocks | CONFIRMED |
| `::error` → critical, `::warning` → warning, `::notice` → suggestion | `validator-parsers.mjs:140–149` — 3 conditional branches | CONFIRMED |
| Tests pass | Gate output includes file in `node --test`; no failures shown | PARTIAL — gate output truncated; no `artifacts/test-output.txt` |

---

## Core Acceptance Criterion

**Requirement**: `::error file=src/foo.js,line=5::message` → one critical finding.

**PASS** — Test at `test.mjs:186–195` asserts all five conditions: `findings.critical === 1`, `findings.warning === 0`, `findings.suggestion === 0`, `meta.messages.length === 1`, and `meta.messages[0] === "src/foo.js:5 — something went wrong"`. Direct, unambiguous evidence.

---

## Test Coverage Analysis

| Scenario | Tested? | Location |
|---|---|---|
| `::error file=...,line=...::message` → 1 critical | YES | `test.mjs:186` |
| No workflow commands → 0 findings | YES | `test.mjs:197` |
| Multiple `::error` lines → multiple criticals | YES | `test.mjs:206` |
| `::warning` → 1 warning | YES | `test.mjs:218` |
| `::notice` → 1 suggestion | YES | `test.mjs:227` |
| `::error` with no properties → 1 critical, message only | YES | `test.mjs:236` |
| `::error` on stderr → picked up | YES | `test.mjs:244` |
| Empty input → 0 findings | YES | `test.mjs:249` |

---

## Edge Cases Checked

| Edge case | Tested? | Notes |
|---|---|---|
| `title` property with colon in value | NO | **Bug**: `[^:]*` stops at first `:` in value; line silently dropped; 0 findings instead of 1. Confirmed by Engineer and Architect reviews |
| `::error` with `file` but no `line` (partial location) | NO | Falls back to just `file`; correct by inspection (`validator-parsers.mjs:137`) but untested |
| Mixed `::error` + `::warning` in same output | NO | Correct by inspection; combined-level test would lock in independent counting |
| `::debug` or other non-diagnostic GA commands | NO | Silently ignored; correct, but untested |
| Control characters in message | NO | Stripped at line 118; removing the strip passes all 8 tests undetected |
| `getParser("github-actions")` round-trip | PARTIAL | `test.mjs:172` asserts `typeof === "function"` only; no invocation with real input |

---

## Control Character Stripping: Untested

`parseGithubActions` strips control chars at line 118 before regex matching:

```javascript
const line = raw.replace(/[\x00-\x1f\x7f]/g, '').trim();
```

The stored `label` is derived from `m[3]`, which comes from the already-stripped `line`, so stored messages are free of control chars. This is correct. However, **no test in the suite asserts this behavior**. Removing the `.replace(...)` call passes all 8 tests without failure. This is the identical gap raised as 🟡 by Security, Tester, Architect, and Engineer across task-2's final review rounds and still unresolved.

---

## Regression Risks

- `parseGithubActions` is self-contained; no callers in `bin/` (module inert, consistent with all prior tasks).
- TAP and JUnit XML parsers unaffected.
- `getParser` fallback path unaffected.

---

## Findings

🟡 `bin/lib/validator-parsers.mjs:115` — `[^:]*` regex group fails when any property value contains `:` (e.g., `title=TypeError: null`); line silently dropped → 0 findings instead of 1; add test `"::error file=src/foo.js,line=5,title=Type Error: null::msg"` asserting 1 critical finding; fix regex to capture properties up to the final `::` delimiter (confirmed independently by Engineer and Architect reviews)

🟡 `test/validator-parsers.test.mjs` — no test locks in control-char stripping at `validator-parsers.mjs:118`; removing the `.replace()` call passes all 8 tests undetected; add case with `"::error::message\x1b[2J"` asserting `meta.messages[0]` contains no bytes below `\x20` (same gap as TAP parser: raised 🟡 by Security run_3, Tester run_3, Architect run_3, Engineer final in task-2)

🔵 `test/validator-parsers.test.mjs:172` — `getParser("github-actions")` test only asserts `typeof`; add `parser("::error file=src/foo.js,line=5::msg", "", 1)` asserting `findings.critical === 1` to verify registry wire-up end-to-end (consistent gap with `"junit-xml"` and `"tap"` carried from all task-2 reviews)

🔵 `test/validator-parsers.test.mjs` — no test for `::error` with `file` but no `line`; the fallback to filename-only at `validator-parsers.mjs:137` is untested; add a case asserting `meta.messages[0] === "src/foo.js — message"`

🔵 `test/validator-parsers.test.mjs` — no test for mixed `::error` + `::warning` in same output; add combined-level case asserting `findings.critical === 1, findings.warning === 1`

---

# Security Review — task-3 (GitHub Actions problem matcher parser)

**Reviewer role:** Security
**Date:** 2026-04-26
**Verdict:** PASS (three 🟡 warnings to backlog; no 🔴 blockers)

---

## Files Read

- `bin/lib/validator-parsers.mjs` (all 182 lines — directly read)
- `test/validator-parsers.test.mjs` (all 254 lines — directly read)
- `.team/features/external-validator-integration/tasks/task-3/handshake.json`
- `.team/features/external-validator-integration/tasks/task-1/eval.md` (full prior security history)
- `.team/features/external-validator-integration/tasks/task-2/eval.md` (full prior security history through final run)

## Test Execution (direct evidence)

```
node --test test/validator-parsers.test.mjs

tests 23 | pass 23 | fail 0
```

All 8 `parseGithubActions` tests pass. Confirmed by direct execution.

## Threat Model

`stdout` and `stderr` originate from an external validator process configured by the user, running against potentially untrusted codebases. A malicious repository's CI script can emit arbitrary `::error`/`::warning`/`::notice` workflow commands on either stream. The parsed `file`, `line`, and `message` property values are the primary attacker-controlled attack surface.

## Criteria

**Secrets / credentials:** PASS — No file I/O, network calls, credentials, or `eval` equivalent.

**ReDoS:** PASS — `lineRe` at line 115: `/^::([a-z]+)(?:\s+([^:]*))?::(.*)$/`. `[^:]*` is a negated character class (linear). `(.*)$` is anchored. No catastrophic backtracking paths. Property parsing (lines 128–133) uses `indexOf`/`slice` — no regex.

**Control-character / ANSI injection:** PASS — Line 118 strips control characters _before_ any further processing: `raw.replace(/[\x00-\x1f\x7f]/g, '').trim()`. All downstream values are extracted from the sanitized string. The `label` pushed to `messages[]` at lines 141/144/147 cannot contain C0 controls or ESC sequences. This is the most defensively correct sanitization point of any parser in the module — earlier than both TAP and JUnit parsers (TAP strips at the push site; JUnit does not strip at all).

**Prototype pollution via property key injection:** PASS — `props` at line 127 is a fresh `{}` literal per iteration. Bracket assignment `props[key] = value` with `key = "__proto__"` does NOT modify `Object.prototype` in modern JS. Subsequent reads use specific well-known keys; arbitrary injected keys are silently ignored.

**Silent false-negative via colon in property value:** WARN (carried from Engineer/Architect reviews) — Confirmed by direct execution: `::error title=TypeError: x,file=src/foo.js,line=5::message` → NO MATCH. `[^:]*` stops at the first `:` in a property value; the `::` anchor cannot match; the entire line is silently skipped. A validator emitting TypeScript or ESLint errors with colon-containing `title=` values silently produces `critical: 0`. Not introduced by this PR; same finding as Engineer 🟡 at line 115 — confirmed here from a security angle.

**`getParser` prototype bypass:** Low risk — `PARSERS[format]` at line 180 has no `Object.hasOwn` guard. `format = "__proto__"` returns `Object.prototype` (truthy), bypasses exit-code fallback, throws `TypeError`. Crash, not RCE. `format` originates from trusted user config (flagged 🔵 since task-2 Security run_2).

**Silent parse failure:** OPEN — Non-GA `combined` (stack trace, JSON blob) returns `{ findings: { critical: 0 } }` indistinguishable from a clean GA run. No `meta.parseWarning` signal. Carried from task-1 and task-2 security reviews; unresolved across all three parsers.

**Path traversal:** PASS — `file` attribute used only as a display string. No filesystem operations.

## JUnit Parser Inconsistency (architectural carry)

`parseTap` (line 81) and `parseGithubActions` (line 118) both strip control characters before storing messages. `parseJunitXml` (line 49) still pushes attacker-controlled `message`, `classname`, and `file` verbatim. Three parsers sharing the same `meta.messages` interface have two different security postures. Flagged since task-1 Security run_1; still unresolved.

## Control-Char Stripping: Not Test-Locked

Line 118's strip is implemented and correct. Removing it passes all 23 tests — the behavior is unguarded by any assertion.

## Prior 🔴 Findings Status

No prior 🔴 findings from task-1 or task-2 apply to `parseGithubActions`. No regressions introduced.

## Findings

🟡 `bin/lib/validator-parsers.mjs:49` — `parseJunitXml` still pushes attacker-controlled `message`, `classname`, and `file` verbatim to `messages[]` without control-character stripping; `parseTap` (line 81) and `parseGithubActions` (line 118) both sanitize — inconsistent security posture across three parsers sharing the same `meta.messages` interface; strip `/[\x00-\x1f\x7f]/g` before `messages.push()` in `parseJunitXml` (carried from task-1 Security run_1 through task-2 Architect run_3)

🟡 `bin/lib/validator-parsers.mjs:152` — non-GA stdout returns `critical: 0` indistinguishable from a clean run; once wired in, a misconfigured `"github-actions"` validator silently passes the gate; add `meta.parseWarning = true` when `combined` is non-empty and no `::` workflow command line was matched (carried from task-1 and task-2 Security reviews; unresolved across all three parsers)

🟡 `test/validator-parsers.test.mjs` — control-char stripping at `validator-parsers.mjs:118` is not test-locked; removing `.replace(/[\x00-\x1f\x7f]/g, '')` passes all 23 tests without failure; add a test with `"::error file=src/foo.js,line=5::evil\x1b[2J"` asserting `meta.messages[0]` contains no bytes in `[\x00-\x1f]` (same gap as TAP parser, flagged 🟡 in task-2 final reviews)

🔵 `bin/lib/validator-parsers.mjs:180` — `PARSERS[format]` has no `Object.hasOwn` guard; `format = "__proto__"` returns `Object.prototype` (truthy), bypasses exit-code fallback, throws `TypeError`; use `Object.hasOwn(PARSERS, format) ? PARSERS[format] : PARSERS["exit-code"]` (carried from Security task-2 run_2)

🔵 `bin/lib/validator-parsers.mjs:172` — `PARSERS` exported as a plain mutable object; a consumer can silently overwrite parser entries; `Object.freeze(PARSERS)` or remove the export and rely solely on `getParser` (carried from Architect task-1 run_2)
