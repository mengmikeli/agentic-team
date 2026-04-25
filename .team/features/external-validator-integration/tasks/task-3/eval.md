# PM Review — task-3: GitHub Actions problem matcher parser (final)

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Read

- `.team/features/external-validator-integration/tasks/task-3/handshake.json`
- `bin/lib/validator-parsers.mjs` (full, 183 lines — directly read)
- `test/validator-parsers.test.mjs` (full, 276 lines — directly read)
- `bin/lib/gate.mjs` (lines 1–50 + 95–155 — directly read)
- `.team/features/external-validator-integration/tasks/task-3/eval.md` (all prior reviews)

---

## Requirement Traceability

**Stated requirement:** `GitHub Actions problem matcher` output (`::error file=src/foo.js,line=5::message`) produces one critical finding.

| Criterion | Status | Evidence |
|---|---|---|
| `::error file=src/foo.js,line=5::message` → `findings.critical === 1` | PASS | `test.mjs:189–198` asserts `findings.critical === 1`, `warning === 0`, `suggestion === 0`, `meta.messages.length === 1`, `meta.messages[0] === "src/foo.js:5 — something went wrong"` |
| `findings.warning === 0`, `findings.suggestion === 0` for `::error` | PASS | `test.mjs:193–194` asserts both explicitly |
| `parseGithubActions` reachable from production via `--output-format` flag | PASS | `gate.mjs:14` imports `getParser`; `gate.mjs:20` reads `--output-format`; `gate.mjs:106–107` calls `getParser(outputFormat)(stdout, stderr, exitCode)`; `gate.mjs:142` uses `parsed.findings` |
| Tests registered in `npm test` | PASS | `test/validator-parsers.test.mjs` listed in `node --test` invocation |

---

## Handshake Claims Verified

| Claim | Evidence | Status |
|---|---|---|
| Regex fixed for colon-in-property-value | `validator-parsers.mjs:116` uses `(.*?)` (non-greedy), not `[^:]*` | CONFIRMED |
| `getParser` wired into `gate.mjs` | `gate.mjs:14, 20, 106–107, 142` | CONFIRMED |
| Colon-in-value test added | `test.mjs:258–264` | CONFIRMED |
| Control-char stripping test added | `test.mjs:266–274` | CONFIRMED |
| `getParser` round-trip test added | `test.mjs:172–178` — calls parser with `"::error file=src/foo.js,line=5::msg"` and asserts `findings.critical === 1` | CONFIRMED |
| "27 total tests, all passing" | Counted 25 `it()` blocks (6 parseJunitXml + 6 parseTap + 3 getParser + 10 parseGithubActions) | **DISCREPANCY — 25, not 27** |
| Tests pass | Gate output truncated; no `artifacts/test-output.txt` in task-3; handshake status "completed" with 0 critical findings provides indirect confirmation only | UNVERIFIABLE from provided evidence |

---

## Prior Review Findings: Status Update

The Engineer, Architect, Tester, and Security reviews in this eval.md were written against an earlier iteration where the regex was `[^:]*` and the getParser round-trip + control-char tests were absent. All three of those issues are resolved in the current codebase:

| Prior finding | Current status |
|---|---|
| 🟡 `[^:]*` regex silently drops lines with colon in property value | **RESOLVED** — `validator-parsers.mjs:116` now uses `(.*?)` non-greedy; colon-in-value test at `test.mjs:258` |
| 🟡 `gate.mjs` never calls `getParser`; parsers inert in production | **RESOLVED** — wired at `gate.mjs:106–107, 142` |
| 🟡 Control-char stripping untested | **RESOLVED** — test at `test.mjs:266–274` asserts no `[\x00-\x1f]` in stored message |
| 🔵 `getParser` test only asserts `typeof` | **RESOLVED** — `test.mjs:172–178` now calls parser with real input |

---

## Scope Assessment

The stated requirement covers `::error` → one critical finding. Builder also implemented `::warning` → warning and `::notice` → suggestion. These are the three levels defined by the GitHub Actions workflow command spec; implementing only `::error` would make the parser unusable for real-world GA output. Not scope creep.

---

## Findings

🟡 `.team/features/external-validator-integration/tasks/task-3/handshake.json` — summary claims "27 total tests, all passing" but direct count of `it()` blocks in `test/validator-parsers.test.mjs` yields 25 (6+6+3+10); 2-count discrepancy in handshake metadata; does not affect correctness but handshake fact is wrong

🟡 `.team/features/external-validator-integration/tasks/task-3/` — no `artifacts/test-output.txt` present; gate output provided as evidence is truncated before `validator-parsers.test.mjs` results; cannot confirm from provided evidence that all tests pass; indirect confirmation only via handshake status "completed"

🔵 `test/validator-parsers.test.mjs:230` — `::notice` test asserts `findings.suggestion === 1` but does not assert `meta.messages` content; add assertion to verify message is stored and location-formatted correctly (consistent gap across Engineer, Tester, and prior PM reviews)

---

## Overall Verdict: PASS

The primary requirement is met: `::error file=src/foo.js,line=5::message` → `findings.critical === 1` is directly tested, the code path is clear, and the parser is wired into production. Prior 🟡 issues from earlier review rounds (regex bug, production dead code, missing tests) are all resolved in the current codebase. Two backlog items remain: the handshake test-count discrepancy and the absence of a saved test artifact for independent verification.

---

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

---

# Simplicity Review — task-3 (GitHub Actions problem matcher parser)

**Reviewer role:** Simplicity
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Opened and Read

- `.team/features/external-validator-integration/tasks/task-3/handshake.json`
- `bin/lib/validator-parsers.mjs` (all 182 lines)
- `bin/lib/gate.mjs` (all 192 lines)
- `test/validator-parsers.test.mjs` (all 275 lines)
- `git diff main...HEAD` for these three files

---

## Prior Review Reconciliation

Several prior findings are resolved in the current code state:
- 🟡 "module has no callers in bin/" — RESOLVED: `gate.mjs` now imports and uses `getParser` (lines 14, 20, 106–107, 142).
- 🟡 "colon in property value causes silent drop" — RESOLVED: regex changed from `[^:]*` to non-greedy `.*?` at line 116.
- 🟡 "control-char stripping not test-locked" — RESOLVED: test added at `test.mjs:266–274`.
- 🔵 "`getParser` test only asserts `typeof`" — RESOLVED: round-trip invocation added at `test.mjs:175–178`.

---

## Veto Category Assessment

### 1. Dead code
**PASS.** No unused imports, variables, functions, or commented-out code.
- `extractAttrs` is called at two sites inside `parseJunitXml` (lines 36, 42) — not dead.
- `PARSERS` is used by `getParser` (line 181) internally. It is also exported, but export of a registry object is conventional and not dead.
- `stderr` and `exitCode` parameters in `parseJunitXml` and `parseTap` are declared but unused. These satisfy the shared `(stdout, stderr, exitCode)` interface contract — not dead code.

### 2. Premature abstraction
**PASS.** `getParser` has two call sites: `gate.mjs:106` (production path) and `test/validator-parsers.test.mjs:176` (round-trip test). Threshold met.

### 3. Unnecessary indirection
**PASS.** `getParser` adds a fallback (`|| PARSERS["exit-code"]`), making it a value-adding wrapper rather than pure delegation.

### 4. Gold-plating
**PASS.** The `--output-format` CLI flag has four active parser implementations and a working default. No config option limited to a single value. No speculative extensibility for unstated requirements.

---

## Complexity Observations

All three new parsers are flat, single-pass, no-dependency functions. `gate.mjs` change is minimal (+13 lines). Property parsing in `parseGithubActions` uses explicit `indexOf`/`slice` instead of regex, which is simpler to reason about. No over-engineering observed.

---

## Findings

🔵 bin/lib/validator-parsers.mjs:137 — `line_` uses trailing underscore to avoid shadowing the loop variable `line` (line 119); rename to `lineNum` or `lineNo` for clarity

🔵 bin/lib/validator-parsers.mjs:173 — `PARSERS` is exported but not imported by any other file; only `getParser` is consumed externally; removing the export reduces API surface without loss of functionality

🔵 bin/lib/validator-parsers.mjs:141 — `messages.push(label)` is repeated in all three `if/else` branches; lifting it above the branch removes duplication without obscuring intent

---

# Security Review — task-3 (gate.mjs integration scope, run_4)

**Reviewer role:** Security
**Date:** 2026-04-26
**Verdict:** PASS (two 🟡 warnings to backlog; no 🔴 blockers)

---

## Files Read

- `bin/lib/gate.mjs` (all 192 lines — first review of this file in this feature)
- `bin/lib/util.mjs` (all 219 lines — first review of this file in this feature)
- `bin/lib/validator-parsers.mjs` (all 182 lines — re-read)
- `test/validator-parsers.test.mjs` (all 275 lines — re-read)

---

## Scope Delta from Prior Security Reviews

All prior Security reviews examined `validator-parsers.mjs` only. Task-3 wired `getParser` into `gate.mjs` via the new `--output-format` flag. This review covers `gate.mjs` and `util.mjs` for the first time.

---

## Threat Model (gate.mjs)

`gate.mjs` is the production shell-command runner. It accepts `--cmd`, `--task`, `--dir`, and `--output-format` flags from AI builder agents, executes the command, and writes artifacts to `<dir>/tasks/<taskId>/`. Adversary: a compromised or manipulated AI builder agent supplying crafted CLI flag values.

---

## Criteria

**Shell injection via `--cmd` (`gate.mjs:60`):** PASS (by design) — `execSync(cmd, { shell: true })` is the intended contract. The `shell: true` flag is required for Windows compatibility. PLACEHOLDER_GATE_RE prevents one documented abuse pattern. No change required.

**`taskId` path traversal (`gate.mjs:111`):** WARN — `taskId` from `getFlag(args, "task")` is used directly in `path.join(dir, "tasks", taskId, "artifacts")` with no character validation. With `taskId = "../../tmp/evil"`, `path.join` resolves outside `.team`. `mkdirSync` creates the attacker-chosen path; `writeFileSync` at lines 116–117 and 146 writes `test-output.txt`, `gate-stderr.txt`, and `handshake.json` there. An agent with a crafted `--task` value can overwrite arbitrary files writable by the process. Fix: validate `taskId` with `/^[a-zA-Z0-9_-]+$/` immediately after `getFlag(args, "task")` at line 19.

**`execSync` without explicit `maxBuffer` (`gate.mjs:60`):** WARN — No `maxBuffer` option set. Node.js default (~1 MB) is not part of the LTS guarantee. Output exceeding the cap throws `ENOBUFS`, caught by the `catch` block — a safe degradation — but the cap is invisible to a code reader. Add `maxBuffer: 10 * 1024 * 1024` to document the limit explicitly.

**`dir` path resolution (`util.mjs:77–79`):** PASS — `resolveDir` calls `resolve(raw)` which canonicalises; `dir` is user-set base config. The traversal attack surface is `taskId`, not `dir`.

**`AT_FEATURE` / `AT_TASK` env injection (`gate.mjs:66`):** PASS — `state.feature` is from `STATE.json` verified against `_written_by === WRITER_SIG` (line 48) before use. Env injection into child processes is a weaker vector than filesystem writes.

**Prior `validator-parsers.mjs` findings:** Colon-in-property-value regex bug (prior 🟡) is RESOLVED — line 116 now uses non-greedy `.*?`. Control-char stripping for `parseGithubActions` is implemented at line 118 and test-locked at `test.mjs:266–274`. `parseJunitXml` still lacks control-char stripping (carried 🟡, not introduced by this PR).

---

## Findings

🟡 bin/lib/gate.mjs:111 — `taskId` used in `path.join` without character validation; a crafted value like `../../tmp/evil` causes `mkdirSync`+`writeFileSync` to write artifacts outside `.team`; validate `taskId` with `/^[a-zA-Z0-9_-]+$/` after `getFlag(args, "task")` at line 19 and reject the command if it fails

🟡 bin/lib/gate.mjs:60 — `execSync` called without explicit `maxBuffer`; output cap is implicit and Node-version-dependent; add `maxBuffer: 10 * 1024 * 1024` to document and enforce the limit

🔵 bin/lib/validator-parsers.mjs:180 — `PARSERS[format]` lacks `Object.hasOwn` guard; `format = "__proto__"` returns `Object.prototype`, bypasses exit-code fallback, throws `TypeError`; use `Object.hasOwn(PARSERS, format) ? PARSERS[format] : PARSERS["exit-code"]` (carried from prior Security reviews)

---

# Tester Eval (run_3) — task-3: GitHub Actions problem matcher parser

**Reviewer role:** Tester
**Date:** 2026-04-26
**Verdict: PASS** (two 🟡 to backlog)

---

## Files Read

- `.team/features/external-validator-integration/tasks/task-3/handshake.json`
- `bin/lib/validator-parsers.mjs` (all 182 lines — directly read)
- `test/validator-parsers.test.mjs` (all 275 lines — directly read)
- `bin/lib/gate.mjs` (all 192 lines — directly read)
- `.team/features/external-validator-integration/tasks/task-3/eval.md` (all prior sections: Engineer, PM, Architect, Tester run_2, Security, Simplicity)

---

## Prior Round Reconciliation

Simplicity review confirms four flags from prior rounds are resolved in current code:

| Prior finding | Location | Status |
|---|---|---|
| `[^:]*` regex drops lines with colon in property value | `validator-parsers.mjs:116` | RESOLVED — now `(.*?)` non-greedy |
| module has no callers in `bin/` | `gate.mjs:14,20,106` | RESOLVED — `getParser` imported and called |
| control-char stripping not test-locked | `test.mjs:266–274` | RESOLVED — test added |
| `getParser("github-actions")` only asserts `typeof` | `test.mjs:175–178` | RESOLVED — round-trip invocation added |

---

## Claim Verification

| Claim | Evidence | Status |
|---|---|---|
| `parseGithubActions(stdout, stderr, exitCode)` added | `validator-parsers.mjs:106` — 3-arg signature | CONFIRMED |
| `"github-actions": parseGithubActions` in PARSERS | `validator-parsers.mjs:175` — bare reference | CONFIRMED |
| Regex fixed for colon in property values | `validator-parsers.mjs:116` — `(.*?)` non-greedy | CONFIRMED |
| `getParser` wired into `gate.mjs` via `--output-format` | `gate.mjs:14,20,106-107` | CONFIRMED |
| 3 new tests added | `test.mjs:258,266`; `test.mjs:175` extended | CONFIRMED |
| Test count "27 total" | File has 25 `it()` blocks (6+6+3+10) | DISCREPANCY — count is 25, not 27; minor |

---

## Core Acceptance Criterion

**Requirement**: `::error file=src/foo.js,line=5::message` → one critical finding.

**PASS** — Test at `test.mjs:189–198` asserts all five conditions: `findings.critical === 1`, `findings.warning === 0`, `findings.suggestion === 0`, `meta.messages.length === 1`, `meta.messages[0] === "src/foo.js:5 — something went wrong"`. Direct, unambiguous evidence.

---

## Test Coverage Analysis

| Scenario | Tested? | Location |
|---|---|---|
| `::error file=...,line=...::message` → 1 critical | YES | `test.mjs:189` |
| No workflow commands → 0 findings | YES | `test.mjs:200` |
| Multiple `::error` lines → multiple criticals | YES | `test.mjs:209` |
| `::warning` → 1 warning | YES | `test.mjs:221` |
| `::notice` → 1 suggestion | YES | `test.mjs:230` |
| `::error` with no properties → 1 critical | YES | `test.mjs:239` |
| `::error` on stderr | YES | `test.mjs:247` |
| Empty input → 0 findings | YES | `test.mjs:252` |
| Colon in property value (`title=TypeError: x`) | YES | `test.mjs:258` |
| Control character stripping | YES | `test.mjs:266` |
| `getParser("github-actions")` round-trip | YES | `test.mjs:175` |

---

## Remaining Edge Cases

| Edge case | Tested? | Notes |
|---|---|---|
| `::error file=src/foo.js` (file, no line) | NO | `file || ''` fallback at `validator-parsers.mjs:138` untested |
| Mixed `::error` + `::warning` in same output | NO | Counters correct by inspection; not locked in |
| `::debug` or other non-diagnostic GA levels | NO | Correct; untested |
| `::notice` `meta.messages` content | NO | `test.mjs:230` only asserts `findings.suggestion === 1` |
| `--output-format github-actions` through `cmdGate` | NO | Wired at `gate.mjs:106`; no test exercises this path |
| Tool exits 0 but emits `::error` | NO | Verdict still PASS — `gate.mjs:96` hardcodes exit-code verdict |

---

## Gate Verdict Gap

`gate.mjs:96`: `const verdict = exitCode === 0 ? "PASS" : "FAIL";`

`parsed.findings.critical` is written to the gate handshake (line 142) but never consulted for the verdict. A validator that exits 0 while emitting `::error` commands produces a PASS gate verdict with `critical > 0` in the handshake — a contradictory state. Must go to backlog before this format can be described as providing gate enforcement.

---

## Findings

🟡 `bin/lib/gate.mjs:96` — gate verdict is `exitCode === 0 ? "PASS" : "FAIL"` regardless of `parsed.findings.critical`; a tool that exits 0 but emits `::error` commands still produces PASS verdict with critical findings in the handshake; add opt-in flag `--fail-on-findings` or adjust verdict when `parsed.findings.critical > 0` and format is not `exit-code`

🟡 `test/` — no test exercises `cmdGate` with `--output-format github-actions`; `gate.mjs:106–107` is wired but only unit-tested via direct `parseGithubActions` calls; add integration test invoking `cmdGate` with a command that echoes a `::error` line and `--output-format github-actions`, asserting `handshake.findings.critical === 1`

🔵 `test/validator-parsers.test.mjs:230` — `::notice` test asserts `findings.suggestion === 1` only; removing `messages.push(label)` at `validator-parsers.mjs:148` passes the test undetected; add assertion `meta.messages.length === 1`

🔵 `test/validator-parsers.test.mjs` — no test for `::error file=src/foo.js` (file present, line absent); the `file || ''` fallback at `validator-parsers.mjs:138` is untested; add case asserting `meta.messages[0] === "src/foo.js — message"`

🔵 `test/validator-parsers.test.mjs` — no combined-level test (`::error` + `::warning` in same input); independent `critical`/`warning` counters are correct but not locked in

🔵 `test/validator-parsers.test.mjs` — no test for `::debug` or other non-diagnostic GA command levels; silent-ignore path at `validator-parsers.mjs:141–150` is untested

---

## Verdict: PASS

Core acceptance criterion is met and directly tested. Three previously flagged 🟡 issues (regex bug, untested control-char strip, dead module) are resolved in run_3. The two new 🟡 findings (gate verdict ignores parser output; no cmdGate integration test) must go to backlog.

---

# Engineer Review — task-3 post-fix (GitHub Actions problem matcher parser)

**Reviewer**: Engineer
**Date:** 2026-04-26
**Verdict: PASS** (two 🟡 to backlog; no 🔴 blockers)

---

## Files Opened and Read

- `bin/lib/validator-parsers.mjs` (all 183 lines — directly read)
- `bin/lib/gate.mjs` (all 193 lines — directly read)
- `test/validator-parsers.test.mjs` (all 275 lines — directly read)
- `.team/features/external-validator-integration/tasks/task-3/handshake.json`

## Test Execution (direct evidence)

```
node --test test/validator-parsers.test.mjs

tests 25 | pass 25 | fail 0
```

Note: task-3 handshake claims "27 total tests, all passing" — actual count is 25. Minor discrepancy, not a blocker.

---

## Prior 🟡 Findings Status (from pre-fix reviews)

| Finding | Status |
|---|---|
| Regex `[^:]*` drops lines with `:` in property value (Engineer/Architect) | RESOLVED — changed to `(.*?)` at `validator-parsers.mjs:116` |
| Gate never calls `getParser`; findings hardcoded (Architect) | RESOLVED — `gate.mjs` imports/calls `getParser` at lines 14, 20, 106–107 |
| Control-char stripping not test-locked (Tester/Security) | RESOLVED — test at `test.mjs:266–274` asserts no control bytes in stored message |
| `getParser("github-actions")` test only asserts `typeof` (PM/Tester) | RESOLVED — round-trip invocation added at `test.mjs:175–178` |

---

## Core Acceptance Criterion

**Requirement**: `::error file=src/foo.js,line=5::message` → one critical finding.

**PASS** — `test.mjs:189–198` asserts all five conditions: `findings.critical === 1`, `findings.warning === 0`, `findings.suggestion === 0`, `meta.messages.length === 1`, `meta.messages[0] === "src/foo.js:5 — something went wrong"`. Confirmed by direct test execution (25 pass, 0 fail).

---

## Edge Cases Verified

| Case | Result |
|---|---|
| `::error file=src/foo.js,line=5::message` | ✓ 1 critical, correct location |
| `::error title=TypeError: x,file=...,line=5::message` | ✓ 1 critical, correct location |
| `::error title=foo::bar,file=...,line=5::message` | ✗ 1 critical but location lost, message corrupted (see finding below) |
| `::error::message` (no properties) | ✓ 1 critical, message only |
| `::warning` / `::notice` | ✓ correct buckets |
| Commands on stderr | ✓ picked up |
| `exitCode=0` with `::error` in output | `critical=1` in handshake but `verdict="PASS"` (see finding below) |
| Empty input | ✓ 0 findings |

---

## New Findings (not in prior reviews)

### 1. Gate verdict decoupled from parsed findings

Traced in `gate.mjs`:
- Line 96: `const verdict = exitCode === 0 ? "PASS" : "FAIL"` — exit-code only
- Lines 106–107: `parsed` computed after verdict is set
- Line 142: `parsed.findings.critical` written to handshake only
- Line 169: `task.status = "passed"` gated on `verdict` alone

Empirically confirmed: `parseGithubActions('::error file=src/foo.js,line=5::lint error', '', 0)` → `critical: 1`. With `exitCode = 0`: `verdict = "PASS"`, `task.status = "passed"`, despite `critical: 1` in handshake. Parser integration enriches reporting but has zero effect on gate outcome.

### 2. Non-greedy regex splits at first `::`, not last

The fix changed `[^:]*` → `(.*?)`. Non-greedy `(.*?)` resolves to the **first** `::` after the level, not the last. Property values containing `::` cause a wrong split. Empirically confirmed:

- Input: `::error title=foo::bar,file=src/foo.js,line=5::message`
- Actual: `meta.messages[0] = "bar,file=src/foo.js,line=5::message"` — location missing, message corrupted

The prior `[^:]*` broke on any single `:` in a value; this `(.*?)` breaks on `::`. Real-world impact is low (spec requires percent-encoding for `::`) but the failure mode is corrupted output rather than a missed finding. Fix: split on the **last** `::` occurrence.

---

## Findings

🟡 bin/lib/gate.mjs:96 — Verdict is exit-code-only; `parsed.findings.critical` feeds handshake.json but doesn't influence PASS/FAIL; a validator exiting 0 while emitting `::error` produces `verdict:"PASS"` and `task.status:"passed"` despite `critical > 0` in handshake; fix: `const verdict = (exitCode === 0 && parsed.findings.critical === 0) ? "PASS" : "FAIL"`, or document exit-code-is-authoritative as an explicit contract

🟡 bin/lib/validator-parsers.mjs:116 — Non-greedy `(.*?)` splits at first `::` in the line; property values containing `::` (e.g. `title=foo::bar`) cause wrong split: props truncated, message replaced with trailing fragment including remaining property text; confirmed empirically; fix by splitting on the last `::` occurrence rather than the first (e.g. find `lastIndexOf('::')` on the portion after the level)

🟡 bin/lib/validator-parsers.mjs:49 — `parseJunitXml` pushes `message`/`classname`/`file` verbatim without control-char stripping; `parseTap:81` and `parseGithubActions:119` both sanitize before push; inconsistent security posture (carried from Security task-1 run_1)

🔵 bin/lib/validator-parsers.mjs:154 — Summary omits suggestion count; `::notice` findings not reflected in `summary` string

🔵 test/validator-parsers.test.mjs:227 — `::notice` test doesn't assert `meta.messages` content; add assertion for stored message text

---

# Architect Review (run_2) — task-3: GitHub Actions problem matcher parser + gate.mjs integration

**Reviewer**: Architect
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Opened and Read

- `.team/features/external-validator-integration/tasks/task-3/handshake.json`
- `bin/lib/validator-parsers.mjs` (all 182 lines — directly read)
- `bin/lib/gate.mjs` (all 192 lines — directly read)
- `test/validator-parsers.test.mjs` (all 275 lines — directly read)
- `.team/features/external-validator-integration/tasks/task-3/eval.md` (all prior review sections through Security run_4)

## Test Execution (direct evidence)

```
node --test test/validator-parsers.test.mjs

tests 25 | pass 25 | fail 0
```

---

## Handshake Claims Verified

| Claim | Evidence | Status |
|---|---|---|
| Colon-in-property-value regex fix | `validator-parsers.mjs:116` — `(.*?)` non-greedy replaces prior `[^:]*` | CONFIRMED |
| `getParser` wired into `gate.mjs` via `--output-format` | `gate.mjs:14` import, `:20` flag, `:106–107` call, `:142` findings | CONFIRMED |
| 3 new tests added | `test.mjs:258–264` (colon case NEW), `test.mjs:266–274` (control char NEW), `test.mjs:172–178` (round-trip UPDATED) | PARTIAL — 2 new + 1 updated |
| 27 total tests passing | Direct execution: `tests 25, pass 25, fail 0` | **INCORRECT — off by 2** |

---

## Per-Criterion Results

### 1. Core requirement: `::error file=src/foo.js,line=5::message` → 1 critical finding

**PASS** — Test at `test.mjs:189–197` asserts all five conditions. Confirmed by direct execution.

### 2. Regex fix — colon in property value

**PASS** — `lineRe = /^::([a-z]+)\s*(.*?)::(.*)/` at line 116. The non-greedy `(.*?)` stops at the first `::` (double colon), not at `:` (single colon). Single colons in `title=TypeError: x` are transparent to it. Verified by direct execution: `parseGithubActions("::error title=TypeError: x,file=src/foo.js,line=5::msg", "", 1)` → `findings.critical === 1`. Prior 🟡 closed.

Residual: `(.*?)` stops at the FIRST `::`. A property value containing `::` would split incorrectly. This is narrower than the original flaw; acceptable for v1. Flagged 🔵.

### 3. Gate.mjs integration — highest-priority prior gap now resolved

**PASS** — `gate.mjs:14` imports `getParser`; `:20` reads `--output-format` flag (default `"exit-code"`); `:106–107` calls `const parser = getParser(outputFormat); const parsed = parser(stdout, stderr, exitCode);`; `:142` routes `parsed.findings` into the task handshake. The feature is no longer inert in production. All prior 🟡 findings about module non-reachability are closed.

### 4. Verdict vs. parsed findings — new gap introduced by integration

**WARN** — `verdict` at `gate.mjs:96` is `exitCode === 0 ? "PASS" : "FAIL"` — exit-code-only, unchanged. A linter that emits `::error` lines but exits 0 receives `verdict: "PASS"` in STATE.json and the console output, while the task handshake records `findings: { critical: N }`. These are contradictory signals for any consumer checking verdict. Whether `parsed.findings.critical > 0` should force `verdict = "FAIL"` when using a format-specific parser is an unresolved design question that must be answered before `--output-format github-actions` is documented as production-ready.

### 5. Module boundary and interface contract

**PASS** — `parseGithubActions(stdout, stderr, exitCode) → { findings, summary, meta: { messages } }` is consistent with all peer parsers. Bare function reference in registry. `getParser` fallback to `"exit-code"` is correct behavior for unknown formats.

### 6. Test count discrepancy

**WARN** — Handshake claims "27 total tests, all passing" and "3 new tests added." Direct execution: 25 pass. The `getParser("github-actions")` test at `test.mjs:172` was an in-place update (prior state: asserts `typeof` only; new state: also invokes parser with real input) — it is an updated test, not a new one. Net: 2 new tests, not 3; 25 total, not 27. Inaccurate evidence record.

---

## Edge Cases Checked

| Case | Result |
|------|--------|
| `::error file=src/foo.js,line=5::msg` | ✓ 1 critical, correct location |
| `::error title=TypeError: x,file=src/foo.js,line=5::msg` | ✓ 1 critical (colon fix confirmed) |
| `::error::msg` (no properties) | ✓ 1 critical, message only |
| `::warning` / `::notice` | ✓ 1 warning / 1 suggestion |
| Commands in stderr only | ✓ picked up via combined stream |
| Exit 0 + `::error` lines | `findings.critical: 1` ✓ but `verdict: "PASS"` ✗ — contradictory |
| Property value with `::` (double colon) | ✗ would split on first `::` — untested |

---

## Prior 🟡 Findings Status

| Prior finding | Status |
|---|---|
| `[^:]*` regex drops lines with `:` in property values | **RESOLVED** — `(.*?)` in place; test at `test.mjs:258` |
| `gate.mjs` never calls `getParser`; module inert in production | **RESOLVED** — wired at `gate.mjs:106–107`; findings in handshake |
| Control-char stripping not test-locked | **RESOLVED** — test at `test.mjs:266–274` asserts no `[\x00-\x1f]` bytes |
| `getParser("github-actions")` test only asserts `typeof` | **RESOLVED** — test at `test.mjs:172–178` invokes parser with real input |

---

## Findings

🟡 `bin/lib/gate.mjs:96` — `verdict` is exit-code-only; a linter emitting `::error` lines but exiting 0 receives `verdict: "PASS"` while the handshake records `findings.critical > 0`; decide whether `parsed.findings.critical > 0` forces `verdict = "FAIL"` when using a format-specific parser, and document the decision before `--output-format github-actions` is published

🟡 `.team/features/external-validator-integration/tasks/task-3/handshake.json:7` — claims "27 total tests" and "3 new tests"; direct execution: `tests 25, pass 25, fail 0`; the `getParser` round-trip was an in-place update to an existing test, not a new one; handshake overcounts by 2 total and 1 new test (process gap carried from all prior PM reviews)

🔵 `bin/lib/validator-parsers.mjs:116` — `(.*?)` non-greedy stops at the FIRST `::` in the line; property values containing `::` (e.g., `file=src::bar.js`) split incorrectly — narrower than the resolved `[^:]*` flaw but still heuristic; the spec-correct fix is to split on the last `::` via `lastIndexOf("::") `

🔵 `bin/lib/validator-parsers.mjs:180` — `PARSERS[format]` has no `Object.hasOwn` guard; `format = "__proto__"` returns `Object.prototype` (truthy), bypasses exit-code fallback, throws `TypeError`; use `Object.hasOwn(PARSERS, format) ? PARSERS[format] : PARSERS["exit-code"]` (carried from Security/Architect task-2)

---

## Overall Verdict: PASS

The stated requirement (`::error file=src/foo.js,line=5::message` → 1 critical finding) is correctly implemented and tested. The prior highest-priority architectural gap — `gate.mjs` never calling `getParser`, leaving all three parsers inert in production — is now resolved. The regex fix is correct for real-world inputs. Two 🟡 warnings go to backlog: the verdict/findings tension (`gate.mjs:96`) is the more architecturally significant one and should be resolved before `--output-format github-actions` is documented as production-ready.
