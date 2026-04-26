# Tester Evaluation — execution-report / Three New Unit Tests (task-14)

**Reviewer role:** Tester
**Verdict: PASS**
**Date:** 2026-04-26
**Reviewed commit:** 804f86b (HEAD of feature/execution-report)

---

## Files Actually Read

- `bin/lib/report.mjs` (194 lines, full) — production implementation
- `test/report.test.mjs` (627 lines, full) — test suite
- `.team/features/execution-report/tasks/task-14/handshake.json` — builder claim
- `.team/features/execution-report/tasks/task-13/handshake.json` — prior builder claim
- `.team/features/execution-report/tasks/task-14/eval.md` — simplicity review
- `.team/features/execution-report/tasks/task-15/eval.md` — prior tester review (40 tests)
- `.team/features/execution-report/tasks/task-16/eval.md` — PM review
- `.team/features/execution-report/tasks/task-17/eval.md` — prior tester review (48 tests)
- `.team/features/execution-report/tasks/task-18/eval.md` — PM review (current round)

---

## Tests Independently Run

```
$ node --test test/report.test.mjs
tests 49  |  suites 2  |  pass 49  |  fail 0  |  duration_ms 175

$ npm test
tests 569  |  suites 114  |  pass 567  |  fail 0  |  skipped 2  |  duration_ms 32350
```

Report-specific: 49 pass, 0 fail. Full suite: 567 pass, 0 fail, 2 skipped.

---

## Handshake Verification (task-14)

| Claim | Evidence | Confirmed? |
|-------|----------|------------|
| Three specific tests (title column, What Shipped present, What Shipped absent) pass | Tests at test/report.test.mjs:53-61, :74-79, :82-90 all pass | Yes |
| All 49 report tests pass with 0 failures | `node --test test/report.test.mjs`: 49 pass, 0 fail | Yes |
| 567 total project tests pass with 0 failures | `npm test`: 567 pass, 0 fail, 2 skipped | Yes |
| Artifacts: test/report.test.mjs, bin/lib/report.mjs | Both files exist and contain claimed functionality | Yes |

**All builder claims verified.**

---

## The Three Claimed Tests — Quality Assessment

### 1. "includes Task Summary section with Title column" (test:53-61)

Tests section heading, exact 5-column header format `| Task | Title | Status | Attempts | Gate Verdict |`, task ID presence, title content "Do something", and gate verdict "PASS". The exact header string assertion locks down column structure. Combined with the pipe-escaping test at test:286-304 that counts exact column delimiters, column integrity is well-covered.

### 2. "includes What Shipped section for passed tasks" (test:74-79)

Verifies `## What Shipped` heading present and both passed tasks from `makeState()` appear as bullet items `"- Do something"` and `"- Do something else"`. Tests both filtering logic (only passed tasks) and formatting.

### 3. "omits What Shipped section when no tasks passed" (test:82-90)

Creates state with only blocked tasks and asserts `## What Shipped` heading is absent. Validates the guard at report.mjs:48 `if (passedTasks.length > 0)`.

**All three tests are well-constructed, testing distinct behavior with appropriate assertions.**

---

## Delta from Prior Tester Reviews

### From task-15 eval (40 tests):

| Finding | Status | Evidence |
|---------|--------|----------|
| 🔵 `escapeCell` doesn't handle newlines | **FIXED** | report.mjs:9 now strips `\r\n`; test at test:306-321 |
| 🔵 `(no title)` fallback not explicitly asserted | Still open | test:163 only checks `!report.includes("Reason:")` |
| 🔵 No test for `title: ""` or `title: null` | Still open | JS `||` handles both; no explicit test |

### From task-17 eval (48 tests):

| Finding | Status | Evidence |
|---------|--------|----------|
| 🟡 Duration `>=60 min` formatting untested | **Still open** | report.mjs:31-33 exercised but not asserted |
| 🟡 Negative duration unguarded | **Still open** | report.mjs:28 has no `mins < 0` guard |
| 🔵 `_last_modified` fallback untested | Still open | report.mjs:23 not explicitly tested |

---

## Full Coverage Map (49 tests)

### buildReport — 34 tests covering 6 sections

| Section | Code lines | Tests | Branches covered |
|---------|-----------|-------|------------------|
| Header (status, duration) | 19-44 | 6 | completed, failed, blocked, executing, N/A duration, invalid date |
| What Shipped | 47-54 | 4 | passed present, no passed, title present, title absent (id fallback) |
| Task Summary | 57-65 | 5 | title present, title absent, no gates, pipe escaping, newline stripping |
| Cost Breakdown | 67-83 | 5 | cost present, cost absent, byPhase present, byPhase absent, phase missing costUsd |
| Blocked/Failed | 86-94 | 5 | blocked+reason, blocked-no-reason, failed+reason, failed-no-reason, section absent |
| Recommendations | 97-120 | 9 | high attempts (fire+boundary), gate warnings, stalled, partial, all-fail gates, no-gates, simultaneous, dedup |

### cmdReport — 15 tests covering 5 error paths + 2 output modes

| Path | Code lines | Tests |
|------|-----------|-------|
| Missing feature name | 151-155 | 1 |
| Invalid --output format | 157-161 | 2 (bad value + no value) |
| Path traversal | 163-167 | 3 (`../../etc`, `.`, `..`) |
| Missing feature dir | 171-175 | 1 unit + 1 integration |
| Missing STATE.json | 178-182 | 1 |
| Stdout output | 184-192 | 2 (normal + blocked tasks) |
| --output md | 186-189 | 3 (writes file, no stdout, reversed arg order) |
| agt help report | — | 1 integration |

---

## Edge Cases Checked

| Edge Case | Tested? | Behavior | How verified |
|-----------|---------|----------|--------------|
| Title present | Yes | Renders in table | test:53-61 |
| Title undefined | Yes | Shows `—` | test:63-72 |
| Title `""` (empty) | No | Shows `—` | Code: `"" \|\| "—"` -> `"—"` (JS falsy) |
| Title `null` | No | Shows `—` | Code: `null \|\| "—"` -> `"—"` (JS falsy) |
| Title with `\|` pipe | Yes | Escaped `\\\|` | test:286-304, column count verified |
| Title with `\n` newline | Yes | Stripped to space | test:306-321 |
| What Shipped all passed | Yes | Lists all titles | test:74-79 |
| What Shipped no passed | Yes | Section absent | test:82-90 |
| What Shipped title absent | Yes | Falls back to task.id | test:333-342 |
| Invalid createdAt (NaN) | Yes | Duration `N/A` | test:323-331 |
| Duration < 60 min | Implicit | Renders `Xm` | Default makeState 60min |
| Duration >= 60 min | **Exercised, not asserted** | `Xh Ym` | **report.mjs:31-33 no assertion** |
| Negative duration | **No** | Renders `-Xm` | **No guard at report.mjs:28** |
| Multiple gates per task | **No** | Last verdict shown | **report.mjs:62 untested** |
| `_last_modified` fallback | No | Used when `completedAt` absent | report.mjs:23 |
| Path traversal | Yes | exit 1 | test:606-625 |
| `--output` edge cases | Yes | exit 1 for bad/missing value | test:588-602 |

---

## Findings

🟡 bin/lib/report.mjs:31 — Duration formatting for `>=60 min` is untested (carried from task-17). Lines 31-33 have two branches: `${hours}h ${rem}m` (remainder > 0) and `${hours}h` (exact hour). Default `makeState()` produces exactly 60 min but no test asserts on the rendered duration string. Add a test with `completedAt: "2026-01-01T12:30:00.000Z"` asserting `Duration` contains `2h 30m`.

🟡 bin/lib/report.mjs:28 — Negative duration is unguarded (carried from task-17). If `completedAt` precedes `createdAt` (clock skew, corrupt STATE.json), the report renders e.g. `Duration: -1440m`. Add `if (mins < 0) duration = "N/A"` guard and a test with reversed timestamps.

🟡 bin/lib/report.mjs:62 — "Last gate verdict wins" behavior is untested. The code takes `taskGates[taskGates.length - 1].verdict` for tasks with multiple gates. No test creates a task with multiple gate entries (e.g., FAIL then PASS) to verify the last verdict is displayed. If someone changed the index to `0`, no test would catch the regression. Add a test with `gates: [{taskId: "task-1", verdict: "FAIL"}, {taskId: "task-1", verdict: "PASS"}]` and assert the table row shows `PASS`.

🔵 bin/lib/report.mjs:23 — The `_last_modified` fallback for in-progress features is not explicitly tested. A test setting `completedAt: undefined` with a known `_last_modified` value would verify the fallback calculates correct duration.

🔵 test/report.test.mjs:163 — The `(no title)` fallback text in Blocked/Failed section (report.mjs:90) is exercised but not explicitly asserted. Only `!report.includes("Reason:")` is checked. Adding `assert.ok(report.includes("(no title)"))` would lock down the fallback string.

---

## Test Infrastructure Assessment

1. **Pure function testing**: `buildReport` tested as pure function (state in, string out). Correct level.
2. **Dependency injection**: `cmdReport` accepts `deps` object with 7 injectables. `makeDeps()` captures all side effects. Correct pattern.
3. **Exit simulation**: `exit: (code) => { exitCode = code; throw ... }` correctly prevents continued execution, matching real `process.exit` behavior.
4. **Integration tests**: Two `spawnSync` tests exercise real `bin/agt.mjs` binary. Good for catching wiring issues.
5. **Deterministic**: All synchronous. No timing dependencies, no race conditions. Temp dirs use unique names. No flaky risk.
6. **Assertion strength**: Pipe escape test (test:286-304) validates both escape correctness AND column structure via `split(/(?<!\\)\|/).length`. The three new tests use appropriate `includes()` for their purpose.

---

## Summary

Builder's claims fully verified. The three new unit tests are well-constructed, test distinct behavior (title column presence, What Shipped present, What Shipped absent), and pass alongside all 46 existing report tests and 518 other project tests.

Three 🟡 findings:
1. Duration `>=60 min` formatting untested (carried from task-17)
2. Negative duration unguarded (carried from task-17)
3. "Last gate verdict wins" at report.mjs:62 untested (new finding — no test creates a task with multiple gate entries to verify last-wins indexing)

None block merge. All should go to backlog. The first two are inherited from the prior tester round. The third is a new gap: the `taskGates[taskGates.length - 1]` strategy has no test asserting it picks the last entry over the first, leaving a regression vector uncovered.

Overall: 49 tests cover all 6 report sections, 5 error paths, and 2 output modes. Test infrastructure is sound. The three new tests land cleanly with no regressions.

**Overall verdict: PASS**
