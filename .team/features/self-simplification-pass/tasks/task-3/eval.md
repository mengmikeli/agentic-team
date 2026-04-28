## Parallel Review Findings

🔴 [architect] `bin/lib/outer-loop.mjs:893` — Outer loop marks roadmap item done for `simplify-blocked` features because all tasks show "passed" (>50% threshold met). The feature is never finalized but gets permanently marked ✅ Done in PRODUCT.md — a data integrity bug on the primary production path. Fix: check `executeResult !== "simplify-blocked"` before `markRoadmapItemDone`.
🟡 [architect] `bin/lib/run.mjs:1532` — `"simplify-blocked"` is not in the recognized status vocabulary at `run.mjs:932`. On re-run it gets silently overwritten to `"executing"`.
🟡 [architect] `SPEC.md:10` — Spec requires "fix-then-re-verify loop (max 2 rounds)" but implementation does single-dispatch-then-fail. Spec not updated to match.
🟡 [architect] `tasks/task-3/eval.md` (prior version) — Previous PM eval referenced while loop and `MAX_FIX_ROUNDS` that no longer exist after refactoring. Stale eval breaks audit trail.
🟡 [engineer] `bin/lib/run.mjs:1611` — `harness("notify", "--event", "feature-complete")` fires unconditionally even when `simplifyBlocked === true`. External listeners receive a false "feature complete" signal.
🟡 [engineer] `bin/lib/outer-loop.mjs:896` — `markRoadmapItemDone()` checks task pass count but not the `executeResult` return value. When simplification blocks, the outer loop still marks the roadmap item done despite finalize never being called.
🟡 [product] SPEC.md:19 — Spec says "harness enters a fix loop (max 2 rounds)" but the fix loop was built then intentionally removed (commit `f3526fc`). Current code returns FAIL immediately with one dispatch. Spec needs updating or fix loop needs backlog item.
🟡 [product] bin/lib/run.mjs:1611 — `"feature-complete"` notification fires even when `simplifyBlocked === true`. External listeners get incorrect signal.
🟡 [product] test/simplify-pass.test.mjs — No integration test for the `simplifyBlocked → finalize blocked` path at `run.mjs:1524-1526`. The single ternary gating finalize has zero automated test coverage.
🟡 [tester] `bin/lib/run.mjs:1524` — Integration tests for the simplify-blocking-finalize path existed at task-3 time (7 tests in "run.mjs integration" block) but were **removed by subsequent tasks**. The critical path `FAIL → simplifyBlocked → skip finalize → set state` has zero integration test coverage now.
🟡 [tester] `bin/lib/run.mjs:1614` — When `blocked > 0` AND `simplifyBlocked` both true, STATE.json says "simplify-blocked" but function returns "blocked". State/return mismatch is untested and could confuse dashboard/outer-loop.
🟡 [tester] `test/simplify-pass.test.mjs:282` — "fails open when role file is missing" test doesn't actually test a missing role file — runs with the real file present. The catch branch at `simplify-pass.mjs:103` is unexercised.
🟡 [security] bin/lib/simplify-pass.mjs:58 — Diff embedded in markdown code fence without escaping triple-backtick sequences; a diff containing "```" breaks the fence, creating a prompt injection surface. Mitigate with a unique fence delimiter.
🟡 [security] bin/lib/simplify-pass.mjs:152 — Silent `catch {}` on STATE.json write swallows errors without logging. Metrics silently lost if disk/permission issues occur. Should log a warning to match the pattern at line 134.
🟡 [simplicity] `bin/lib/run.mjs:1524` — `finalizeResult` assigned but never read. Pre-existing dead variable; PR extended but didn't introduce it. Fix: replace with `if (!simplifyBlocked) harness("finalize", "--dir", featureDir);`
🔵 [architect] `bin/lib/run.mjs:782` — `_runSingleFeature` is 843 lines. Extract phase functions to reduce cognitive load.
🔵 [architect] `bin/lib/simplify-pass.mjs:15` — `DIFF_CAP=12000` truncates with no coverage metric. Record diff coverage ratio so operators know when review was partial.
🔵 [engineer] `test/simplify-pass.test.mjs:282` — "Fails open when role file is missing" test doesn't actually inject a missing path; it passes because the real role file exists.
🔵 [engineer] `bin/lib/run.mjs:1507` — When both `blocked > 0` and `simplifyBlocked`, STATE.json says "simplify-blocked" but the function returns "blocked" (task-level takes precedence). Minor inconsistency.
🔵 [engineer] `bin/lib/simplify-pass.mjs:152` — Silent empty `catch` on STATE.json write loses metrics silently.
🔵 [product] tasks/task-{1,2,3}/artifacts/test-output.txt — Stale; reference 19+ tests from removed suites.
🔵 [product] SPEC.md:38 — Technical approach still describes fix loop mechanics that no longer apply.
🔵 [tester] `bin/lib/run.mjs:1507` — `--no-simplify` flag and `completed === 0` guard have no test coverage.
🔵 [security] bin/lib/simplify-pass.mjs:36 — `mergeBase` interpolated without SHA-1 format validation. Low risk since `execFileSync` prevents injection, but a format check adds defense-in-depth.
🔵 [security] bin/lib/run.mjs:1507 — `args.includes("--no-simplify")` could false-positive on a task description containing that string. Use `hasFlag(args, "no-simplify")` for consistency with the rest of the CLI.
🔵 [simplicity] `bin/lib/run.mjs:1604` — Phase array duplicated from `phaseOrder` on line 1578. Pre-existing pattern; PR just added "simplify" to both.
🔵 [simplicity] `test/.test-workspace/features/*/STATE.json` — Timestamp-only diffs committed from test execution. Noisy.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**