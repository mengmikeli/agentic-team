## Parallel Review Findings

🔴 [product] `test/run-batches.mjs:16` — `test/outer-loop.test.mjs` was created in commit `375703a` but never added to the batch runner's file list. `npm test` silently skips it. The test that validates the outer-loop `simplify-blocked` guard never runs.
🟡 [architect] test/run-batches.mjs:16 — Hardcoded test file list must be manually updated when new tests are added; consider deriving from glob with an exclude list for known-hanging tests
🟡 [architect] bin/lib/simplify-pass.mjs:15 — `DIFF_CAP = 12000` char-based truncation could cut off important diffs; consider truncating at `diff --git` boundaries instead
🟡 [engineer] test/outer-loop.test.mjs:680 — New `simplify-blocked` test added but file excluded from `run-batches.mjs`; never runs via `npm test`
🟡 [engineer] test/run-batches.mjs:16 — `outer-loop.test.mjs` blanket-excluded; mock-based tests could be split out or included individually
🟡 [engineer] test/simplify-pass.test.mjs:1 — "run.mjs integration" wiring tests deleted in f3526fc alongside fix-loop removal; no integration coverage for simplify pass call site in run.mjs
🟡 [engineer] bin/lib/doctor.mjs:40 — `maxBuffer: 10MB` sprayed across 20+ trivial-output commands (`which claude`, `git branch --show-current`, etc.); defensive but noisy
🟡 [product] `test/run-batches.mjs:15` — Explicit file list is a maintenance hazard; the exclusion reason ("polls real GitHub") doesn't apply to the new mocked test file
🟡 [product] `375703a` — Bundles 3 unrelated concerns (maxBuffer, simplify-blocked guard, notification suppression) into one "ENOBUFS" commit
🟡 [product] `bin/lib/run.mjs:293` — 50MB maxBuffer for agent dispatch vs 10MB everywhere else, undocumented
🟡 [product] `STATE.json` — Feature marked "completed" with only 1/15 tasks passed (6.7%)
🟡 [tester] test/run-batches.mjs:16 — Hardcoded test list goes stale silently when new test files are added; add a staleness-check test that compares explicit list + exclusions against the glob
🟡 [tester] package.json:24 — `test:full` glob includes approval-gate and outer-loop (known hangers); update the script to exclude them or remove it
🟡 [security] `bin/lib/run.mjs:61` — Pre-existing: `runGateInline` uses `shell: true` with a dynamic `cmd` from PROJECT.md. Operator-trust model mitigates this, but consider `execFile` with arg splitting.
🟡 [security] `bin/lib/notify.mjs:59` — Pre-existing: Discord webhook builds a shell command string. `JSON.stringify` provides escaping but consider `execFileSync("curl", [...])` to eliminate shell.
🟡 [simplicity] bin/lib/outer-loop.mjs — `--no-simplify` flag is NOT forwarded to inner loop invocation per feature-branch SPEC line 45. Flag only works in direct `agt run`, not through the continuous outer loop.
🟡 [simplicity] ~30 files — `maxBuffer: 10 * 1024 * 1024` added shotgun-style to calls producing trivial output (`gh --version`, `which claude`, etc.). Root cause was `npm test` output buffering, fixed by `test/run-batches.mjs`. The maxBuffer additions are defensive but disproportionate.
🔵 [architect] bin/lib/run.mjs:1510 — `completed > 0` guard on simplify pass is correct but untested; add a test documenting the skip-when-all-blocked intent
🔵 [architect] bin/lib/simplify-pass.mjs:152 — Silent catch on STATE.json write is consistent with codebase but masks failures
🔵 [engineer] bin/lib/simplify-pass.mjs:152 — Silent catch for STATE.json write; other catches in file log warnings
🔵 [engineer] test/run-batches.mjs:61 — `break` on batch failure masks errors in later batches
🔵 [engineer] bin/lib/simplify-pass.mjs:15 — `DIFF_CAP` char-based truncation can split diff hunks mid-line
🔵 [product] Extract `maxBuffer: 10 * 1024 * 1024` to a shared constant instead of repeating it ~30 times
🔵 [product] `test/run-batches.mjs:61` — No error reporting on batch failure (which batch? which files?)
🔵 [tester] test/run-batches.mjs:1 — No unit tests for the batch runner itself; consider a test that validates list completeness
🔵 [tester] test/run-batches.mjs:46 — Each batch prints its own TAP summary via `stdio: "inherit"`; final visible count shows only the last batch (25 tests), not the aggregate
🔵 [tester] test/run-batches.mjs:44 — No timeout on individual batch execution
🔵 [security] `test/run-batches.mjs:46` — Clean. Hardcoded file list, `spawn` with array args, no shell.
🔵 [security] `bin/lib/run.mjs:295` — 50MB maxBuffer is large but acceptable for CLI-only use.
🔵 [security] `bin/lib/run.mjs:935` — `simplify-blocked` status addition is a string literal in a whitelist. No injection surface.
🔵 [simplicity] test/run-batches.mjs:16-42 — Hardcoded test file list could be auto-discovered with a glob + explicit excludes.
🔵 [simplicity] bin/lib/simplify-pass.mjs:15 — `DIFF_CAP = 12000` magic number; a brief comment explaining the cost rationale would help.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**