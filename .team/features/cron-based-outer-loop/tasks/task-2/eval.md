## Parallel Review Findings

🔴 [simplicity] `bin/lib/cron.mjs:82` — Dead code: `return` after `process.exit(0)` is unreachable — production exits before it; test mock throws before it. Remove it.
🔴 [simplicity] `bin/lib/cron.mjs:42` — Gold-plating: `args` parameter accepted but `_runSingleFeature([], title)` at line 109 hardcodes `[]`; JSDoc confirms "unused for now" — speculative extensibility with no stated requirement. Remove the parameter or forward it.
🔴 [simplicity] `bin/lib/cron.mjs:120` — Dead code: `lock.acquired &&` is always true in `finally` — execution only reaches `try` after the guard at lines 79–82 ensures `lock.acquired` is true. Simplify to `if (lock.release) { lock.release(); }`.
[simplicity] **Verdict: FAIL** — 3 🔴 findings (2 dead code, 1 gold-plating). Eval written to `.team/features/cron-based-outer-loop/tasks/task-1/eval.md`.
🟡 [architect] `bin/lib/cron.mjs:20` — `readProjectNumber` reads `.team/PROJECT.md` a second time; `readTrackingConfig` (github.mjs:43) already reads the same file in the same call chain — add `projectNumber` to `readTrackingConfig`'s return value and remove the separate function and injectable dep
🟡 [architect] `bin/lib/cron.mjs:42` — `args` accepted but `_runSingleFeature([], title)` at line 109 hardcodes `[]`, silently discarding any CLI flags; forward `args` or remove the parameter to avoid a misleading public API
🟡 [architect] `test/cron-tick.test.mjs:153` — both transition assertions use `.some()` with no ordering check; a transposition bug (done before in-progress) still passes; replace with index-based assertions to lock the "before execution" invariant
🟡 [architect] `bin/lib/cron.mjs:141` — `PATH=${process.env.PATH}` is unquoted in the generated crontab string while `cwd` and `agtPath` are correctly wrapped with `quotePath()` which is already in scope — apply it to PATH as well
[architect] **4 backlog items** (all 🟡): duplicate PROJECT.md I/O, silent args discard, unordered transition test assertions, unquoted PATH in cron-setup. No blockers.
🟡 [engineer] `test/cron-tick.test.mjs:153` — Test verifies both transitions occurred but not their order; use `findIndex` to assert `inProgressIdx < doneIdx` and that run was called between them
🟡 [engineer] `bin/lib/cron.mjs:115` — `_setProjectItemStatus` return value discarded on the failure revert path; if this call fails, the board item is stuck in "in-progress" permanently with no log message — at minimum log a warning on `false` return
[engineer] Two 🟡 warnings go to backlog:
🟡 [product] test/cron-tick.test.mjs:153 — Both transition assertions use `.some()` with no ordering check; a bug transposing "in-progress" and "done" would pass; replace with index-based assertions to lock the "before execution" invariant from the spec
[product] **One backlog item flagged:** the test at `test/cron-tick.test.mjs:153` does not assert transition ordering, only presence — a regression inverting the order would not be caught. Filed as 🟡, no merge block.
🟡 [tester] `test/cron-tick.test.mjs:153` — Transition ordering not enforced; both success assertions use `.some()`, so a bug setting "done" before "in-progress" passes undetected — replace with index-based assertions
🟡 [tester] `test/cron-tick.test.mjs:125` — "First item only" contract incompletely tested; no call-count assertion on `runSingleFeature`, and no check that issue #8 was NOT dispatched — add both
🟡 [tester] `bin/lib/cron.mjs:141` — `process.env.PATH` has no null guard; undefined PATH produces literal `PATH=undefined` in crontab output; no test covers this — add `?? ""` and a test
[tester] The core feature is correctly implemented and directly tested — `Ready → In Progress → Done` transitions work, the failure revert is covered, the lock prevents concurrent runs, and all 12 tests pass (confirmed via test-output.txt lines 240–253, exit 0). Three 🟡 warnings go to backlog; no blockers.
🟡 [security] bin/lib/cron.mjs:141 — `process.env.PATH` is embedded unquoted in the generated crontab string; `quotePath()` is in scope and applied to `cwd`/`agtPath` but not PATH. Shell metacharacters in PATH (feasible via `.envrc` or npm scripts) produce an injectable crontab line; `PATH=undefined` is emitted when PATH is unset. Fix: `PATH=${quotePath(process.env.PATH ?? "")}`
🟡 [security] bin/lib/cron.mjs:116 — Raw `err.message` posted to public GitHub issue comment via `commentIssue`; errors from `runSingleFeature` transitive deps can include local absolute paths, `gh` auth error details, or internal state. No secondary shell injection risk (spawnSync uses array args), but data is world-readable on a public repo. Fix: strip absolute paths and truncate to ≤300 chars before posting.
🟡 [simplicity] `bin/lib/cron.mjs:20` — Duplicate file read: `readProjectNumber` re-parses `.team/PROJECT.md`, which `readTrackingConfig` (github.mjs:41) already reads in the same call chain. Add `projectNumber` to `readTrackingConfig`'s return value to eliminate the second parse and the `_readProjectNumber` injectable dep.
🟡 [simplicity] `bin/lib/cron.mjs:141` — `process.env.PATH` is embedded unquoted in the crontab string; `quotePath` is already in scope and applied to `cwd` and `agtPath`. Use `quotePath(process.env.PATH ?? "")`.
🟡 [simplicity] `test/cron-tick.test.mjs:152` — Status transition ordering not asserted: `.some()` passes even if "done" is recorded before "in-progress". Use index-based assertions to lock the required sequence.
🔵 [architect] `bin/lib/cron.mjs:120` — `lock.acquired &&` is always true when finally executes (false branch exits at lines 79–82); simplify guard to `if (lock.release)`
🔵 [architect] `bin/lib/cron.mjs:90` — `items.filter(...)` with no `?? []` guard; production always returns `[]` on failure (github.mjs:232,244) but a future contract change throws an uncontextualized TypeError
🔵 [architect] `bin/lib/github.mjs:229` — `listProjectItems` returns GitHub API natural order with no sort; which "first Ready" issue is dispatched is non-deterministic across API responses — document or add an explicit sort
🔵 [engineer] `bin/lib/cron.mjs:106` — `_setProjectItemStatus` return value discarded for "in-progress" pre-execution transition; failed board update goes unlogged
🔵 [engineer] `bin/lib/cron.mjs:111` — `_setProjectItemStatus` return value discarded for "done" post-execution transition; failed board update goes unlogged
🔵 [engineer] `bin/lib/github.mjs:266` — `readTrackingConfig()` called with no args inside `setProjectItemStatus`, causing a redundant PROJECT.md read every time; accept tracking config as a parameter or use the already-loaded config from the caller
🔵 [tester] `bin/lib/cron.mjs:87` — No `?? []` guard before `.filter()` at line 90; real impl always returns `[]` on error (github.mjs:227 documents it), but null return from a future impl change throws uncontextual TypeError — add `?? []`
🔵 [tester] `bin/lib/cron.mjs:101` — Title sanitization (control-char strip, 200-char truncation) has no dedicated test; add cases with embedded `\n` and a 300-char title
🔵 [tester] `test/cron-tick.test.mjs` — Non-numeric `--interval` (e.g. `"abc"`) untested; fallback to 30 is correct but path has no coverage
🔵 [tester] `bin/lib/cron.mjs:116` — Raw `err.message` posted to GitHub comment without sanitization; may expose local file paths in public repos
🔵 [security] bin/lib/cron.mjs:101 — Title sanitization strips ASCII control chars but not Unicode bidi overrides (U+202A–U+202E, U+2066–U+2069); extend regex if terminal display integrity matters.
🔵 [security] bin/lib/cron.mjs:120 — `lock.acquired &&` is unreachable dead code in `finally` (execution only reaches `try` when `acquired` is already true) — deduped from multiple prior reviewers, not a security concern.

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs