# Engineer Review — execution-report / Title Column

**Reviewer role:** Engineer
**Verdict: PASS**
**Date:** 2026-04-26
**Reviewed commit:** 0f6ed9f (HEAD of feature/execution-report)

---

## Files Actually Read

- `bin/lib/report.mjs` (194 lines, full) — production implementation
- `test/report.test.mjs` (499 lines, full) — test suite
- `bin/agt.mjs` (grep for "report") — CLI wiring: import at line 19, dispatch at line 75, help at lines 188-194, summary at lines 248+868
- `git diff main...HEAD -- bin/lib/report.mjs` (full diff, +69/-31)
- `git diff main...HEAD --stat` (19 files changed)
- `.team/features/execution-report/tasks/task-{1,2,3,7}/handshake.json` — all 4 builder handshakes
- `.team/features/execution-report/tasks/task-{8,9,10,11}/eval.md` (first 30 lines each) — prior review evals

---

## Tests Independently Run

```
$ node --test test/report.test.mjs
tests 40  |  suites 2  |  pass 40  |  fail 0  |  skipped 0  |  duration_ms 147
```

---

## Per-Criterion Results

### 1. Title column in Task Summary table — Correctness
**PASS** — Direct evidence:

- Header at report.mjs:58 includes `| Task | Title | Status | Attempts | Gate Verdict |` — 5-column layout.
- Row template at report.mjs:63: `| ${task.id} | ${escapeCell(task.title || "—")} | ${task.status} | ${task.attempts ?? 0} | ${lastVerdict} |`
- Fallback to `—` verified by test at report.test.mjs:63-72 (asserts `| task-1 | — |` when title is absent).
- Title display verified by test at report.test.mjs:53-61 (asserts `Do something` appears in output).
- Pipe escaping verified by test at report.test.mjs:247-265: title `"Fix | pipe | issue"` produces escaped `\|` and exactly 6 unescaped column delimiters.

### 2. escapeCell function — Correctness
**PASS** — report.mjs:8-10 replaces all `|` with `\|` using global regex. This is the critical character for markdown table cells. Confirmed with manual edge case test.

### 3. What Shipped section — title fallback
**PASS** — report.mjs:51 uses `task.title || task.id` so tasks without a title still appear using their ID. Test at report.test.mjs:277-286 verifies `- task-1` appears when title is absent.

### 4. Blocked/Failed section — dead code removal
**PASS** — report.mjs:90 uses `task.status.toUpperCase()` without the previous `|| "unknown"` fallback. This is safe because the filter at line 86 (`t.status === "blocked" || t.status === "failed"`) guarantees `task.status` is always a string at this point. Tests at report.test.mjs:163-181 verify no crash for blocked/failed tasks without `lastReason`.

### 5. Duration calculation — NaN guard
**PASS** — report.mjs:26 adds `Number.isFinite(mins)` check before formatting. Test at report.test.mjs:267-275 feeds `"not-a-date"` for `createdAt` and confirms output contains `Duration: N/A` and no `NaN`.

### 6. Path traversal guard
**PASS** — report.mjs:163 uses `basename()` comparison plus explicit `.`/`..` checks. Three tests at report.test.mjs:478-497 verify `../../etc`, `.`, and `..` all exit with code 1 and `"invalid feature name"`.

### 7. --output format validation
**PASS** — report.mjs:157-161 rejects non-`md` values with an explicit error message. Tests at report.test.mjs:460-474 cover `--output txt` and bare `--output` (no value).

### 8. Argument parsing — flag/feature order flexibility
**PASS** — report.mjs:139 uses `args.find()` with index-aware skip of `--output`'s value. Test at report.test.mjs:448-456 verifies `["--output", "md", "test-feature"]` (reversed order) correctly writes REPORT.md.

### 9. Error output routing
**PASS** — All error messages go to `_stderr` (lines 152, 158, 164, 172, 179), not `_stdout`. This follows Unix convention. Prior code sent errors to stdout — the diff confirms the fix.

### 10. Gate verdict extraction — performance
**PASS** — report.mjs:61-62 filters gates per task (O(n*m)). For report generation over a completed feature, n and m are small (typically <20 each). No performance concern.

---

## Edge Cases Checked

| Edge case | Checked? | Result |
|-----------|----------|--------|
| Title absent (undefined) | Yes | Falls back to `—` in table, `task.id` in What Shipped |
| Title empty string `""` | Yes | Falsy, falls back to `—` — correct |
| Title with pipe chars | Yes | Escaped by `escapeCell` — table structure preserved |
| Title with newline | Yes | **Not handled** — see finding below |
| Invalid createdAt (NaN) | Yes | `Number.isFinite` guard produces `N/A` |
| Negative duration | Yes | **Shows negative minutes** — see finding below |
| Missing gates array | Yes | Defaults to `[]` at line 17 |
| Missing tasks array | Yes | Defaults to `[]` at line 16 |
| Path traversal (`../`) | Yes | Rejected with error |
| Feature name `.` or `..` | Yes | Rejected with error |
| Unsupported `--output` value | Yes | Rejected with error |
| `--output` without value | Yes | Rejected with error |

---

## Findings

🟡 bin/lib/report.mjs:9 — `escapeCell` only escapes pipes; a newline in `task.title` (e.g. `"Fix\nBug"`) breaks the table row into two lines, corrupting markdown output. Add `.replace(/[\r\n]+/g, " ")` before the pipe escape.

🔵 bin/lib/report.mjs:28 — Negative duration (when `completedAt` < `createdAt`) renders as e.g. `-1440m`. Guard with `mins < 0 ? "N/A" : ...` for robustness against malformed state data.

---

## Summary

The Title column implementation is correct and well-tested. The `buildReport` function is pure with no side effects, `cmdReport` uses clean dependency injection for testability, and all 40 tests pass. The code handles the primary spec (Title column with `—` fallback) and defensive concerns (pipe escaping, path traversal, NaN duration) correctly.

Two edge cases remain: newlines in titles could break the markdown table (warning — should go to backlog), and negative durations display confusingly (suggestion — optional cleanup). Neither blocks merge.

---

# Architect Review — execution-report / Title Column (final round)

**Reviewer role:** Architect
**Verdict: PASS**
**Date:** 2026-04-26
**Reviewed commits:** `main...HEAD` (25 commits), focusing on cumulative state of `bin/lib/report.mjs` and `test/report.test.mjs`

---

## Files Actually Read

- `bin/lib/report.mjs` (194 lines) — full implementation
- `test/report.test.mjs` (498 lines) — full test suite
- `bin/agt.mjs` (grep: lines 19, 75, 188-195, 248, 868) — CLI integration points
- `bin/lib/util.mjs:190-198` — `readState` function (dependency)
- `.team/features/execution-report/tasks/task-7/handshake.json` — gate claim
- `.team/features/execution-report/tasks/task-3/handshake.json` — builder claim
- `.team/features/execution-report/SPEC.md` — feature specification
- `.team/features/execution-report/tasks/task-7/eval.md` (233 lines) — prior architect+tester reviews
- `.team/features/execution-report/tasks/task-8/eval.md` (header) — tester review
- `.team/features/execution-report/tasks/task-9/eval.md` (header) — simplicity review
- `.team/features/execution-report/tasks/task-10/eval.md` (header) — tester review (Title Column)
- `.team/features/execution-report/tasks/task-11/eval.md` (header) — PM review
- `.team/features/execution-report/tasks/task-12/eval.md` (103 lines) — engineer review (this file)
- `git diff main...HEAD -- bin/lib/report.mjs` — full diff (69 lines changed)
- `git diff main...HEAD -- test/report.test.mjs` — full diff (224 lines added)
- `git log main..HEAD --oneline` — 25 commits on branch

---

## Builder Claim vs Evidence

**Task-7 handshake (gate):** "Gate command: npm test — exit code 0" with 549 tests passing (547 pass, 2 skip), verdict PASS.

**Task-3 handshake (builder):** Added two missing tests for Recommendations section branches (partial-problem and FAIL-only-gates). All 560 tests pass.

**Verified:**

| Claim | Evidence | Confirmed? |
|-------|----------|------------|
| Title column in Task Summary header | `report.mjs:58` — `\| Task \| Title \| Status \| Attempts \| Gate Verdict \|` | Yes |
| Title cell renders `task.title \|\| "—"` | `report.mjs:63` — `escapeCell(task.title \|\| "—")` | Yes |
| What Shipped section lists passed tasks | `report.mjs:47-54` — filters by `passed`, renders `task.title \|\| task.id` | Yes |
| Pipe escaping in markdown table | `report.mjs:8-10` — `escapeCell` replaces `\|` with `\\\|` | Yes |
| Path traversal guard | `report.mjs:163` — rejects non-basename, `.`, `..` | Yes |
| NaN duration protection | `report.mjs:26` — `Number.isFinite(mins)` guard | Yes |
| Error messages on stderr | `report.mjs:152,158,164,172,179` — all use `_stderr.write` | Yes |
| Tests pass (gate) | Gate output shows exit code 0, 549 tests (547 pass, 2 skip) | Yes |

---

## Architectural Assessment

### 1. Module Boundaries — PASS

`report.mjs` has a clean boundary with exactly two exports:

- `buildReport(state)` — pure function: state object in, markdown string out. Zero side effects, zero I/O. This is the ideal shape for a report generator.
- `cmdReport(args, deps)` — CLI adapter: parses args, validates input, delegates to `buildReport`, handles output. The `deps` parameter enables full dependency injection for testing.

The module imports only three things: `fs.existsSync`/`writeFileSync` (for `--output md`), `path.basename`/`join` (for path validation), and `readState` from `util.mjs`. No circular dependencies. No coupling to the harness's state-mutation machinery. The report module is strictly read-only.

Integration surface is minimal: a single `import` in `agt.mjs:19` and a single `case` at `agt.mjs:75`. Adding or removing the report command touches exactly two lines.

### 2. Data Contract — PASS

`buildReport` reads the following fields from `state`:

| Field | Used at | Fallback |
|-------|---------|----------|
| `state.feature` | L14 | `"unknown"` |
| `state.status` | L15 | `"unknown"` |
| `state.tasks[]` | L16 | `[]` |
| `state.gates[]` | L17 | `[]` |
| `state.createdAt` | L21 | skipped |
| `state.completedAt` | L23,43 | `_last_modified` or `Date.now()` |
| `state.tokenUsage` | L71-78 | `"N/A"` |
| `state.transitionCount` | L80 | `0` |
| `task.id`, `task.title`, `task.status`, `task.attempts` | L51,63 | safe defaults |
| `task.lastReason` | L91 | conditional guard |
| `task.gateWarningHistory` | L102-106 | conditional guard |

All fields are part of the established STATE.json schema used by other modules (`transition.mjs`, `run.mjs`, `state-sync.mjs`). No new data shapes introduced. Every field has a safe fallback — the function never throws on missing data. This is correct for a reporting function that must handle partially-written state from crashed runs.

### 3. Pattern Consistency — PASS

The report follows a consistent section pattern used 6 times:

```
// Section N: Label
[optional filter]
[optional guard: if (subset.length > 0)]
lines.push("## Heading");
for (const item of items) { lines.push(...); }
lines.push("");
```

Six instances of a 5-line inline pattern is below the threshold for extraction. The function is 111 lines (`buildReport` alone), readable in a single screen. A section-registry abstraction would be premature at this scale.

### 4. Dependency Injection — PASS

`cmdReport` injects 7 dependencies via the `deps` object:

```
readState, existsSync, writeFileSync, stdout, stderr, exit, cwd
```

This enables complete isolation in tests. The `makeDeps` helper in tests (line 336) constructs a synthetic environment with captured output, controlled filesystem, and a non-terminating `exit`. This is a well-established pattern and avoids the fragility of monkeypatching globals.

### 5. Error Handling — PASS

Five distinct error paths in `cmdReport`, each writing to stderr and calling `_exit(1)`:

1. Missing feature name (L151-155)
2. Invalid `--output` format (L157-161)
3. Path traversal (L163-167)
4. Missing feature directory (L171-175)
5. Missing/unreadable STATE.json (L178-182)

All five have corresponding test coverage. Errors go to stderr, reports go to stdout — proper Unix convention that enables `agt report x > report.md` piping.

### 6. Scalability at 10x — PASS (adequate)

**Current scale:** ~5-10 tasks per feature, ~10-20 gates.

**At 10x (50-100 tasks):** The `O(tasks * gates)` lookup at line 61 (`gates.filter(g => g.taskId === task.id)`) would scan up to 100 x 200 = 20K comparisons. For a CLI report generator that runs once after execution completes, this is negligible.

**At 100x:** If features ever have 1000 tasks, the linear scans and string concatenation would still complete in milliseconds. A report generator is not on the hot path.

---

## Edge Cases Verified

| Edge case | How verified | Result |
|-----------|-------------|--------|
| Missing `task.title` -> `"—"` in table | Read `report.mjs:63`, test at `report.test.mjs:63-72` | PASS |
| Missing `task.title` -> `task.id` in What Shipped | Read `report.mjs:51`, test at `report.test.mjs:277-286` | PASS |
| Pipe chars in title -> escaped | Read `report.mjs:63` + `escapeCell`, test at `report.test.mjs:247-265` | PASS |
| Invalid date -> N/A duration | Read `report.mjs:26`, test at `report.test.mjs:267-275` | PASS |
| Path traversal `../../etc` rejected | Read `report.mjs:163`, tests at `report.test.mjs:478-497` | PASS |
| `--output md` before feature name | Read `report.mjs:139`, test at `report.test.mjs:448-456` | PASS |
| No gates -> `"—"` verdict | Read `report.mjs:62`, test at `report.test.mjs:92-98` | PASS |
| All tasks blocked -> stalled rec | Read `report.mjs:108`, test at `report.test.mjs:216-226` | PASS |
| FAIL-only gates -> quality gate rec | Read `report.mjs:113-115`, test at `report.test.mjs:301-314` | PASS |

---

## Findings

🟡 bin/lib/report.mjs:63 — `escapeCell` is applied only to `task.title`. Other user-facing strings interpolated into the table (`task.id`, `task.status`, `lastVerdict`) are not escaped. Today these are harness-controlled values, but if any future data source populates task IDs or verdicts from external input, the table would break. Consider applying `escapeCell` uniformly to all cell values, or document the invariant that non-title cells are always pipe-free.

🔵 bin/lib/report.mjs:90 — The Blocked/Failed section uses `"(no title)"` as fallback when `task.title` is absent, while the Task Summary table at line 63 uses `"—"`. The inconsistency is minor but could confuse users comparing sections. Consider unifying to one fallback convention.

🔵 bin/lib/report.mjs:8-10 — `escapeCell` does not handle newlines in `task.title`. A title containing `\n` would break the markdown table row. Not a current risk (harness-generated titles are single-line), but worth a `replace(/\n/g, " ")` if titles ever come from user input.

---

## Overall Verdict: PASS

The report module is architecturally sound. It has clean boundaries (pure function + CLI adapter), minimal coupling (3 imports, 2 exports, 2-line CLI integration), proper dependency injection for testability, and consistent internal patterns. The data contract aligns with the established STATE.json schema without introducing new shapes. Error handling follows Unix conventions. Test coverage is comprehensive with 40 tests across unit and integration levels.

One yellow-level finding (selective `escapeCell` application) should go to backlog — it's not blocking today since non-title fields are harness-controlled, but it represents an incomplete hardening pattern. Two blue suggestions (fallback inconsistency, newline handling) are optional improvements.

The implementation is right-sized for a v1 — no over-engineering, no premature abstractions, no unnecessary dependencies.
