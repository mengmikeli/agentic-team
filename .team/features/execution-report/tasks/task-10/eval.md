# Tester Evaluation — execution-report / Title Column

**Reviewer role:** Tester
**Verdict: PASS**
**Date:** 2026-04-26
**Reviewed commits:** a6ea790 (HEAD), 4c76ec3, 62d246c, ab254c0

---

## Files Actually Read

- `bin/lib/report.mjs` (193 lines) — full implementation
- `test/report.test.mjs` (470 lines) — full test suite
- `.team/features/execution-report/tasks/task-3/handshake.json` — builder claim
- `.team/features/execution-report/tasks/task-7/handshake.json` — builder claim
- `.team/features/execution-report/tasks/task-8/eval.md` — prior tester review (107 lines)
- `git diff main...HEAD -- bin/lib/report.mjs test/report.test.mjs` — full branch diff

---

## Tests Independently Run

```
$ npm test
tests 558  |  suites 114  |  pass 556  |  fail 0  |  skipped 2  |  duration_ms 32645

$ node --test test/report.test.mjs
tests 33  |  pass 33  |  fail 0
```

All 33 report tests pass. Full suite passes with 556/558 (2 skipped, 0 fail).

---

## Handshake Verification

| Claim (task-3 handshake) | Verified | Evidence |
|--------------------------|----------|----------|
| Escape pipe chars in task.title | Yes | `escapeCell()` at report.mjs:8-10, called at line 63 |
| Reject `.` and `..` as feature names | Yes | Guard at report.mjs:163, tests at test:457-468 |
| Guard NaN duration from invalid createdAt | Yes | `Number.isFinite(mins)` at report.mjs:26, test at test:267-275 |
| All 556 tests pass | Yes | Ran full suite — 556 pass, 0 fail |

| Claim (task-7 handshake) | Verified | Evidence |
|--------------------------|----------|----------|
| Removed unreachable `\|\| "unknown"` fallback | Yes | report.mjs:90 uses `task.status.toUpperCase()` directly (tasks are pre-filtered) |
| Regression tests for blocked/failed without lastReason | Yes | Tests at test:163-181 |

---

## Prior Tester Findings (task-8) — Resolution Status

| Prior Finding | Status | Evidence |
|---------------|--------|----------|
| 🟡 `.`/`..` path traversal bypass | **FIXED** | report.mjs:163 explicit reject; tests at test:457-468 |
| 🟡 "No gate passes recorded" untested | **STILL UNTESTED** | Searched test file for "gate passes" / "No gate" — no match |
| 🟡 "X task(s) need attention" untested | **STILL UNTESTED** | Searched test file for "need attention" — no match |
| 🟡 NaN duration from invalid createdAt | **FIXED** | report.mjs:26 `Number.isFinite` guard; test at test:267-275 |
| 🔵 What Shipped fallback to task.id | **FIXED** | Test at test:277-286 asserts `"- task-1"` |
| 🔵 writeFileSync no try/catch | Unchanged | Acceptable for CLI context |
| 🔵 Empty state test | Unchanged | Low risk; defaults handle it |

---

## Title Column — Test Coverage Analysis

### Happy path — PASS

- **Title present in table:** Test at test:53-61 asserts the 5-column header `| Task | Title | Status | Attempts | Gate Verdict |` and title text "Do something" appears. Column ordering regression would break this.
- **Title absent in table:** Test at test:63-71 asserts `| task-1 | — |` substring — uniquely identifies the fallback. This cannot match other column positions because `task-1` is immediately followed by `—`.
- **Title in What Shipped:** Test at test:74-79 asserts `"- Do something"` and `"- Do something else"` bullets.
- **Title fallback to task.id in What Shipped:** Test at test:277-286 creates a passed task with no title and asserts `"- task-1"`.
- **Title in Blocked/Failed section:** Tests at test:109-122 and test:196-208 exercise `task.title || "(no title)"`.

### Edge cases — PASS (with gaps noted)

| Input | Expression | Result | Tested? |
|-------|-----------|--------|---------|
| `title = "Do X"` | `"Do X" \|\| "—"` | `"Do X"` | Yes (test:53-61) |
| `title = undefined` | `undefined \|\| "—"` | `"—"` | Yes (test:63-71) |
| `title = null` | `null \|\| "—"` | `"—"` | No explicit test; correct via JS semantics |
| `title = ""` | `"" \|\| "—"` | `"—"` | No explicit test; correct via JS semantics |
| `title = "Fix \| pipe"` | `escapeCell("Fix \| pipe")` | `"Fix \\| pipe"` | Yes (test:247-264); column count verified |
| `title = "line1\nline2"` | `escapeCell("line1\nline2")` | `"line1\nline2"` (unescaped) | No test; would break table row |
| Title in What Shipped (no title) | `task.title \|\| task.id` | `task.id` | Yes (test:277-286) |

### Pipe escape verification — PASS

Test at test:247-264 creates a title with embedded pipes `"Fix | pipe | issue"`, then:
1. Finds the table row containing `task-1` and `passed`
2. Asserts `\\|` (escaped pipe) appears in the row
3. Counts unescaped pipes via `split(/(?<!\\)\|/)` — asserts exactly 6 (correct for 5-column table: outer left + 4 separators + outer right)

This is a strong structural assertion that would catch both escaping failures and column count mismatches.

### `escapeCell` scope — Correct

`escapeCell` is applied only to the Title column in the Task Summary table (report.mjs:63). Other sections where `task.title` appears:
- What Shipped (line 51): bullet list — pipes are harmless in markdown list items
- Blocked/Failed (line 90): inline text — pipes are harmless outside tables

Selective application is correct for the markdown context of each section.

---

## Findings

🟡 test/report.test.mjs — "X task(s) need attention" recommendation (report.mjs:110-111) has no test. The `problem.length > 0 && problem.length < tasks.length` branch is untested. The stalled test (test:216-226) covers `problem.length === tasks.length`, and happy-path covers `problem.length === 0`, but the partial-problem case is missing. Add a state with 1 blocked + 1 passed task and assert the recommendation text.

🟡 test/report.test.mjs — "No gate passes recorded" recommendation (report.mjs:113-114) has no test. The `failGates > 0 && passGates === 0` condition is never exercised. Add a state with `gates: [{verdict: "FAIL"}]` and zero PASS verdicts, then assert the recommendation fires.

🔵 bin/lib/report.mjs:9 — `escapeCell` only escapes pipe `|` characters, not newline characters. A `task.title` containing `\n` would break the markdown table row, splitting it across two lines. Low risk since STATE.json is machine-generated by the harness, but `text.replace(/\n/g, " ")` would harden the table against unexpected input.

🔵 test/report.test.mjs — No explicit test for `title = ""` (empty string) or `title = null`. These are correct via JS `||` semantics, but explicit tests would document the contract that all falsy titles produce `—`.

---

## Edge Cases Verified

| Edge Case | Tested? | Behavior |
|-----------|---------|----------|
| Title present in table | Yes (test:53-61) | Renders in Title column |
| Title absent in table | Yes (test:63-71) | Shows `—` |
| Title with pipe chars | Yes (test:247-264) | Escaped with `\|`; column count intact |
| Title in What Shipped | Yes (test:74-79) | Bullet uses title text |
| What Shipped fallback to task.id | Yes (test:277-286) | Uses task.id when no title |
| Title in Blocked/Failed | Yes (test:109-122) | Shown with status label |
| Blocked task without title | Yes (test:163) | Shows "(no title)" fallback |
| Failed task without lastReason | Yes (test:173-181) | No "Reason:" line |
| `.`/`..` path traversal | Yes (test:457-468) | exit 1 + "invalid feature name" |
| NaN duration | Yes (test:267-275) | Falls back to "N/A" |
| Title with newline | Not tested | Would break table row (see 🔵) |
| Empty string title | Not tested | Correct via JS semantics |
| Null title | Not tested | Correct via JS semantics |
| Partial problem tasks | Not tested | Recommendation untested (see 🟡) |
| All FAIL gates, zero PASS | Not tested | Recommendation untested (see 🟡) |
| Duration exactly 60 min | Not tested | Code renders "1h" (verified by reading report.mjs:28-33) |
| Duration 0 min | Not tested | Code renders "0m" (verified by reading report.mjs:28) |

---

## Summary

The Title column implementation is well-tested. The core feature — adding a Title column to the Task Summary table with `task.title || "—"` fallback — has 5 test assertions covering the happy path (title present), fallback (title absent), pipe escaping, and the relationship to What Shipped and Blocked/Failed sections. Prior tester findings from task-8 have been largely addressed: the `.`/`..` path traversal bypass and NaN duration are both fixed with tests.

Two yellow findings remain from the prior tester review and are still unresolved: the "X task(s) need attention" and "No gate passes recorded" recommendation paths in `buildReport` have zero test coverage. These are pre-existing gaps in adjacent logic, not regressions from the Title column change. They should go to backlog.

No critical issues. The Title column feature is merge-ready.
