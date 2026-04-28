## Parallel Review Findings

🟡 [tester] `bin/lib/cron.mjs:20-31` — `readProjectNumber` has zero direct test coverage. All tests mock it via DI, so the actual regex, file reading, and error handling are never exercised. Add an integration-style test using a real temp PROJECT.md.
🟡 [tester] `bin/lib/cron.mjs:111` — Title sanitization (control chars, Unicode line separators, 200-char truncation) has no test coverage. This is a log-injection defense that should be validated.
🟡 [security] `bin/lib/cron.mjs:159` — Path sanitization regex in error comments is incomplete for container/CI environments. Missing `/opt/`, `/srv/`, `/mnt/`, `/data/`, `/app/`, `/etc/`, `/run/` prefixes — could leak filesystem paths in GitHub issue comments.
🟡 [security] `bin/lib/cron.mjs:164` — Raw `err.message` logged to `.team/cron.log` without path sanitization. Low risk (local file) but could leak paths if log is shared.
🔵 [architect] `bin/lib/cron.mjs:20-31` — `readProjectNumber` does a separate `readFileSync` from `readTrackingConfig` (both read `.team/PROJECT.md`). DI pattern justifies the separation; negligible I/O cost for a 30-min cron job.
🔵 [architect] `test/cron-tick.test.mjs:523-531` — Test 6 inlines a tracking config identical to the `TRACKING_CONFIG` constant. Could reuse the constant.
🔵 [architect] `bin/lib/cron.mjs:96` — `_listProjectItems` is called synchronously but the real impl shells out to `gh`. A JSDoc annotation noting the sync contract would prevent breakage if it ever becomes async.
🔵 [tester] `test/cron-tick.test.mjs:514-554` — Test 6 doesn't verify `lockFile` and `setProjectItemStatus` are NOT called when project number is missing. Minor gap — add tracking flags to catch accidental code reordering.
🔵 [tester] `bin/lib/cron.mjs:96` — No test for `listProjectItems` throwing. Lock is released via `finally` (good), but the error propagates unhandled with no `tsError` diagnostic.
🔵 [security] `bin/lib/cron.mjs:111` — Title sanitization misses Unicode bidirectional override characters (U+200E-U+200F, U+202A-U+202E). Could make log output visually misleading.
🔵 [security] `bin/lib/cron.mjs:186` — `cmdCronSetup` embeds full `process.env.PATH` in crontab output.
🔵 [security] `test/cron-tick.test.mjs:58` — Test `process.exit` mock doesn't set `exitCode` property, diverging from production interception pattern.
🔵 [simplicity] `bin/lib/cron.mjs:20` / `bin/lib/outer-loop.mjs:118` — `readProjectNumber` is body-identical in both files. Pre-existing duplication, not introduced by this task.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**