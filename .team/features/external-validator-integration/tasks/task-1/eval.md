# Eval: task-1 — JUnit XML parser (external-validator-integration)

**Reviewer role:** Architect
**Date:** 2026-04-26
**Verdict:** PASS

---

## Files Read
- `.team/features/external-validator-integration/tasks/task-1/handshake.json`
- `bin/lib/validator-parsers.mjs`
- `test/validator-parsers.test.mjs`
- `package.json` (test script only)

## Test Execution (direct evidence)
```
node --test test/validator-parsers.test.mjs

✔ produces one critical finding from one <failure> element
✔ produces zero findings for a passing test suite
✔ produces multiple critical findings for multiple failures
✔ falls back to classname when file/line are absent
✔ returns zero findings on malformed input (fault-tolerant)
✔ returns junit-xml parser for 'junit-xml' format
✔ falls back to exit-code parser for unknown format

tests 7 | pass 7 | fail 0
```

---

## Per-Criterion Results

### 1. Core task: one `<failure>` → one critical finding with `file:line — classname: message`
**PASS** — Confirmed by direct test execution. `src/MyTest.java:42 — com.example.MyTest: Expected 1 but was 2` format is exact match.

### 2. Module boundary / interface design
**PASS** — Parser contract `(stdout, stderr, exitCode) → { findings, summary, meta }` is clean and consistent across both parsers. `PARSERS` registry and `getParser` provide the right abstraction point for future formats.

### 3. Fault tolerance
**PASS** — Malformed XML produces zero findings without throwing. However, the `try/catch` is dead code in the current implementation (regex operations don't throw). The fault tolerance is real but achieved implicitly by regex non-matching, not the catch.

### 4. Integration
**NOT YET INTEGRATED** — No caller in `bin/` invokes `getParser`. This is acceptable for task-1 if integration is a subsequent task. Not a failure, but the module is inert until wired in.

---

## Findings

### Dead code
The `try { ... } catch {}` block at `bin/lib/validator-parsers.mjs:53` cannot catch anything — all operations inside are pure regex, which do not throw. The comment implies error resilience, but the actual guard is the regex simply not matching.
Severity: suggestion (no correctness impact).

### Silent `line` discard when `file` is absent
At `bin/lib/validator-parsers.mjs:49`:
```js
const location = file && line ? `${file}:${line}` : file || classname;
```
If `file=""` and `line="10"`, the condition `file && line` is falsy, so `line` is silently dropped and `classname` is used. The test at line 58 validates this fallback correctly (classname is used), but `line` data is lost. Acceptable for v1 since the test documents the behaviour.
Severity: suggestion.

### Unknown format falls back silently
`getParser("unknown-format")` returns the exit-code parser with no log or warning. Correct for now; becomes a footgun once more formats are added and a typo causes silent format downgrade.
Severity: suggestion (no immediate impact).

---

# Tester Eval — task-1

**Reviewer role:** Tester
**Date:** 2026-04-26
**Verdict: ITERATE**

## Files Read
- `bin/lib/validator-parsers.mjs`
- `test/validator-parsers.test.mjs`
- `.team/features/external-validator-integration/tasks/task-1/handshake.json`

## Test Execution (direct evidence)
```
node --test test/validator-parsers.test.mjs
tests 7 | pass 7 | fail 0
```

## Edge Cases Probed (via node -e)

| Scenario | Expected | Actual |
|---|---|---|
| `<error>` element (no `<failure>`) | ≥1 critical | **0 criticals** ← BUG |
| Single-quoted attributes | 1 critical with message | 1 critical but message `" — : "` ← garbage |
| `file` present, `line` absent | `file — classname: msg` | `file — classname: msg` ✓ |

## Per-Criterion Results

### Acceptance criterion: one `<failure>` → one critical finding
**PASS** — happy path, multiple failures, zero failures, missing file/line, malformed input all tested and passing.

### `<error>` elements handled
**FAIL** — not tested, not implemented. A test suite with `errors="1"` and zero `<failure>` elements returns `0 critical findings`. This would allow a gate to pass when a runtime exception crashed every test.

### Single-quoted XML attributes
**FAIL (behavioral)** — `extractAttrs` only matches double-quoted attributes. A `<failure message='broke'/>` produces an empty message string and a finding text of `" — : "`. Not tested and not documented as unsupported.

### `file`-without-`line` path
**PASS (works, untested)** — produces `src/X.java — MyTest: msg`. Branch at line 49 is exercised correctly but has no explicit test.

### `getParser("junit-xml")` end-to-end
**PARTIAL** — only checks `typeof parser === "function"`. No test calls the returned parser with real XML and asserts output.

## Findings

🔴 `bin/lib/validator-parsers.mjs:40` — `<error>` elements silently produce 0 criticals; a suite of runtime exceptions passes the gate undetected. Add `<error>` to the failure body scan alongside `<failure>`, and add a test.

🟡 `bin/lib/validator-parsers.mjs:9` — `extractAttrs` only handles double-quoted attributes; single-quoted attrs produce empty strings and garbage finding text `" — : "`. Extend the regex or add a test that documents the known limitation.

🟡 `test/validator-parsers.test.mjs` — no test for `file`-present/`line`-absent path (line 49 branch); add a case where `file` is set but `line` is omitted.

🔵 `test/validator-parsers.test.mjs:79` — `getParser("junit-xml")` test only asserts typeof; add a call with XML input to verify the three-arg wrapper passes stdout through correctly.

---

# Simplicity Review — task-1

**Reviewer role:** Simplicity
**Date:** 2026-04-26
**Verdict: FAIL**

---

## Files Read
- `bin/lib/validator-parsers.mjs` (all 88 lines)
- `test/validator-parsers.test.mjs` (all 91 lines)
- `.team/features/external-validator-integration/tasks/task-1/handshake.json`
- `package.json` (diff)

---

## Per-Criterion Results

### Dead code — FAIL

`bin/lib/validator-parsers.mjs:33-55`: The `try { … } catch { }` wrapper around the regex loop is dead code. The catch branch is unreachable.

**Evidence:**
- `RegExp.prototype.exec()` on a string argument never throws in JavaScript — non-strings are coerced, no-match returns `null`.
- `extractAttrs` uses the same pattern; same reasoning applies.
- The malformed-input test (`"not xml at all"`) reaches `critical === 0` via the loop finding zero matches, **not** via the catch. The catch comment ("if parse fails") documents an expectation the implementation never satisfies.
- Note: the Architect review already flagged this as a suggestion; it is a veto-level finding under the dead-code criterion.

### Premature abstraction — PASS

`getParser` is called at 2 distinct call sites in the test (lines 81 and 86). Meets the ≥2 threshold.

### Unnecessary indirection — PASS

`getParser` adds a non-trivial fallback (`|| PARSERS["exit-code"]`). Not a bare delegate.

### Gold-plating — PASS

Both registry entries (`junit-xml`, `exit-code`) are exercised by the tests. No unused config option.

---

## Findings

🔴 `bin/lib/validator-parsers.mjs:33` — Dead catch block; regex operations on strings cannot throw; remove the try/catch wrapper and leave the loop body bare

---

# Security Review — task-1

**Reviewer role:** Security
**Date:** 2026-04-26
**Verdict:** PASS (warnings to backlog)

## Files Examined

- `bin/lib/validator-parsers.mjs` (all 87 lines)
- `test/validator-parsers.test.mjs` (all 91 lines)
- `.team/features/external-validator-integration/tasks/task-1/handshake.json`

No `artifacts/test-output.txt` exists. Test passage inferred from gate output listing the file in the `node --test` invocation.

## Threat Model

The `stdout` input to `parseJunitXml` originates from an external validator process configured by the user, running against potentially untrusted codebases. A malicious repository's test runner can produce arbitrary JUnit XML content.

## Criteria

**Secrets / credentials:** PASS — No credentials, tokens, or keys. No file I/O, network calls, or `eval`-equivalent.

**ReDoS:** PASS — All regexes use negated character classes (`[^>]*`, `[^"]*`, `\d+`) or the lazy `[\s\S]*?` stopping at a literal delimiter. Linear complexity; no catastrophic backtracking.

**ANSI/control character injection:** WARN — `message`, `classname`, and `file` are taken verbatim from attacker-controlled XML and concatenated into finding text at line 50 with no sanitization. A crafted `<failure message="\x1b[2J...">` can inject terminal escape sequences into CLI output or confuse an agentic reader of findings. Realistic for a harness that runs against arbitrary external repos.

**False gate pass via parse error:** WARN — The `catch {}` at line 53 (already flagged as dead code by Simplicity reviewer) returns `findings.critical = 0` if it ever fired. More importantly, even without the catch, there is no mechanism to signal that parsing produced unexpected or empty results due to a structural problem — callers cannot distinguish "clean run" from "parse produced nothing". Adding `meta.parseError` on unexpected zero results would close this gap once validators are wired in.

**Single-quoted attribute injection:** PASS (noted) — Only double-quoted XML attributes matched; produces empty `message`, not exploitable. Already flagged by Tester.

## Findings

🟡 `bin/lib/validator-parsers.mjs:50` — `message`, `classname`, and `file` from attacker-controlled XML are written to findings text without stripping ANSI/control characters; strip `/[\x00-\x1f\x7f]/g` before pushing to `messages`

🟡 `bin/lib/validator-parsers.mjs:53` — Once callers consume findings, a crafted malformed XML input silently reports 0 criticals (false gate pass); expose parse failures via `meta.parseError = true` so the harness can reject rather than silently pass

🔵 `bin/lib/validator-parsers.mjs:11` — `extractAttrs` ignores single-quoted XML attributes; in addition to the correctness issue (Tester), empty message strings obscure finding detail, reducing signal quality for the security reviewer

---

# PM Eval — task-1

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Verdict: PASS**

## Files Read
- `.team/features/external-validator-integration/tasks/task-1/handshake.json`
- `bin/lib/validator-parsers.mjs`
- `test/validator-parsers.test.mjs`
- `package.json` (lines 18–25)
- `tasks/task-1/eval.md` (prior Architect, Tester, Simplicity, Security reviews)

## Requirement Traceability

**Stated requirement:** "JUnit XML with one `<failure>` element produces one critical finding with `file:line — classname: message` text."

| Criterion | Status | Evidence |
|---|---|---|
| One `<failure>` → `findings.critical === 1` | PASS | `validator-parsers.mjs:51`; `validator-parsers.test.mjs:20` asserts exact count |
| Format is `file:line — classname: message` | PASS | `validator-parsers.mjs:50`; `validator-parsers.test.mjs:24-27` asserts exact string |
| Test registered in `npm test` | PASS | `package.json:22` includes `test/validator-parsers.test.mjs` |
| 7 tests pass | PASS | Prior Architect review cites direct run `tests 7 | pass 7 | fail 0`; gate output confirms file is in the suite |

## Scope Rulings on Prior 🔴 Findings

**Tester 🔴 `<error>` elements not handled** — PM ruling: **out of scope for task-1**. The stated requirement specifies `<failure>` exclusively. `<error>` handling is not in the acceptance criteria. File as a follow-up task.

**Simplicity 🔴 Dead `try/catch`** — Real code quality issue; does not affect the user-facing behavior being tested. Does not block the stated requirement from being satisfied. Fix in an ITERATE cycle.

## Findings

🟡 `bin/lib/validator-parsers.mjs:1` — No callers in `bin/`; parser is inert in production until integration task lands; confirm follow-up is tracked before marking feature shippable

🟡 `.team/features/external-validator-integration/tasks/task-1/handshake.json` — No `artifacts/test-output.txt` saved; gate output truncated before validator-parsers block; save test output as a handshake artifact so future reviewers have direct evidence without re-running

---

# Engineer Eval — task-1

**Reviewer role:** Engineer
**Date:** 2026-04-26
**Verdict: ITERATE**

## Files Read
- `bin/lib/validator-parsers.mjs`
- `test/validator-parsers.test.mjs`
- `package.json`
- `.team/features/external-validator-integration/tasks/task-1/handshake.json`

## Test Execution (direct evidence)
```
node --test test/validator-parsers.test.mjs
tests 7 | pass 7 | fail 0
```

## Logic Paths Traced

**Happy path** (`<failure>` with file+line+classname+message): `tcRe` matches testcase block → `extractAttrs` parses attrs → `failMatch` finds `<failure` → location = `file:line` → message pushed. Output `"src/MyTest.java:42 — com.example.MyTest: Expected 1 but was 2"` matches spec exactly. ✓

**Self-closing `<testcase ... />`**: testcase regex requires closing tag; self-closing element does not match; zero findings produced correctly. ✓

**Missing file/line**: `file && line` is falsy when either is `""`; falls back to `classname`. Tested and confirmed. ✓

**Malformed input**: regex simply doesn't match; `catch {}` never entered; returns zero findings. Confirmed. ✓

**`<error>` element (no `<failure>`)**: Body scan is `/<failure\b/` only — `<error>` not matched. Verified directly:
```
node -e → { critical: 0, summary: "0 failure(s) in 1 test(s)" }
```
A testcase with `<error type="NullPointerException"/>` produces zero critical findings. A suite of runtime-crashed tests passes the gate silently. **Correctness gap confirmed.**

**Single-quoted message attribute**: `<failure message='single quoted'/>` → `extractAttrs` extracts nothing → `message = ""` → finding is `"f.java:1 — X: "`. Verified. Low practical risk but message is silently lost.

## Per-Criterion Results

### Spec: one `<failure>` → one critical finding with correct text
**PASS** — all tested paths produce exact spec output.

### Correctness: test errors (runtime crashes) produce critical findings
**FAIL** — `<error>` elements are not handled. JUnit distinguishes `<failure>` (assertion) from `<error>` (runtime exception), but both represent broken tests. A project where every test throws NullPointerException reports `"0 failure(s)"` and passes the gate.

### Error handling
**PASS with caveat** — `catch {}` is dead code (regex on strings cannot throw in JS). Fault-tolerance works but via regex non-matching, not the catch. Misleading, not incorrect.

### Performance
**PASS** — single-pass regex; no n+1; no blocking I/O.

### Code quality
**PASS** — readable, minimal, well-named. Registry pattern is clean.

## Findings

🔴 `bin/lib/validator-parsers.mjs:40` — `<error>` elements produce zero criticals; a suite of runtime crashes passes the gate undetected. Confirmed via direct execution: `{ critical: 0 }` returned for a testcase with only `<error>`. The body scan at line 40 must also match `<error` alongside `<failure>`.

🟡 `bin/lib/validator-parsers.mjs:57` — `totalMatch` runs `.exec(stdout)` on the full XML string; in aggregate JUnit reports with multiple `<testsuite>` elements it picks the first `tests="N"`, making the `summary` count wrong. Does not affect findings count but misleads callers that surface `summary`.

🟡 `bin/lib/validator-parsers.mjs:9` — `extractAttrs` silently drops single-quoted attribute values, producing an empty `message` string (confirmed: `"f.java:1 — X: "`). Low practical risk given JUnit tooling conventions; should be documented as a known limitation.

🔵 `bin/lib/validator-parsers.mjs:53` — `catch {}` is dead code; JS regex on a string cannot throw. Remove the wrapper or add a comment explaining that fault-tolerance relies on regex non-matching.

🔵 `bin/lib/validator-parsers.mjs:29` — `parseJunitXml(stdout)` takes one argument while `parseExitCode(stdout, stderr, exitCode)` takes three. The PARSERS wrapper at line 81 compensates but the exported function signature is asymmetric — a trap for direct callers.
