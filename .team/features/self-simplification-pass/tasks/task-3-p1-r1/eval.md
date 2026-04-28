## Parallel Review Findings

🟡 [architect] test/run-batches.mjs:16 — Hardcoded test file list will drift as new test files are added; consider generating from glob or referencing a shared constant
🟡 [architect] bin/lib/simplify-pass.mjs:15 — DIFF_CAP of 12K chars may be insufficient for large features; consider making configurable via env var
🟡 [engineer] test/run-batches.mjs:1 — Gate output is stale; references tests for functions removed in task-3 (`isCodeFile`, `getChangedFiles`, `runSimplifyFixLoop`). Re-run `npm test` against current HEAD.
🟡 [engineer] SPEC.md:10 — Spec still says "fix loop max 2 rounds" but code does single-dispatch-then-FAIL. Update spec to match implementation.
🟡 [engineer] bin/lib/run.mjs:1527 — Zero integration test coverage for `simplifyBlocked → finalize blocked` path. The 7 integration tests that existed at task-3 were removed and never re-added.
🟡 [engineer] bin/lib/outer-loop.mjs:922 — Prints "shipped" unconditionally, even for simplify-blocked features. Roadmap marking is correctly guarded (line 897), but console message is misleading.
🟡 [product] `bin/lib/run.mjs:1510` — `--no-simplify` flag was explicitly out of scope in SPEC; add to backlog or update SPEC to document it
🟡 [product] `bin/lib/run.mjs:1535` — `simplify-blocked` state not in SPEC; SPEC says "feature remains in its current state" but implementation creates a new terminal state; update SPEC or document the deviation
🟡 [tester] test/run-batches.mjs:16 — Hardcoded test file list will silently skip new test files; add a staleness-check test comparing the explicit list + known exclusions against the glob
🟡 [tester] bin/lib/run.mjs:1510 — `--no-simplify` flag conditional and `simplify-blocked` state transition (lines 1532-1536) lost integration test coverage when fix-loop tests were removed in commit f3526fc
🟡 [tester] test/run-batches.mjs:56 — Batch runner only shows last batch's summary count (`ℹ tests 25`), not the aggregate (596); CI gate sees a misleadingly low number
🟡 [security] `test/run-batches.mjs:15` — New `simplify-blocked` test added to `outer-loop.test.mjs` but that file is excluded from the batch runner. The guard preventing premature feature graduation is tested but never executed by `npm test`.
🟡 [security] `bin/lib/notify.mjs:59` — Pre-existing: Discord webhook URL used in shell `execSync` command. Should use `execFileSync("curl", [...args])` instead.
🟡 [security] `bin/lib/simplify-pass.mjs:115` — Pre-existing: Dispatch failure leaves no persistent audit record — can't distinguish clean pass from bypassed gate.
🟡 [simplicity] `test/run-batches.mjs:16` — Hardcoded test file list excludes `test/outer-loop.test.mjs`, which has a new test added by this PR (simplify-blocked behavior). The new test is never run by `npm test`.
🟡 [simplicity] `bin/lib/outer-loop.mjs:892` — The `simplify-blocked` guard is tested only in the excluded test file. Correctness verified by code inspection only, not by automated gate.
🔵 [architect] bin/lib/run.mjs:1510 — `completed > 0` guard skips simplification when all tasks blocked; correct but undocumented
🔵 [architect] bin/lib/simplify-pass.mjs:99 — Role file path hardcoded relative to module; fails open gracefully if moved
🔵 [engineer] test/simplify-pass.test.mjs:282 — Role-file-missing test doesn't exercise the catch branch. Inject `_rolePath` to make it testable.
🔵 [engineer] bin/lib/simplify-pass.mjs:95 — Empty diff skips STATE.json write; dashboard sees `undefined` for `simplifyPass`.
🔵 [engineer] bin/lib/run.mjs:1619 — `blocked > 0 && simplifyBlocked` produces state/return-value mismatch (STATE says "simplify-blocked", function returns "blocked").
🔵 [product] `bin/lib/simplify-pass.mjs:142` — `simplifyPass` state includes extra `dispatches` field not in SPEC shape; harmless but undocumented
🔵 [product] `test/run-batches.mjs:16` — Hardcoded test file list requires manual updates when new test files are added
🔵 [tester] test/run-batches.mjs:44 — No timeout on individual batch spawns; unexpected hang blocks indefinitely
🔵 [tester] bin/lib/simplify-pass.mjs:152 — Silent `catch {}` inconsistent with other catches that log warnings
🔵 [tester] test/run-batches.mjs:61 — `break` on first batch failure hides test failures in later batches
🔵 [security] Multiple files — `10 * 1024 * 1024` repeated ~30 times. Extract to a named constant.
🔵 [security] `bin/lib/run.mjs:291` — Pre-existing: `bypassPermissions` on agent dispatch should be documented as intentional trust boundary.
🔵 [security] `bin/lib/doctor.mjs:417` — `checkTests` buffers `npm test` output independently (10MB cap) while the batch runner uses `stdio: "inherit"`. Could still ENOBUFS if called from `agt doctor`.
🔵 [simplicity] `bin/lib/simplify-pass.mjs:30` — `maxBuffer: 10 * 1024 * 1024` is repeated 40+ times across the codebase. Extract to a shared constant in `util.mjs`.
🔵 [simplicity] `test/run-batches.mjs:16` — Consider glob + exclusion list instead of hardcoded allow-list to automatically include new test files.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**