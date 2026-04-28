## Parallel Review Findings

🟡 [architect] `bin/lib/cron.mjs:67+80` — PROJECT.md is read twice (once for tracking config, once for project number). Merge into one return value.
🟡 [architect] `bin/lib/cron.mjs:87` — Lock file ends up at `.team/.cron-lock.lock` on disk (util.mjs appends `.lock`) vs SPEC's `.team/.cron-lock`. Rename the path or document it.
🟡 [engineer] `test/cron-tick.test.mjs` — Title sanitization at `cron.mjs:111` lost dedicated edge-case test coverage between iterations. Three tests for control chars, Unicode line separators, and 200-char truncation were removed. This is a security-relevant boundary (untrusted issue title → LLM agent).
🟡 [engineer] `cron.mjs:137-147` — Double-failure scenario (feature fails + recovery fails) leaves the board item permanently stuck in "in-progress" with no automated recovery. Stale-recovery logic existed in a prior iteration but was removed.
🟡 [product] test/cron-tick.test.mjs:159 — Test #3 doesn't assert `runSingleFeature` was called exactly once; a regression dispatching all Ready items would pass silently. Add a call counter. (Inherited from tester review, still unaddressed.)
🟡 [tester] test/cron-tick.test.mjs:66 — No test covers `listProjectItems` throwing (e.g., network error). Lock is released via `finally`, but the error propagates as an unhandled rejection. Add a test mocking `listProjectItems` to throw.
🟡 [tester] test/cron-tick.test.mjs:66 — `console.log`/`console.error` patched inline rather than in `beforeEach`/`afterEach`. If a test throws before restoring, the stub persists and can cause cascading failures. Match the pattern used by `cmdCronSetup` tests (line 420-428).
🟡 [security] `test/cron-tick.test.mjs` — Title sanitization at `cron.mjs:111` (control chars, U+2028/U+2029, 200-char truncation) has no dedicated test. Prior version had these tests but they were removed during simplification. Risk: security regression could go undetected.
🟡 [security] `bin/lib/cron.mjs:142` — Error messages from `runSingleFeature` posted to GitHub issue comments (truncated to 500 chars) could expose internal paths/stack traces on public repos.
🟡 [simplicity] `bin/lib/cron.mjs:121,133` — `statusErr` caught but discarded in two catch blocks. Operator loses error context (rate limit vs auth error vs 404) in cron.log. Include `statusErr.message` in the warning, or use bare `catch {}`.
🔵 [architect] `bin/lib/cron.mjs:70+76+82+91` — `process.exit()` in async function is an established codebase pattern but makes testing fragile.
🔵 [architect] `test/cron-tick.test.mjs` — No test for the Unicode line separator sanitization at `cron.mjs:111`.
🔵 [architect] `test/cron-tick.test.mjs` — CLI integration tests from task-5 build cycle weren't carried forward.
🔵 [engineer] `cron.mjs:146` — `err.message || err` coerces falsy empty-string messages; `err.message ?? String(err)` would be more precise.
🔵 [engineer] `cron.mjs:168` — No warning when `process.env.PATH` is empty before embedding in crontab line; produces silent `PATH=''` breakage.
🔵 [engineer] `cron.mjs:144` — Recovery error log doesn't distinguish "status revert failed" from "comment post failed".
🔵 [product] test/cron-tick.test.mjs:69-70 — Console monkey-patching not wrapped in try/finally; fragile for future test additions.
🔵 [product] bin/lib/cron.mjs:91 — Asymmetric exit patterns (`process.exit(0)` vs `return`) could confuse maintainers; a comment would help.
🔵 [tester] test/cron-tick.test.mjs:77 — No test with `{ status: null }` or `{ status: undefined }` items to document the optional-chaining contract.
🔵 [tester] test/cron-tick.test.mjs:77 — No test with `status: "READY"` (all uppercase) to explicitly confirm case-insensitive filtering.
🔵 [tester] test/cron-tick.test.mjs:236 — Truncation bound 520 is slightly loose; actual max is 518 (`"cron-tick failed: ".length + 500`).
🔵 [security] `tasks/task-2/artifacts/test-output.txt` — Artifact shows 16 tests from a prior code version; current code has 11 tests with different names. Gate evidence doesn't verify exact current code.
🔵 [security] `bin/lib/cron.mjs:168` — `cmdCronSetup` embeds full `process.env.PATH` in generated crontab line.
🔵 [security] `bin/lib/cron.mjs:70,76,83` — `process.exit()` in async function is intentional (pre-lock early exits) but makes testing harder.
🔵 [simplicity] `bin/lib/cron.mjs:116-123,128-135` — Try-catch with identical handling in both `!moved` and `catch` branches could be collapsed to reduce string duplication.
🔵 [simplicity] `test/cron-tick.test.mjs` — Console monkey-patching repeated 8 times; a shared `captureConsole()` helper would reduce boilerplate.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**