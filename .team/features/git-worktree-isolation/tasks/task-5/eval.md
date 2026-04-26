## Parallel Review Findings

🟡 [architect] bin/lib/run.mjs:163-172 — Reuse is presence-only; "preserved worktree" is implicit state. Add a marker file on the catch path so reuse is intentional, not incidental.
🟡 [architect] bin/lib/run.mjs:1487-1492 — Oscillation `break` falls through to `removeWorktree`, destroying state on the exact failure mode an operator would want to inspect. Throw instead, or skip teardown when `blocked >= 3`.
🟡 [product] test/worktree.test.mjs:355 — Source-regex assertions are brittle to refactors; add a behavioral test that stubs the run loop to throw and asserts the worktree dir still exists afterward. Backlog.
🟡 [tester] test/worktree.test.mjs:355 — Add behavioral integration test: drive `_runSingleFeature` to throw and assert worktree dir still exists on disk; current tests are source-regex assertions only.
🟡 [tester] test/worktree.test.mjs:355 — No positive assertion that success path calls `removeWorktree`; deleting line 1530 would not be caught.
🟡 [security] bin/lib/run.mjs:166 — Reuse path uses bare `existsSync`; validate the directory is actually a git worktree before adopting it on retry.
🟡 [simplicity] test/worktree.test.mjs:355-372 — Two new tests assert source-code shape via regex instead of behavior; brittle to refactors. Replace with a behavioral test that throws mid-run and asserts worktree dir still exists. Backlog.
🔵 [architect] bin/lib/run.mjs:1022 — Long try body with no early returns; a future `return` would leak the worktree. Add a one-line "do not early-return" comment.
🔵 [architect] bin/lib/run.mjs:1521-1523 — Success comment is placed above the `} catch`, not next to the actual call at L1530.
🔵 [architect] test/worktree.test.mjs:355-371 — Two of three new tests are source-regex tripwires; a behavioural test injecting a throwing dispatch into `_runSingleFeature` would survive refactors.
🔵 [engineer] bin/lib/run.mjs:1521 — Move "Remove worktree now that execution completed successfully" comment next to the actual call at line 1530; it currently sits above the catch.
🔵 [engineer] test/worktree.test.mjs:362 — Source-regex test is global; will misfire if any unrelated `finally { removeWorktree(...) }` is added later. Scope to `_runSingleFeature` or assert behaviorally.
🔵 [engineer] test/worktree.test.mjs:371 — Couples to log substring "preserving worktree"; prefer a behavioral test that invokes `_runSingleFeature` with a throwing mock and asserts `removeWorktree` was not called.
🔵 [product] bin/lib/run.mjs:1526 — Consider including a next-step hint ("re-run `agt run <feature>` to resume") in the preservation message.
🔵 [tester] bin/lib/run.mjs:1530 — `removeWorktree` is outside try/catch; if any code between try-end and line 1530 throws, worktree leaks. Currently safe because git-push/finalize are wrapped, but the invariant is implicit.
🔵 [tester] test/worktree.test.mjs:366-373 — Regex tightly couples test to log wording ("preserving worktree"); prefer behavioral assertion.
🔵 [security] bin/lib/run.mjs:164 — Pre-existing: raw `slug` is used in the worktree path while the branch name is sanitized via `slugToBranch`; apply the same sanitizer to the path. Reuse-on-retry amplifies the impact.
🔵 [security] bin/lib/run.mjs:1526 — Include `err.message` in the preservation log so operators can correlate which failure left the worktree behind.
🔵 [simplicity] bin/lib/run.mjs:1521-1523 — Comment could be one line; optional.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**