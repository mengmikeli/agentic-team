## Parallel Review Findings

🔴 [architect] `test/report.test.mjs:133` — Dead variable `state` (lines 134–139) declared inside the `it()` block but never passed to any assertion; only `state3` at line 150 is asserted against — delete lines 134–139
🔴 [architect] `test/report.test.mjs:142` — Dead variable `state2` (lines 142–146) same test block, also never used in an assertion — delete lines 142–146 and the comment block at 140–149
[engineer] No 🔴 critical findings from the engineer lens. All five sections render, gate exits 0, 21/21 report tests pass.
🟡 [engineer] `test/report.test.mjs:133` — Dead variable `state` (lines 133–139) declared but never asserted; prior review flagged this 🔴 and it remains; delete to clarify test intent
🔴 [product] `bin/lib/report.mjs:51` — Cost Breakdown section always emits N/A for total cost (USD) and per-phase split despite STATE.json containing `tokenUsage.total.costUsd` and `tokenUsage.byPhase`; SPEC requires actual values — read and display when present, fall back to N/A when absent
🔴 [product] `test/report.test.mjs:133` — Dead variable `state` declared but never asserted against; still present after task-1 flagged it as 🔴; delete lines 133–138 and the comment at line 140
🔴 [product] `test/report.test.mjs:142` — Dead variable `state2` declared but never asserted against; still present after task-1 flagged it as 🔴; delete lines 142–149
🔴 [tester] `test/report.test.mjs:133` — Dead variable `state` (lines 133–138) declared but never used in any assertion; unresolved from task-1 — delete lines 133–141 and add an explicit test for null `task.status` in Task Summary row rendering (report.mjs:43 interpolates `task.status` directly; "null" string is currently untested)
🔴 [tester] `test/report.test.mjs:142` — Dead variable `state2` (lines 142–149) declared but never used in any assertion; unresolved from task-1 — delete lines 142–149 including the Patch comment block
[tester] **Why FAIL:** The two 🔴 dead-variable findings were explicitly flagged in the task-1 parallel review and are confirmed still present in `test/report.test.mjs:133–149`. Any red finding blocks merge.
[security] **Security verdict: PASS** — no critical (🔴) security findings. The path traversal is a real 🟡 that must go to the backlog; it does not block merge for a local CLI with no privilege escalation. The dead-code 🔴 findings (`test/report.test.mjs:133,142`) from the parallel architect/simplicity review are confirmed present and still block merge, but those are code-quality findings outside the security lens.
[simplicity] Three 🔴 findings block merge:
🔴 [simplicity] test/report.test.mjs:133 — Dead code: `state` declared but never used in any assertion; delete lines 133–138
🔴 [simplicity] test/report.test.mjs:142 — Dead code: `state2` declared but never used in any assertion; delete lines 142–149 including comment block
🔴 [simplicity] bin/lib/report.mjs:8 — Premature abstraction: `formatDuration` is private with a single call site (line 28); inline the 9-line body into `buildReport`
🟡 [architect] `bin/lib/report.mjs:126` — `featureName` from raw CLI args piped directly to `path.join` with no prefix-clamp; `path.join(_cwd(), ".team", "features", "../../../../tmp/x")` resolves outside the `.team` tree — assert resolved path starts with `resolve(_cwd(), ".team", "features") + sep` before any I/O
🟡 [architect] `bin/lib/report.mjs:51` — `state.tokenUsage?.total?.costUsd` and `state.tokenUsage?.byPhase` are written into STATE.json by `run.mjs:1460` but are never read here; Cost Breakdown section unconditionally prints "N/A" — read the field when present, fall back to "N/A" only when absent
🟡 [architect] `bin/lib/report.mjs:145` — `_writeFileSync` called with no try/catch in the `--output md` branch; a permissions error or ENOSPC propagates as an unhandled exception rather than a clean `exit(1)` + readable message
🟡 [engineer] `test/report.test.mjs:142` — Dead variable `state2` (lines 142–149) declared but never asserted; only `state3` at line 150 is tested; delete it and the Patch comment block
🟡 [engineer] `bin/lib/report.mjs:80` — SPEC.md:20 requires Recommendations to "list failed tasks with reason" when failure rate > 0; implementation emits only a count string; failed task IDs and reasons must appear in Section 5
🟡 [engineer] `bin/lib/report.mjs:10` — `new Date(startIso).getTime()` returns `NaN` for malformed ISO strings; the `!startIso` guard on line 9 only catches falsy values; add `if (isNaN(startMs)) return "N/A"` to prevent `"NaNh"` in the header
🟡 [engineer] `bin/lib/report.mjs:126` — `featureName` from CLI argv passed directly to `path.join` with no traversal guard; assert resolved `featureDir` starts with `resolve(_cwd(), ".team", "features") + path.sep` before use
🟡 [engineer] `bin/lib/report.mjs:145` — `_writeFileSync` in `--output md` mode not wrapped in try/catch; permissions error or disk-full propagates as an unhandled exception; wrap and call `_exit(1)` with a readable message
[engineer] All 🟡 findings go to backlog. Eval written to `.team/features/execution-report/tasks/task-2/eval.md`.
🟡 [product] `test/report.test.mjs:76` — Test asserts `N/A` is present rather than testing that cost data is read when available; must be updated alongside the `report.mjs:51` fix to verify actual cost is displayed when `tokenUsage.total.costUsd` is set
🟡 [product] `bin/lib/report.mjs:29` — In-progress label produces `"${status} (in progress)"` (e.g. `"executing (in progress)"`) but Done When criterion 4 specifies the label `"Run in progress"`; test at `:161` accepts either string, masking the deviation
🟡 [tester] `bin/lib/report.mjs:8` — `formatDuration` passes invalid ISO strings through unchecked; `new Date("bad-date").getTime()` returns NaN → propagates to produce `"NaNh"` in the report header; add `if (isNaN(startMs)) return "N/A"` after line 10 and add a unit test for the corrupt-date path
🟡 [tester] `bin/lib/report.mjs:29` — SPEC.md:21 requires the fixed label `"Run in progress"` for in-progress features; implementation emits `${status} (in progress)` (e.g. "executing (in progress)"); `test:161` accepts either string with `||`, masking the deviation — standardise to the spec label and tighten the assertion
🟡 [tester] `bin/lib/report.mjs:82` — SPEC.md:17 requires Section 5 to "list failed tasks with reason" when failure rate > 0; implementation emits only a count message ("N task(s) need attention"); no test asserts a failed task's ID or reason in the Recommendations section
🟡 [tester] `bin/lib/report.mjs:145` — `_writeFileSync` in `--output md` mode has no try/catch; a write failure (permissions, disk full) propagates as an unhandled exception with a stack trace rather than `exit(1)` + a readable message; no test covers this path
🟡 [tester] `bin/lib/report.mjs:126` — `featureName` from CLI argv joined into `path.join` with no boundary check; `../../../../tmp/x` escapes `.team/features/`; no test for traversal input on either the read or `--output md` write surface
🟡 [security] bin/lib/report.mjs:107,126 — `featureName` from CLI args passed to `path.join` with no boundary check; verified: `path.join("…", ".team", "features", "../../../../tmp/x")` → `/Users/tmp/x` (escapes intended dir). Two surfaces: (1) read — `readState` opens any `STATE.json` on disk; (2) write — `writeFileSync` with `--output md` writes to traversal target. Fix: after line 126, assert `resolve(featureDir).startsWith(resolve(_cwd(), ".team", "features") + sep)`; `_exit(1)` if not.
🟡 [simplicity] bin/lib/report.mjs:10 — NaN propagates for invalid date input; add `if (isNaN(startMs)) return "N/A"` after line 10
🟡 [simplicity] bin/lib/report.mjs:126 — `featureName` from argv passed to `path.join` without traversal boundary check; assert resolved path stays within `.team/features/`
🔵 [architect] `bin/lib/report.mjs:109` — `--output <anything-except-md>` is silently ignored; add a warning branch for unrecognized format values
🔵 [engineer] `bin/lib/report.mjs:29` — Done When #4 specifies fixed label `"Run in progress"`; implementation produces `"${status} (in progress)"` (e.g. `"executing (in progress)"`); test:161 accepts both, masking the deviation
🔵 [engineer] `bin/lib/report.mjs:109` — `--output` with unknown value silently outputs to stdout; add a warning for unrecognised format values
🔵 [tester] `test/report.test.mjs` — No test for `buildReport` with `tasks: []`; the Task Summary table header should still render without error
🔵 [tester] `bin/lib/report.mjs:109` — `--output` with any value other than "md" (e.g. `--output json`) silently outputs the report to stdout with no warning; no test for unrecognised format value
🔵 [tester] `test/cli-commands.test.mjs` — `agt help report` is verified in `report.test.mjs:298` but absent from the `agt help <command>` suite (test output lines 119–133) that covers 9 other commands; no functional gap but backlog-worthy for consistency
🔵 [security] bin/lib/report.mjs:62-63 — `task.lastReason` and `task.title` from STATE.json rendered verbatim; embedded newlines inject fake Markdown headings in `--output md` mode; ANSI escape sequences pass to terminal. Low risk since state is harness-authored. Fix: `.replace(/[\r\n]+/g, " ")` before interpolation.

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs