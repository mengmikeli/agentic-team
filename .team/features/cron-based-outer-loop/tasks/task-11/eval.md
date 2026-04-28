## Parallel Review Findings

🟡 [architect] `bin/lib/cron.mjs:182` — `process.argv[1]` is the sole source for the agt binary path in generated crontab; fragile if agt is invoked via wrapper/alias. Document assumption or resolve via `import.meta.url`.
🟡 [architect] `bin/lib/cron.mjs:186` — Log path uses string concatenation instead of `join()`, inconsistent with the rest of the module which imports and uses `join()`.
🟡 [engineer] `test/cron-tick.test.mjs:651` — Process monkey-patches (`process.cwd`, `process.argv[1]`) restored inline, not in `try/finally`. If `cmdCronSetup` throws, mocks leak. Wrap in try/finally.
🟡 [product] `tasks/task-11/handshake.json` — Missing `artifacts/test-output.txt` (process gap, not code gap; prior tasks all had one)
🟡 [tester] `test/cron-tick.test.mjs:650` — PATH variable quoting has no test coverage. The spaces test asserts 3 of 4 `quotePath` call sites but not `PATH=`. If someone removes the quoting from the PATH assignment, no test breaks.
🟡 [tester] `test/cron-tick.test.mjs:668` — Single-quote escape test is position-agnostic — checks the escape pattern appears *somewhere* rather than at each specific position (cd, agt, log). Weaker than the spaces test which asserts 3 positions individually.
🟡 [security] bin/lib/cron.mjs:185 — `quotePath` does not strip newlines from paths. A directory containing `\n` would split the generated crontab line into two entries, enabling injection of a second cron job. Fix: `p.replace(/[\n\r]/g, "")` before quoting. Probability is extremely low (requires attacker-created directory + user blindly pasting output).
🟡 [security] bin/lib/cron.mjs:159 — Error-path sanitization regex is a blocklist (`/Users`, `/home`, `/root`, etc.) that misses `/opt/`, `/srv/`, `/nix/`, and non-standard prefixes. Paths under those prefixes leak into GitHub comments. Inherited from prior reviews.
🔵 [architect] `test/cron-tick.test.mjs` — File name should reflect broadened scope (tests both `cmdCronTick` and `cmdCronSetup`); consider renaming to `cron.test.mjs`.
🔵 [architect] `bin/lib/cron.mjs:180` — NaN fallback for non-numeric `--interval` works but lacks an explicit test to document intent.
🔵 [architect] `bin/lib/cron.mjs:186` — Full `process.env.PATH` embedded in crontab line; could hit shell line limits on systems with long PATH.
🔵 [engineer] `bin/lib/cron.mjs:186` — Log path uses string concat instead of `join()`. Correct for shell output but inconsistent with rest of file.
🔵 [engineer] `bin/lib/cron.mjs:182` — `process.argv[1]` used without null guard. Vanishingly unlikely to be undefined in practice.
🔵 [product] `test/cron-tick.test.mjs:651-676` — Process monkey-patches restored inline, not in `try/finally`; low risk but fragile
🔵 [tester] `test/cron-tick.test.mjs:650` — Neither test mocks `process.env.PATH`, making tests non-deterministic if the system PATH contains special characters.
🔵 [tester] `test/cron-tick.test.mjs:603` — No test for shell metacharacters beyond spaces and quotes (`$`, backticks, `()`). Single quotes handle these by POSIX spec, but an explicit test would prevent accidental regression to double-quoting.
🔵 [security] bin/lib/cron.mjs:186 — Empty `PATH` produces `PATH=''` which silently breaks all commands in the cron job. Consider a warning.
🔵 [security] test/cron-tick.test.mjs — No test exercises `quotePath` with shell metacharacters like `$(whoami)` or backticks. Single-quoting provably prevents these, but a test would guard against accidental refactoring to double quotes.
🔵 [security] bin/lib/cron.mjs:186 — `cwd + "/.team/cron.log"` uses string concatenation instead of `path.join()`, inconsistent with the rest of the codebase.
🔵 [simplicity] `test/cron-tick.test.mjs:651-658,669-676` — Process monkey-patches (`process.cwd`, `process.argv[1]`) restored inline rather than in `try/finally`. Low risk but inconsistent with `cmdCronTick` tests that use `afterEach`.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**