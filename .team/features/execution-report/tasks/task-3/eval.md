## Parallel Review Findings

[architect] **Note on compound gate recurrence:** "fabricated-refs" tripped in tasks 1, 2, and 3. The most recent concrete instance: the product reviewer in task-3/eval.md filed two 🔴 blockers claiming `statusLabel` emits `"${status} (in progress)"` — the actual code at `report.mjs:31` has `"Run in progress"` and the test asserts `includes("Run in progress")` exactly. Both 🔴 claims were fabricated.
[engineer] **Summary:** No 🔴 blockers. Five 🟡 backlog items carry forward from prior reviews (all independently confirmed by direct source tracing). Two new 🔵 suggestions. Core feature (`--output md` writes `REPORT.md` to `.team/features/<feature>/REPORT.md`) is correctly implemented and tested. All 13 `buildReport` + 8 `cmdReport` tests pass. Does not block merge.
[product] **Note:** The two 🔴 findings from the task-3 product reviewer (claiming `"Run in progress"` label and test assertion were wrong) are fabricated references — the current code at line 31 and the test at line 145 are already correct. The compound gate correctly flagged `fabricated-refs`. Those issues are closed.
[security] No 🔴 critical findings. Five 🟡 warnings are all pre-existing backlog items confirmed by prior automated reviewers. The primary feature (`--output md` writing `REPORT.md` to `.team/features/<feature>/REPORT.md`) is correctly implemented and tested.
🟡 [architect] `bin/lib/report.mjs:117` — Arg-ordering bug: `args.find(a => !a.startsWith("-"))` returns `"md"` for `["--output", "md", "my-feature"]`; skip the token immediately following `--output` when resolving the positional feature name
🟡 [architect] `bin/lib/report.mjs:136` — `featureName` from CLI args flows to `path.join` with no prefix-clamp; assert `resolve(featureDir).startsWith(resolve(_cwd(), ".team", "features") + sep)` before any I/O (coupled with arg-ordering fix)
🟡 [architect] `bin/lib/report.mjs:155` — `_writeFileSync` in `--output md` branch unguarded; ENOSPC/EACCES propagates as unhandled exception; wrap in try/catch and call `_exit(1)` with a readable message
🟡 [architect] `bin/lib/report.mjs:19` — `if (state.createdAt)` truthy guard admits malformed ISO strings; `new Date("bad-date").getTime()` → `NaN` → `"Duration: NaNh"` in header; add `if (isNaN(startMs)) { duration = "N/A"; }` after `getTime()`
🟡 [architect] `bin/lib/report.mjs:59` — `v.costUsd?.toFixed(4)` does not guard `v` itself; `byPhase: { build: null }` throws `TypeError`; change to `v?.costUsd?.toFixed(4)`
🟡 [architect] `bin/lib/report.mjs:90-93` — SPEC requires Section 5 to "list failed tasks with reason" when failure rate > 0; implementation emits a count only; Section 4 already lists them — product owner must clarify whether Section 4 satisfies this or Section 5 must repeat it
[architect] **Architecture assessment:** Clean. `buildReport` is a pure function with no I/O. `cmdReport` has full dependency injection across all six I/O surfaces. No new dependencies, no cross-cutting concerns, no shared modules affected. Primary feature path (`--output md` → `.team/features/<feature>/REPORT.md`) is correctly implemented and directly tested. All six 🟡 findings are pre-existing backlog items from task-2 — none block merge.
🟡 [engineer] `bin/lib/report.mjs:117` — Arg-ordering bug: `args.find(a => !a.startsWith("-"))` returns `"md"` for `["--output", "md", "my-feature"]`; skip the token following `--output` when resolving the positional feature name
🟡 [engineer] `bin/lib/report.mjs:19` — Truthy guard allows malformed `createdAt`; `new Date("bad-date").getTime()` → `NaN` → `"NaNh"` in header; add `if (isNaN(startMs)) { duration = "N/A"; }` after the assignment
🟡 [engineer] `bin/lib/report.mjs:59` — `v.costUsd?.toFixed(4)` does not guard `v` itself; change to `v?.costUsd?.toFixed(4)` to avoid TypeError when a `byPhase` entry is null
🟡 [engineer] `bin/lib/report.mjs:155` — `_writeFileSync` in `--output md` path is unguarded; wrap in try/catch and call `_exit(1)` with a readable message on failure
🟡 [engineer] `bin/lib/report.mjs:136` — `featureName` from CLI args flows to `path.join` with no prefix-clamp; assert resolved path stays within `.team/features/` before any I/O
🟡 [product] `bin/lib/report.mjs:82` — SPEC requires "consider breaking into smaller tasks"; implementation emits "Consider simplifying task X (N attempts)"; update wording to match spec
🟡 [product] `bin/lib/report.mjs:90-93` — SPEC requires "list failed tasks with reason" when failure rate > 0; implementation emits only a count; failed tasks are in Section 4 but not repeated in Recommendations as required
🟡 [product] `bin/lib/report.mjs:117` — Arg-ordering bug: `agt report --output md <feature>` resolves featureName to `"md"`; fix: skip token following `--output` when resolving positional arg
🟡 [product] `bin/lib/report.mjs:136` — featureName from CLI piped to `path.join` with no prefix-clamp; `../../../../tmp/x` resolves outside `.team/features/`; assert resolved path stays within bounds
🟡 [product] `bin/lib/report.mjs:155` — `_writeFileSync` unguarded; ENOSPC/EACCES propagates as stack trace; wrap in try/catch and call exit(1)
🟡 [product] `test/report.test.mjs:245` — All `--output md` tests use feature-first arg order; no test for `["--output", "md", "feature"]` ordering; arg-ordering bug is untested
🟡 [tester] `test/report.test.mjs` — No test exercises `tokenUsage` present path; `makeState()` always omits tokenUsage so `$${totalCostUsd.toFixed(4)}` at `report.mjs:55` is unreachable in every test; add a test asserting `$0.0123` appears when `tokenUsage` is set
🟡 [tester] `test/report.test.mjs` — No test for `status: "failed"` tasks in Section 4; every Section 4 test uses `status: "blocked"`; add a task with `status: "failed"` and assert the `FAILED` label renders
🟡 [tester] `bin/lib/report.mjs:27` — `${hours}h ${rem}m` branch (rem > 0) has no test; `makeState()` uses a 60-min gap yielding rem=0 every time; add a test with a 90-min gap and assert `"1h 30m"` appears
🟡 [tester] `test/report.test.mjs` — No test for `failGates > 0 && passGates === 0` recommendation at `report.mjs:95–97`; add a state with only FAIL gates and assert "review quality gate command" appears
🟡 [tester] `bin/lib/report.mjs:117` — Arg-ordering bug: `args.find(a => !a.startsWith("-"))` returns `"md"` for `["--output", "md", "my-feature"]`; all 8 `cmdReport` tests place the feature name first — the `agt report --output md <feature>` order is never tested and silently exits 1 with "not found"
🟡 [security] `bin/lib/report.mjs:136` — Path traversal: `featureName` flows into `path.join` with no prefix-clamp; `"../../../../tmp/x"` resolves outside `.team/features/`; add `resolve(featureDir).startsWith(base)` guard before any I/O
🟡 [security] `bin/lib/report.mjs:117` — Arg-ordering bug couples with traversal: `["--output", "md", "my-feature"]` → `featureName = "md"`; skip token following `--output` when resolving positional; apply both fixes as a unit
🟡 [security] `bin/lib/report.mjs:155` — `_writeFileSync` unguarded; EACCES/ENOSPC leaks absolute path in stack trace; wrap in try/catch + `_exit(1)`
🟡 [security] `bin/lib/report.mjs:59` — `v.costUsd?.toFixed(4)` doesn't guard `v`; null byPhase entry throws TypeError; fix to `v?.costUsd?.toFixed(4)`
🟡 [security] `bin/lib/report.mjs:19` — Malformed `createdAt` passes truthy guard; NaN propagates to `"Duration: NaNh"`; add `isNaN` guard
🟡 [simplicity] `bin/lib/report.mjs:117` — `args.find(a => !a.startsWith("-"))` resolves `featureName` to `"md"` for arg order `["--output", "md", "<feature>"]`; already tracked by prior reviews; no test covers this ordering
🔵 [architect] `bin/lib/report.mjs:153` — Unknown `--output` value silently falls through to stdout; add a warning branch for unrecognized format values
🔵 [engineer] `bin/lib/report.mjs:155` — `report + "\n"` produces a double trailing newline (`buildReport` already ends with a blank line via `lines.push("")`); remove the suffix
🔵 [engineer] `bin/lib/report.mjs:145` — `"STATE.json not found"` error message fires for both missing file and JSON parse failure; split the two cases for better diagnostics
🔵 [product] `bin/lib/report.mjs:59` — `v.costUsd?.toFixed(4)` doesn't guard `v`; null byPhase entry throws TypeError; change to `v?.costUsd?.toFixed(4)`
🔵 [product] `bin/lib/report.mjs:19` — Truthy guard on `createdAt` passes malformed ISO strings; NaN propagates to "NaNh" in header; add `if (isNaN(startMs)) { duration = "N/A"; }`
🔵 [tester] `test/report.test.mjs` — No test for `buildReport({ tasks: [], gates: [] })`; empty state path untested
🔵 [tester] `test/report.test.mjs` — No test for multiple gates per same task (FAIL then PASS); `lastVerdict` logic at `report.mjs:44` untested with multi-gate task
🔵 [tester] `test/report.test.mjs` — No test for `["my-feature", "--output"]` (flag with no value); `outputMd` silently stays false with no warning
🔵 [security] `bin/lib/report.mjs:72` — `task.title`/`lastReason` verbatim in Markdown; strip `\r\n` to prevent heading injection in `--output md` mode
🔵 [security] `bin/lib/report.mjs:153` — Unknown `--output` value silently falls through to stdout; add warning branch

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs
🔴 iteration-escalation — Persistent eval warning: fabricated-refs recurred in iterations 1, 2

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs