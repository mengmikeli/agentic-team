## Parallel Review Findings

🟡 [architect] `bin/lib/run.mjs:1436` — Replan dispatches skip `mergePromptAppend`; correct per task scope ("brainstorm, build, review") but creates an undocumented contract gap against the SPEC's "called before each agent dispatch" language. Add a comment or SPEC amendment.
🟡 [architect] `test/extension-system.test.mjs:268` — No integration test exercises the actual `run.mjs` wiring (`if (append) brief += "\n" + append`). A change to the guard or separator would pass all tests while breaking integration.
🟡 [architect] `bin/lib/extensions.mjs:45` — `import()` executes module-level code before hook validation. A malicious `.mjs` file gets code execution even without valid hook exports. Document as accepted v1 constraint.
🟡 [engineer] test/extension-system.test.mjs:87 — Global-dir-skip path untested; `loadExtensions` hardcodes `homedir()` so the precedence test only proves project-level loading, not global deduplication. Extract directory list as parameter to enable testing.
🟡 [engineer] bin/lib/extensions.mjs:80 — Shared `ctx` reference across extensions in `callHook` loop; a buggy extension could mutate context for subsequent extensions. Shallow clone (`{ ...ctx }`) per extension would eliminate this.
🟡 [engineer] test/extension-system.test.mjs — No integration test for the run.mjs wiring (`if (append) brief += "\n" + append`). Extensions tested in isolation only.
🟡 [product] STATE.json:9 — Task-1 status says "blocked" but handshake says "completed". Fix bypassed the pipeline — no automated re-review.
🟡 [product] run.mjs:1436 — Replan dispatches skip `mergePromptAppend`. Spec says "before each agent dispatch" but task title scopes to "brainstorm, build, and review." Document the exclusion.
🟡 [product] test-output.txt:232 — Artifact is stale (references pre-fix architecture: `runHook`, `fireExtension`). Should be regenerated.
🟡 [product] flows.mjs — Spec says to wire hooks in `flows.mjs` but implementation puts them in `run.mjs`. Functionally equivalent but diverges from spec.
🟡 [tester] test/extension-system.test.mjs:87 — Project-level precedence test is misleading; the "fake-global" extension is written to a path `loadExtensions` never scans; test passes because only the project extension loads, not because the global is shadowed; rename or test `seen` Set logic directly
🟡 [tester] test/extension-system.test.mjs:1 — No integration test for the 4 `mergePromptAppend` wiring sites in run.mjs (lines 372, 1099, 1179, 1244); deleting `if (buildAppend) brief += "\n" + buildAppend` breaks nothing in the test suite (persistent gap)
🟡 [tester] bin/lib/run.mjs:368 — Shared mutable `registry` object in concurrent `runParallelReviews` calls; circuit-breaking one extension mid-flight affects concurrent reviews (persistent gap)
🟡 [security] `bin/lib/extensions.mjs:28` — Global extensions from `~/.agentic-team/extensions/` are auto-loaded for every project with no per-project opt-in; document prominently and consider adding a disable option
🟡 [security] `bin/lib/extensions.mjs:87` — `Promise.race` timeout cannot interrupt synchronous blocking (`while(true){}`); the event loop hangs indefinitely; document this limitation
🟡 [security] `bin/lib/run.mjs:1182` — Extension output is injected directly into a `--permission-mode bypassPermissions` agent prompt; document this implication for extension authors
🟡 [security] `tasks/task-1/artifacts/test-output.txt:232` — Test artifact is stale (test names from pre-fix architecture don't match current test file)
🟡 [simplicity] bin/lib/run.mjs:371 — `if (registry)` guard is a dead branch; `registry` is always truthy
🟡 [simplicity] .team/features/extension-system/SPEC.md:9 — SPEC still describes 4 hook types that were not implemented; update to reflect actual scope
🔵 [architect] `bin/lib/extensions.mjs:80` — Alphabetical execution order via `readdirSync().sort()` is undocumented for extension authors.
🔵 [architect] `bin/lib/extensions.mjs:45` — Node.js module cache means no hot-reload mid-run. Correct per SPEC but undocumented.
🔵 [architect] `tasks/task-1/artifacts/test-output.txt:232` — Stale artifact references prior 3-module architecture names.
🔵 [engineer] bin/lib/run.mjs:371 — Unnecessary `if (registry)` null guard in `runParallelReviews` (registry always defined); other call sites don't guard.
🔵 [engineer] bin/lib/extensions.mjs:33 — `readdirSync` in `async` function; minor inconsistency with async design.
🔵 [product] run.mjs:1099 — Add debug logging of extension append length for troubleshooting.
🔵 [product] test/extension-system.test.mjs:327 — Add integration test that verifies append reaches the brief string passed to `dispatchToAgent`.
🔵 [tester] test/extension-system.test.mjs:170 — No async hook happy-path test; all hooks are sync lambdas; add a test with `async function promptAppend() { return "ok"; }`
🔵 [tester] test/extension-system.test.mjs:347 — Truncation test doesn't verify first 4096 chars are original content
🔵 [tester] bin/lib/extensions.mjs:80 — `callHook` has no guard for `registry.extensions` being undefined
🔵 [security] `bin/lib/run.mjs:1180` — Full `brief` exposed to extensions via `ctx`; document what fields extensions receive
🔵 [security] `bin/lib/extensions.mjs:119` — No control character filtering in extension return values; low risk given trust model
🔵 [simplicity] bin/lib/run.mjs:368 — `runParallelReviews` now takes 8 positional parameters; consider options object for trailing params
🔵 [simplicity] bin/lib/extensions.mjs:76 — `callHook` exported with 1 production consumer; acceptable for testability but note for future review

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**