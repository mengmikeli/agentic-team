## Parallel Review Findings

[simplicity] No 🔴 critical findings. Two findings total:
🟡 [architect] bin/lib/cron.mjs:107 — `_setProjectItemStatus(..., "ready")` silently returns false if "Ready Option ID" is absent from PROJECT.md Tracking section (`readTrackingConfig` treats it optional per github.mjs:52–59); failed dispatch leaves board item stuck in "in-progress" with no recovery; add a pre-flight check for `tracking.statusOptions["ready"]` before acquiring the lock
🟡 [architect] bin/lib/cron.mjs:20 — `readProjectNumber` parses PROJECT.md a second time to extract the project URL number; `readTrackingConfig` already reads the same file; add `projectNumber` to `readTrackingConfig`'s return value to eliminate the duplicate parse
🟡 [architect] bin/lib/cron.mjs:57 — `_readTrackingConfig()` called with no arguments, causing `readTrackingConfig` to re-call `process.cwd()` internally (github.mjs:43) rather than using the `cwd` captured at line 43; pass explicit path: `_readTrackingConfig(join(cwd, ".team", "PROJECT.md"))`
🟡 [engineer] `bin/lib/cron.mjs:130` — `cwd` and `agtPath` embedded in crontab string without shell quoting; paths containing spaces produce a broken crontab entry — wrap each in single quotes with proper escaping
🟡 [engineer] `test/cron-tick.test.mjs` — No test for `agt help cron-tick` or `agt help cron-setup`; spec "Done When" item 8 is unverified — add two cases to the existing `agt help <command>` suite
🟡 [engineer] `test/cron-tick.test.mjs` — No test for `agt cron-setup` command output; spec "Done When" items 6–7 (crontab line format, `--interval` flag) are completely untested — add a test calling `cmdCronSetup(["--interval", "15"])` and asserting `*/15` in output
🟡 [product] `STATE.json:tasks` — Tasks 2–9 remain "pending" but are fully implemented; harness will re-dispatch them — close all via harness to prevent redundant agent runs against already-complete code
🟡 [product] `bin/lib/cron.mjs:125` — `cmdCronSetup` has no unit tests; negative `--interval` values (e.g. `-5`) pass `parseInt(-5) || 30` truthy check and emit `*/-5 * * * *` — an invalid crontab entry; add validation and tests
🟡 [product] `bin/agt.mjs:171` — `agt help cron-tick` and `agt help cron-setup` are implemented but not covered by any test in the `agt help <command>` suite; add test coverage
🟡 [tester] `bin/lib/cron.mjs:64` — `readProjectNumber` returning null triggers `process.exit(1)` but has no test; add test: `readProjectNumber: () => null` → assert `exitCode === 1`
🟡 [tester] `bin/lib/cron.mjs:125` — `cmdCronSetup` has zero unit tests; `--interval -5` passes the `parseInt(-5) || 30` guard (−5 is truthy) and emits `*/-5 * * * *` — an invalid crontab entry; needs input clamping and tests
🟡 [tester] `test/cron-tick.test.mjs:1` — No test for `listProjectItems` throwing; the finally block releases the lock correctly but no status revert or `commentIssue` is triggered — silent crash with the item stuck in-progress on the board
[tester] **Overall:** The 5 `cmdCronTick` tests all pass and cover the happy path, failure path, and three guard conditions well. The two `🟡` gaps that matter most for production reliability are the untested `readProjectNumber: null` exit branch and the complete absence of coverage for `cmdCronSetup` (which also has a negative-interval bug). Eval written to `.team/features/cron-based-outer-loop/tasks/task-1/eval.md`.
🟡 [security] `bin/lib/cron.mjs:130` — Unquoted `cwd` and `agtPath` in generated crontab string. Paths containing spaces (common on macOS) produce broken crontab entries that either fail silently or execute the wrong binary. The line is printed for manual copy-paste so there's no immediate RCE, but the output is incorrect. Fix: single-quote each path — `'${cwd.replace(/'/g, "'\\''")}'`.
🟡 [security] `bin/lib/cron.mjs:101` — Issue `title` from the GitHub Project board is passed directly to `runSingleFeature` without sanitization. In `run.mjs:897`, it's written verbatim into `SPEC.md` (`# Feature: ${featureDescription}`) and then fed to Claude as task context. A board collaborator can craft a multi-line issue title to inject adversarial instructions into the Claude prompt. Fix: strip newlines and control chars before dispatch — `title.replace(/[\r\n\x00-\x1f\x7f]/g, " ").trim().slice(0, 200)`.
🟡 [simplicity] `bin/lib/cron.mjs:42` — `args` parameter declared but never used; `runSingleFeature` is called with hardcoded `[]` (line 101), silently dropping any flags passed to `cron-tick`; remove `args` or forward it to `_runSingleFeature`
[simplicity] - **Dead code**: No unused imports, unreachable branches, or commented-out code. The `args` parameter is accepted but never consumed — `_runSingleFeature` is always called with a hardcoded `[]`. This is an unused parameter that silently discards caller input (🟡, goes to backlog).
🔵 [architect] bin/lib/cron.mjs:130 — `cmdCronSetup` uses `process.argv[1]` for the agt binary path; in npx/symlink/dev invocations this can emit the wrong path in the generated crontab entry; document that users may need to adjust manually
🔵 [architect] test/cron-tick.test.mjs — No tests for `cmdCronSetup` (SPEC tasks 6–7) or `agt help cron-tick`/`agt help cron-setup` (SPEC task 8); implemented but unverified; should be addressed in follow-up tasks 6–8
🔵 [engineer] `bin/lib/cron.mjs:84` — `_listProjectItems` result used directly with `.filter()` without an `Array.isArray` guard; a null/undefined return throws a TypeError with no contextual message — add `Array.isArray` check or `?? []` fallback
🔵 [product] `bin/lib/cron.mjs:64` — `readProjectNumber` returning null triggers `process.exit(1)` but no test covers this path; add `readProjectNumber: () => null` → assert exitCode === 1
🔵 [tester] `test/cron-tick.test.mjs:125` — Status transition ordering (in-progress *before* run, done *after* completion) not asserted; array presence checks pass even if order is swapped
🔵 [tester] `test/cron-tick.test.mjs:125` — Test #3 never asserts that issue #8 (second ready item) is never dispatched
🔵 [tester] `bin/lib/cron.mjs:84` — Case-insensitive status matching is implemented but not covered by a test with non-standard casing (e.g., `"READY"`, `"ready"`)
🔵 [security] `bin/lib/cron.mjs:108` — Raw `err.message` (may contain local file paths or stack traces) is posted as a GitHub issue comment. In a public repo this leaks internal path structure. Fix: truncate and strip path components before posting.
🔵 [security] `bin/lib/cron.mjs:95` — `title` from the project board is logged directly; crafted ANSI escape codes could corrupt terminal output or the cron log. Low risk (log is local-only when using `cron-setup`).
🔵 [simplicity] `bin/lib/cron.mjs:112` — `lock.release` guard is redundant; `lockFile` always defines `release` when `acquired: true`; simplify to `lock.release()`

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs