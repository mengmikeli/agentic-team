## Parallel Review Findings

[engineer] No critical (🔴) issues. The 🟡 arg-ordering bug is a pre-existing backlog item shared across all prior review roles, does not affect documented usage, and does not block merge.
[product] Two 🔴 critical findings block merge:
🔴 [product] `bin/lib/report.mjs:31` — SPEC "Done When" #4 quotes the label `"Run in progress"` as a required string. Implementation emits `${status} (in progress)` (e.g. `"executing (in progress)"`). Fix: `const statusLabel = isComplete ? "completed" : "Run in progress"`.
🔴 [product] `test/report.test.mjs:145` — The test uses `includes("in progress") || includes("executing")`, which accepts the non-compliant label and will pass both the wrong and right implementation. Narrow to `assert.ok(report.includes("Run in progress"), ...)`.
[product] Backlog items (do not block merge once 🔴 are fixed):
[tester] The primary acceptance criterion — `--output md` writes `REPORT.md` to `.team/features/<feature>/REPORT.md` — is verified by direct test evidence (test-output.txt:1347). No 🔴 blockers. Six 🟡 coverage gaps go to backlog (all were previously surfaced by the task-2 tester); three 🔵 suggestions. Does not block merge.
[security] **Verdict: PASS** — no 🔴 critical blockers.
[simplicity] No 🔴 findings. One 🟡 warning.
[architect] All five bugs confirmed via **live execution** against the current source. All are pre-existing 🟡 backlog items from the task-2 review — none are newly introduced:
🟡 [architect] `bin/lib/report.mjs:136` — `featureName` from raw CLI args piped to `path.join` with no prefix-clamp; `"../../../tmp/evil"` resolves to `/tmp/evil`; assert resolved path stays within `.team/features/` before any I/O
🟡 [architect] `bin/lib/report.mjs:117` — arg-ordering bug confirmed live: `["--output","md","my-feature"]` resolves `featureName` to `"md"`, writes to `.team/features/md/REPORT.md`; skip the value token following `--output` when resolving the positional
🟡 [architect] `bin/lib/report.mjs:19` — truthy-only guard allows malformed ISO strings; `new Date("not-a-date").getTime()` propagates to `"Duration: NaNh"` confirmed live; add `if (isNaN(startMs)) { duration = "N/A"; }`
🟡 [architect] `bin/lib/report.mjs:59` — `v.costUsd?.toFixed(4)` does not guard `v` itself; `byPhase: { build: null }` throws `TypeError` confirmed live; change to `v?.costUsd?.toFixed(4)`
🟡 [architect] `bin/lib/report.mjs:155` — `_writeFileSync` unguarded; EACCES/ENOSPC propagates as unhandled exception with stack trace; wrap in try/catch and call `_exit(1)` with readable message
[architect] Architecture is clean — `buildReport` is a pure function, `cmdReport` has full dependency injection, boundaries are correct. The primary feature (`--output md` writing to `.team/features/<feature>/REPORT.md`) is implemented and tested correctly. Gate passes (685/685). The five 🟡 findings are all pre-existing backlog items that do not affect the primary usage path. Eval written to `.team/features/execution-report/tasks/task-4/eval.md`.
🟡 [engineer] `bin/lib/report.mjs:117` — `args.find(a => !a.startsWith("-"))` is order-sensitive; `agt report --output md my-feature` resolves featureName to `"md"` instead of `"my-feature"`. Skip the token immediately following `--output` when searching for the positional argument. (Pre-existing backlog item, also flagged by prior security and architect reviews.)
🟡 [product] `bin/lib/report.mjs:82` — Recommendations wording for high-attempt tasks reads "Consider simplifying task X (N attempts)"; SPEC requires "consider breaking into smaller tasks"
🟡 [product] `bin/lib/report.mjs:90-93` — SPEC requires Recommendations to "list failed tasks with reason" when failure rate > 0; implementation emits a count only
🟡 [product] `bin/lib/report.mjs:117` — Arg-ordering bug: `agt report --output md my-feature` resolves `featureName` to `"md"`
🟡 [tester] `test/report.test.mjs:70` — Only asserts `N/A` for USD cost; no test with `tokenUsage.total.costUsd` set; add a positive-case assertion to prevent silent regression on the `report.mjs:53–60` cost read path
🟡 [tester] `test/report.test.mjs:79` — Only tests `blocked` task status; no test with `status: "failed"`; add a task with `status: "failed"` and assert the `FAILED` label renders (covers `report.mjs:68`)
🟡 [tester] `test/report.test.mjs` — No test for `failGates > 0 && passGates === 0` recommendation at `report.mjs:95`; add a state with only FAIL gates and assert "review quality gate command" appears
🟡 [tester] `bin/lib/report.mjs:117` — Arg-ordering bug confirmed in code: `args.find(a => !a.startsWith("-"))` returns `"md"` for `["--output", "md", "my-feature"]`; only the feature-name-first ordering is exercised in tests (`test/report.test.mjs:245`); add a test for flag-first ordering to guard against regression
🟡 [tester] `bin/lib/report.mjs:19` — Malformed `createdAt` (e.g. `"not-a-date"`) makes `startMs` = `NaN`, which propagates to `"NaNm"` in the header; no guard and no test; add `if (isNaN(startMs)) { duration = "N/A"; }` and a matching test
🟡 [tester] `bin/lib/report.mjs:59` — `v.costUsd?.toFixed(4)` is optional on `costUsd` but not on `v`; a `null` byPhase entry throws `TypeError`; no test exercises this; fix to `v?.costUsd?.toFixed(4)`
🟡 [security] `bin/lib/report.mjs:136` — `featureName` from raw CLI args piped to `path.join` with no prefix-clamp; `path.join("/proj", ".team", "features", "../../../../tmp/x")` resolves to `/tmp/x`; assert `resolve(featureDir).startsWith(resolve(_cwd(), ".team", "features") + sep)` before any I/O and call `_exit(1)` if not
🟡 [security] `bin/lib/report.mjs:117` — arg-ordering bug: `["--output", "md", "my-feature"]` resolves `featureName` to `"md"`; path-traversal and arg-ordering fixes are coupled — skip the token immediately following `--output` when resolving the positional; apply both fixes together
🟡 [security] `bin/lib/report.mjs:155` — `_writeFileSync` unguarded in `--output md` path; EACCES/ENOSPC propagates as unhandled exception leaking the absolute write path in the stack trace; wrap in try/catch and call `_exit(1)` with a readable message
🟡 [security] `bin/lib/report.mjs:59` — `v.costUsd?.toFixed(4)` optional chain is on `.toFixed`, not on `v`; a null/undefined `byPhase` entry throws `TypeError: Cannot read properties of null`; change to `v?.costUsd?.toFixed(4)`
🟡 [security] `bin/lib/report.mjs:19` — truthy guard on `state.createdAt` passes malformed ISO strings; `new Date("bad-date").getTime()` → `NaN` → `"NaNh"` in the header; add `if (isNaN(startMs)) { duration = "N/A"; }` after the assignment
🟡 [simplicity] `bin/lib/report.mjs:117-119` — Argument order is fragile: `agt report --output md <feature>` misparsed — `featureName` resolves to `"md"` because `args.find(a => !a.startsWith("-"))` picks up the `--output` value token. The fix should skip the value following `--output` when searching for the positional feature name. The security reviewer independently flagged this as coupled to the path-traversal clamp — both fixes should land together.
🔵 [architect] `bin/lib/report.mjs:153` — unknown `--output` value silently falls through to stdout; add a warning branch for unrecognized format values
🔵 [engineer] `bin/lib/report.mjs:147` — Error message "STATE.json not found in …" fires for both missing file and JSON parse failure. Split the two cases.
🔵 [engineer] `bin/lib/report.mjs:155,158` — `buildReport` already produces a trailing `\n` (final `lines.push("")` + `join("\n")`); appending `+ "\n"` at write time creates a double blank line at the end of all output. Remove the `+ "\n"` suffix.
🔵 [engineer] `bin/lib/report.mjs:119` — Unrecognized `--output` values (e.g. `--output html`) silently fall back to stdout with no warning.
🔵 [tester] `test/report.test.mjs` — No test for `buildReport` with empty `tasks: []` and `gates: []`; verify the empty-state path renders without throwing
🔵 [tester] `bin/lib/report.mjs:28` — `${hours}h ${rem}m` branch (rem > 0) is never exercised; default test state uses an exact 60-min span (rem = 0); add a test with a 90-min span and assert `"1h 30m"` appears
🔵 [tester] `test/report.test.mjs` — No test for `["my-feature", "--output"]` (flag with no value); `outputMd` silently stays `false`; document or test the fallback behavior
🔵 [security] `bin/lib/report.mjs:72` — `task.title` and `task.lastReason` rendered verbatim in the Markdown output; strip embedded `\r\n` before interpolation to prevent Markdown heading injection in `--output md` mode (low risk — harness-written source, but AI-generated text can include arbitrary content)
🔵 [security] `bin/lib/report.mjs:153` — unknown `--output` value silently falls through to stdout; add a warning branch for unrecognized format values

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs