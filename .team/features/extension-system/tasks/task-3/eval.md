## Parallel Review Findings

🟡 [architect] `run.mjs:1322` — `ext-{name}-run.txt` artifacts not registered in handshake (5th consecutive review round — highest priority backlog item)
🟡 [architect] `extensions.mjs:160` — Timeout/circuit-breaker logic duplicated between `callHook` and `runExecuteRun`; safe today (shared constants) but fragile under future changes — extract shared `withExtensionGuard` helper
🟡 [architect] `run.mjs:1219` — No formal context type contract for hooks; each hook receives different context properties with no documentation for extension authors
🟡 [engineer] `bin/lib/extensions.mjs:199` — `spawned.error` never checked; invalid cwd from extension causes `spawnSync` to fail silently (status=null, signal=null → exitCode=0), masking required-check failures. Fix: add `if (spawned.error) exitCode = 1;`
🟡 [engineer] `bin/lib/run.mjs:1219` — Extension artifacts (`ext-{name}-run.txt`) written to disk but never registered in any handshake; dashboard/reporters can't discover them. Carried from 3+ review rounds.
🟡 [engineer] `bin/lib/run.mjs:371` — Dead `if (registry)` guard; `loadExtensions()` always returns a truthy object. Carried from prior review.
🟡 [product] `bin/lib/extensions.mjs:201-206` — Artifact naming mismatch: spec says "cli-output artifact" but implementation writes untyped `ext-{name}-run.txt` files not registered in handshake; downstream tools can't discover these artifacts
🟡 [product] `run.mjs:1219-1228` — No integration test for the executeRun failure → retry path; `lastFailure = reason; continue;` is the critical wiring and a refactor could silently break it
🟡 [product] `bin/lib/extensions.mjs:190` — No guard against empty/whitespace-only command strings before passing to `sh -c`
🟡 [product] `SPEC.md:120-129` — Four "Done When" items remain incomplete for the overall feature: `artifactEmit` not implemented, no example extension, no `agt doctor` integration, test file naming differs from spec
🟡 [tester] test/extension-system.test.mjs — Regression test "missing required field defaults to non-blocking" deleted during refactor; add test with `required: undefined` + exit 1
🟡 [tester] bin/lib/extensions.mjs:166 — Timeout + circuit breaker logic duplicated from `callHook` has zero test coverage in `runExecuteRun`; regression in this copy would go undetected
🟡 [tester] tasks/task-4/artifacts/test-output.txt — Stale artifact; contains test names (`runExecuteRunCommands`, `fireExtension`) from prior code version that no longer exist
🟡 [tester] test/extension-system.test.mjs — No test for multiple required extensions where first fails; early-return at line 212 untested
🟡 [tester] bin/lib/run.mjs:1218 — Integration wiring into retry loop untested; `lastFailure` assignment and `continue` after failure unverified
🟡 [security] `bin/lib/extensions.mjs:190` — No explicit `maxBuffer` on `spawnSync`; relies on Node.js default (~1MB); `runGateInline` sets 50MB but `runExecuteRun` does not; add `maxBuffer: 10 * 1024 * 1024` for consistency
🟡 [security] `bin/lib/extensions.mjs:197` — `spawned.error` not checked after `spawnSync`; misses ENOENT (bad cwd), timeout kills, and maxBuffer overflows; check and include in artifact/reason for better diagnostics
🟡 [security] `bin/lib/extensions.mjs:202` — Artifacts written to disk but NOT registered in handshake artifact list; creates audit gap — harness doesn't know about extension-run artifacts
🟡 [security] `bin/lib/run.mjs:1219` — `executeRun` runs inside the retry loop; extension commands with side effects (notifications, external API calls) will fire on every retry; context doesn't include `attempt` number
🟡 [simplicity] extensions.mjs:168 — Hook descriptor call uses `EXECUTE_RUN_TIMEOUT_MS` (30s) but the hook just returns a simple `{command, cwd?, required?}` object; use `DEFAULT_TIMEOUT_MS` (5s) for the hook call, reserve 30s for `spawnSync` only
🟡 [simplicity] extensions.mjs:160 — Timeout + circuit breaker pattern duplicated from `callHook` (~15 lines); if circuit breaker logic changes, two sites must be synchronized; acceptable trade-off today but consider extracting a shared helper if a 4th consumer appears
🔵 [architect] `extensions.mjs:206` — No artifact size cap on `writeFileSync`; verbose commands could produce megabytes
🔵 [architect] `extensions.mjs:199` — Signal-killed process exit code hardcoded to `1`; signal name not exposed in artifact
🔵 [engineer] `bin/lib/extensions.mjs:172,193` — Single extension can take up to 60s (30s hook + 30s spawn); clarify if intent is 30s total or per-stage.
🔵 [engineer] `test/extension-system.test.mjs:840` — stderr test assertion matches command echo as well as actual stderr; assert `--- stderr ---` marker for precision.
🔵 [product] `bin/lib/extensions.mjs:199` — Signal name lost when `spawned.signal` maps to exit code 1; including signal name in artifact would improve debuggability
🔵 [product] `test/extension-system.test.mjs:561` — All tests use macOS-only commands; no cross-platform coverage
🔵 [tester] bin/lib/extensions.mjs:199 — Signal handling (`spawned.signal ? 1`) never tested; hard to test in CI
🔵 [tester] bin/lib/extensions.mjs:202 — `ctx.taskDir` absent path has no explicit test
🔵 [tester] bin/lib/extensions.mjs:193 — `spawnSync` 30s timeout is OS-level; acceptable to leave untested
🔵 [security] `bin/lib/extensions.mjs:189` — `desc.cwd` accepted without existence check; ENOENT fails silently due to unchecked `spawned.error`
🔵 [security] `bin/lib/extensions.mjs:206` — Raw `desc.command` string written to artifact; consider truncating long commands
🔵 [security] `bin/lib/run.mjs:1225` — No explicit task transition or progress entry recorded for executeRun-specific failures
🔵 [simplicity] extensions.mjs:206 — Artifact write could produce malformed output if stdout doesn't end with newline before stderr separator; consider ensuring trailing newline

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**