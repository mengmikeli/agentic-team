## Parallel Review Findings

🟡 [engineer] `bin/lib/cron.mjs:128` — `process.exit()` interception is one-shot. If `runSingleFeature` catches the thrown error internally and re-calls `process.exit()`, the second call terminates without board revert. Document this limitation or use a counter-based approach.
🟡 [engineer] `bin/lib/cron.mjs:159` — Path sanitization regex misses `/opt/`, `/srv/`, `/usr/`, `/nix/`. NixOS CI or custom container paths could leak into GitHub issue comments. Backlog item (pre-existing gap).
🟡 [product] `test/cron-tick.test.mjs:514-554` — Tests 6 and 7 omit `!statusCalled` assertion that test 5 includes. Symmetric coverage would protect against future refactoring. Add to backlog.
🟡 [tester] test/cron-tick.test.mjs — No test for title sanitization at `cron.mjs:111`; the regex stripping control chars/Unicode separators and `.slice(0, 200)` truncation are never exercised
🟡 [tester] test/cron-tick.test.mjs — No test for path sanitization in error comments at `cron.mjs:159`; the regex that replaces file paths with `<path>` before posting to GitHub has no coverage
🟡 [tester] test/cron-tick.test.mjs — No test for `commentIssue` throwing in the failure recovery path at `cron.mjs:161-162`; independent try/catch exists but only the revert-throws path is tested (4b), not comment-throws
🟡 [tester] bin/lib/cron.mjs:96 — No test for `listProjectItems` throwing; error propagates through try/finally with no catch, lock released but behavior unspecified
🟡 [security] `bin/lib/cron.mjs:159` — Path sanitization regex misses `/etc/`, `/opt/`, `/srv/`, `/mnt/`, `/snap/` prefixes. Filesystem paths under these directories could leak into GitHub issue comments on non-standard CI runners. **Backlog item** — the current regex is a major improvement over the prior state.
🔵 [architect] `test/cron-tick.test.mjs:514-531` — Test 6 inlines a config object identical to `TRACKING_CONFIG` constant; could reuse it
🔵 [architect] `test/cron-tick.test.mjs:547-553` — Tests 6 and 7 omit `!statusCalled` assertion that test 5 includes; minor symmetry gap
🔵 [engineer] `bin/lib/cron.mjs:118` — Both `false` return and thrown error from `setProjectItemStatus` produce identical warning messages. Differentiate for debuggability.
🔵 [engineer] `test/cron-tick.test.mjs:58` — Test's `process.exit` mock (throws instead of terminating) is subtly different from production behavior. Correct for current code but worth noting for future changes.
🔵 [product] SPEC.md acceptance criteria don't explicitly list exit-1 behavior for missing config. For future features, pre-flight validation criteria should be listed explicitly.
🔵 [tester] test/cron-tick.test.mjs — No test for `setProjectItemStatus` throwing during in-progress transition at `cron.mjs:121`
🔵 [tester] bin/lib/cron.mjs:167 — `lock.release?.()` in finally has no error handling; if release throws, it could mask the original error
🔵 [security] `bin/lib/cron.mjs:128-132` — process.exit interception has a theoretical race window if `runSingleFeature` ever spawns async work that outlives the await. Document the constraint or refactor to thrown errors long-term.
🔵 [security] `bin/lib/cron.mjs:186` — `cmdCronSetup` embeds full `process.env.PATH` in the crontab line. Standard cron practice, but exposes installed software paths on shared hosts.
🔵 [simplicity] bin/lib/cron.mjs:121 — `catch (statusErr)` binds `statusErr` but doesn't use it; could use bare `catch {` (same at line 143)

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**