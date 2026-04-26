# Engineer Review — execution-report / Review Fix Build (task-15)

**Reviewer role:** Engineer
**Verdict: PASS**
**Date:** 2026-04-26
**Reviewed commit:** b0d29f9 (HEAD of feature/execution-report)

---

## Files Actually Read

- `bin/lib/report.mjs` (209 lines, full) — production implementation
- `test/report.test.mjs` (799 lines, full) — test suite
- `bin/agt.mjs` (grep: lines 19, 75, 188-194, 248, 868) — CLI wiring
- `bin/lib/util.mjs:190-198` — `readState` function
- `.team/features/execution-report/tasks/task-15/handshake.json` — builder claim (current)
- `.team/features/execution-report/tasks/task-14/handshake.json` — prior builder claim
- `.team/features/execution-report/tasks/task-13/handshake.json` — prior builder claim
- `.team/features/execution-report/tasks/task-12/eval.md` (590 lines) — prior engineer + architect reviews
- `.team/features/execution-report/tasks/task-15/eval.md` — security review
- `.team/features/execution-report/tasks/task-16/eval.md` — PM review
- `.team/features/execution-report/tasks/task-17/eval.md` — tester review
- `.team/features/execution-report/tasks/task-18/eval.md` — PM review
- `.team/features/execution-report/tasks/task-19/eval.md` — tester review
- `.team/features/execution-report/tasks/task-20/eval.md` — PM review (current round)

---

## Tests Independently Run

```
$ node --test test/report.test.mjs
tests 61  |  suites 2  |  pass 61  |  fail 0  |  duration_ms 283

$ npm test
tests 581  |  suites 114  |  pass 579  |  fail 0  |  skipped 2  |  duration_ms 27903
```

Report-specific: 61 pass, 0 fail. Full suite: 579 pass, 0 fail, 2 skipped.

---

## Builder Claim Verification (task-15 handshake)

> "Fixed review findings: added negative duration guard (Math.max(0, mins)), wrapped writeFileSync in try/catch for --output md mode, added costUsd type check before .toFixed(), sanitized error messages against ANSI injection, and added 10 new tests covering duration formatting, multiple gates, \r\n escaping, empty tasks, costUsd=0, _last_modified fallback, (no title) assertion, slash path traversal, and writeFileSync failure. All 61 report tests and 579 total tests pass."

| Claim | Evidence | Confirmed? |
|-------|----------|------------|
| Math.max(0, mins) guard | report.mjs:31 — `Math.max(0, Math.round(...))` | Yes |
| writeFileSync try/catch | report.mjs:197-203 — try/catch with stderr error message + exit(1) | Yes |
| costUsd type check | report.mjs:78 — `typeof totalCostUsd === "number" && Number.isFinite(totalCostUsd)`; report.mjs:85 — same for per-phase | Yes |
| ANSI sanitization | report.mjs:13-16 — `stripAnsi()` function; used at lines 167, 173 | Yes |
| 10 new tests | 8 new buildReport (lines 432-532) + 2 new cmdReport (lines 781-798) = 10 | Yes |
| 61 report tests pass | Independent run: 61 pass, 0 fail | Yes |
| 579 total tests pass | Independent run: 579 pass, 0 fail, 2 skipped | Yes |

**All builder claims verified.**

---

## Prior Findings — Resolution Status

| Prior Finding | Source | Status | Evidence |
|---------------|--------|--------|----------|
| 🟡 `escapeCell` doesn't strip newlines | task-12 engineer | **FIXED** | report.mjs:9 `replace(/[\r\n]+/g, " ")` |
| 🟡 Negative duration unguarded | task-12 engineer, task-17/19 tester | **FIXED** | report.mjs:31 `Math.max(0, ...)` |
| 🟡 Duration >=60 min untested | task-17/19 tester | **FIXED** | test:445-466 (30m, 2h, 1h 30m) |
| 🟡 "Last gate verdict wins" untested | task-19 tester | **FIXED** | test:468-483 |
| 🔵 costUsd type not checked | task-15 security | **FIXED** | report.mjs:78,85 type guard |
| 🔵 ANSI in error messages | task-15 security | **FIXED** | `stripAnsi()` at lines 167, 173 |
| 🔵 `_last_modified` fallback untested | task-17/19 tester | **FIXED** | test:514-522 |
| 🔵 `(no title)` not explicitly asserted | task-17/19 tester | **FIXED** | test:524-532 |
| 🔵 writeFileSync unhandled crash | task-17 tester | **FIXED** | report.mjs:197-203; test:790-798 |
| 🟡 `escapeCell` applied only to title cell | task-12 architect | **Open** — non-title cells are harness-controlled |
| 🔵 Title fallback inconsistency | task-12 architect | **Open** — cosmetic |

All prior 🟡 findings from engineer and tester reviews are resolved. Two low-risk architect items carry forward.

---

## Per-Criterion Results

### 1. Correctness — PASS

Traced each fix through its specific logic path:

**Math.max(0, mins) — report.mjs:31:**
Input: `createdAt=12:00, completedAt=10:00` (2h before start). `endMs - startMs` yields negative. `Math.round(...)` stays negative. `Math.max(0, negative)` clamps to 0. `0 < 60` → renders `"0m"`. Verified by test at line 432-443 which asserts `Duration: 0m`.

**writeFileSync try/catch — report.mjs:197-203:**
On `throw new Error("EACCES")`, catch block writes `"report: failed to write <path>: EACCES"` to stderr, calls `_exit(1)`, returns. The `return` after `_exit(1)` prevents continued execution even if `_exit` doesn't throw (defensive). Verified by test at line 790-798.

**costUsd type guard — report.mjs:78:**
`typeof totalCostUsd === "number" && Number.isFinite(totalCostUsd)` rejects: `undefined` (typeof "undefined"), `null` (typeof "object"), `"string"` (typeof "string"), `NaN` (not finite), `Infinity` (not finite). Accepts `0` — verified by test at line 506-512 asserting `$0.0000`.

**Per-phase cost guard — report.mjs:85:**
Same pattern: `typeof c === "number" && Number.isFinite(c)`. Verified by test at line 274-284 where a phase has missing costUsd → renders `"N/A"`.

**stripAnsi — report.mjs:13-16:**
Regex `\x1b\[[0-9;]*[a-zA-Z]` matches standard CSI escape sequences (`\x1b[31m`, `\x1b[0m`, `\x1b[38;2;255;0;0m`). Applied to `outputVal` at line 167 and `featureName` at line 173 before writing to stderr. Prevents terminal escape injection in error messages.

### 2. Code Quality — PASS

- Pure `buildReport` / side-effectful `cmdReport` separation is clean and correct
- `buildReport` is 114 lines (18-131), readable top-to-bottom in one pass
- `cmdReport` is 66 lines (143-208) with 6 early-return guard clauses in validation order
- `stripAnsi` helper is private (unexported), single-responsibility, 4 lines
- Error messages include the problematic value, the path, and the original error for diagnostics
- Dependency injection via `deps = {}` with real defaults — clean, no global mocking needed

### 3. Error Handling — PASS

Six error paths in `cmdReport`, consistent pattern (stderr write → exit(1) → return):

| # | Guard | Line | Message | Test |
|---|-------|------|---------|------|
| 1 | Missing feature name | 160-163 | "Usage: agt report \<feature\>" | test:572-576 |
| 2 | Unsupported --output format | 166-169 | "unsupported output format: \<value\>" | test:690-704 |
| 3 | Path traversal | 172-175 | "invalid feature name: \<name\>" | test:708-727 |
| 4 | Missing feature directory | 180-183 | "not found: \<path\>" | test:581-585 |
| 5 | Missing STATE.json | 187-190 | "STATE.json missing or unreadable" | test:590-594 |
| 6 | writeFileSync failure | 199-202 | "failed to write \<path\>: \<error\>" | test:790-798 |

All write to `_stderr`. All call `_exit(1)`. All have `return` for defense. All tested. Validation order is correct (cheapest checks first, I/O last).

### 4. Performance — PASS

No changes to algorithmic profile. O(tasks * gates) at line 67 — adequate for CLI report generation over small datasets. `stripAnsi` adds one regex replace per error path only (not on happy path). No blocking I/O in `buildReport`. No concerns.

---

## Edge Cases Checked

| Edge Case | Covered? | How Verified |
|-----------|----------|--------------|
| Negative duration (clock skew) | Yes (test) | test:432-443 — asserts Duration: 0m |
| Duration 30m | Yes (test) | test:450-451 |
| Duration exactly 2h | Yes (test) | test:456-457 |
| Duration 1h 30m | Yes (test) | test:462-463 |
| Invalid createdAt (NaN) | Yes (test) | test:323-331 |
| costUsd = 0 | Yes (test) | test:506-512 — asserts $0.0000 |
| costUsd absent | Yes (test) | test:244-248 |
| costUsd in byPhase absent | Yes (test) | test:274-284 |
| _last_modified fallback | Yes (test) | test:514-522 |
| Empty tasks array | Yes (test) | test:498-504 |
| (no title) in Blocked section | Yes (test) | test:524-532 |
| \r\n in task title (table) | Yes (test) | test:485-496 |
| Pipe in task title (table) | Yes (test) | test:286-304 |
| Newline in task title (table) | Yes (test) | test:306-321 |
| Slash in feature name | Yes (test) | test:781-786 |
| writeFileSync throws | Yes (test) | test:790-798 |
| Last gate verdict wins | Yes (test) | test:468-483 |
| Multiple simultaneous recs | Yes (test) | test:383-407 |
| E2E: real STATE.json -> stdout | Yes (test) | test:731-752 |
| E2E: real STATE.json -> REPORT.md | Yes (test) | test:756-777 |
| **Newline in title (What Shipped)** | **No** | report.mjs:57 uses raw `task.title` |
| **Newline in title (Blocked/Failed)** | **No** | report.mjs:99 uses raw `task.title` |

---

## Findings

🟡 bin/lib/report.mjs:57 — Newlines in `task.title` are sanitized for the table (via `escapeCell` at line 69) but not in the "What Shipped" bullet list: `lines.push(`- ${task.title || task.id}`)`. A title containing `\n` would split the bullet into multiple lines, breaking markdown formatting. Same class of bug that was fixed for the table in task-13. Apply `.replace(/[\r\n]+/g, " ")` before interpolation.

🟡 bin/lib/report.mjs:99 — Same gap in "Blocked / Failed Tasks": `task.title || "(no title)"` is not sanitized against newlines. A `\n` in the title would break the `[BLOCKED] task-1: ...` indented line format. Same fix.

---

## Summary

The task-15 build resolved all prior 🟡 findings from engineer and tester reviews:
- Negative duration → clamped to 0 via `Math.max`
- writeFileSync crash → wrapped in try/catch with descriptive error
- costUsd type safety → `typeof` + `Number.isFinite` guard
- ANSI injection → `stripAnsi` on user-facing error strings
- 10 new tests covering all fixed behavior plus edge cases

All 61 report tests and 579 total tests pass independently. Code quality is solid: clean pure/side-effect separation, consistent error handling pattern, proper dependency injection.

Two 🟡 findings: newline sanitization is applied inconsistently — `escapeCell` handles newlines for the table (line 69) but the What Shipped (line 57) and Blocked/Failed (line 99) sections use raw `task.title`. These are the same class of formatting bug fixed for tables in task-13. Low risk in practice (STATE.json task titles are machine-generated and single-line) but should go to backlog for consistency.

**Overall verdict: PASS**
