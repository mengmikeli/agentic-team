## Parallel Review Findings

[simplicity veto] No 🔴 critical findings. Evaluation written to `tasks/task-16/eval-simplicity.md`.
🟡 [architect] bin/lib/extensions.mjs:124 — (Pre-existing, from task-15) `Promise.race` timeout pattern leaves hook promises without `.catch()` handler — can produce unhandled rejection if timed-out hook later rejects. Backlog item.
🟡 [product] `handshake.json`:2 — `nodeType: "build"` but task-16 commits modified zero code files; integration was done in prior tasks. Should be `"review"`.
🟡 [product] `handshake.json`:9 — Artifacts list claims 3 files that were not modified by this task.
🟡 [product] `tasks/task-16/` — No `artifacts/test-output.txt`; "670 tests pass" claim not self-contained.
🟡 [product] `tasks/task-16/` — No `spec.md`; acceptance criteria inferred from title only.
🟡 [tester] `test/extension-system.test.mjs` — No integration test verifies `_runSingleFeature` actually calls `loadExtensions()` and passes registry to the 9 dispatch sites. The project already uses "source assertion" patterns (regex on source code) in `test/worktree.test.mjs:223` for similar wiring. Add equivalent assertions.
🟡 [tester] `bin/lib/run.mjs:368` — `runParallelReviews` has zero test coverage in the entire suite. It was modified to accept `registry` and call `mergePromptAppend(registry, ...)`. If either were removed, no test would detect it.
🟡 [security] bin/lib/extensions.mjs:236 — `runExecuteRun` passes extension-returned shell commands to `sh -c` without on-screen attribution of which extension supplied the command. Add console logging like `[ext] ${ext.name}: running "${desc.command}"` before spawning.
🟡 [security] bin/lib/extensions.mjs:58-61 — Global extension directory `~/.agentic-team/extensions/` auto-loads without per-project opt-out. Consider a config option to disable global extension loading for untrusted projects.
🟡 [simplicity] bin/lib/run.mjs:368 — `runParallelReviews` now takes 8 positional parameters; consider an options object for the trailing params to reduce cognitive load at the call site
🟡 [simplicity] bin/lib/extensions.mjs:216 — Timeout+circuit-breaker pattern is duplicated between `callHook` and `runExecuteRun`; if a third hook type needs direct iteration, extract the timeout wrapper
🔵 [architect] bin/lib/run.mjs:786 — `_runSingleFeature` is ~860 lines. As it grows, consider extracting review-phase logic (lines 1250-1427) into a helper. Not urgent for v1.
🔵 [architect] bin/lib/run.mjs:368 — `runParallelReviews` only calls `mergePromptAppend`, not `mergeVerdictAppend`/`runArtifactEmit` per role. This is correct (verdict/artifacts are per-task, not per-role) but worth documenting if the hook contract is formalized.
🔵 [product] `run.mjs`:916 — Extension load failures are silent; consider logging to STATE.json for observability.
🔵 [tester] `.team/features/extension-system/tasks/task-16/artifacts/` — No `test-output.txt` artifact captured. Unlike tasks 1-4, the builder didn't persist gate evidence.
🔵 [tester] `bin/lib/extensions.mjs:117` — Extensions receive `ctx` by reference; a buggy extension could mutate shared fields affecting subsequent hooks. Consider `Object.freeze(ctx)` or shallow-copy.
🔵 [security] bin/lib/extensions.mjs:78 — Extension logging at run.mjs:918 shows names but not source directory (project vs. global). Distinguishing source would help users audit trust boundaries.
🔵 [security] bin/lib/run.mjs:371-373 — Concurrent `mergePromptAppend` calls in `runParallelReviews` share `consecutiveFailures` counters with theoretical interleaving; outcome is benign but worth documenting.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**