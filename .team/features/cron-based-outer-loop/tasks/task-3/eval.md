## Parallel Review Findings

[architect] The feature is correctly implemented. The prior 🔴 dead guard (`if (lock.release)`) is **already fixed** in the current codebase — `cron.mjs:119` reads `lock.release();` with no conditional. Commit `c43016a` applied the fix. Prior eval entries claiming it was "unfixed" were reviewing intermediate code.
[engineer] The prior blocking 🔴 (`if (lock.release)` dead guard at `cron.mjs:119`) is **fixed** — commit `c43016a` removed it; line 119 now reads bare `lock.release()`. The specific task feature (revert to "Ready" + GitHub comment on failure) is correctly implemented at lines 112–117 and covered by test #4.
[product] **Core requirement met.** `cron.mjs:114–115` reverts to "ready" and posts an error comment in the `catch` block. All 7 `cmdCronTick` tests pass (test-output.txt lines 240–247). The prior 🔴 blocker — dead guard `if (lock.release)` — is confirmed resolved: line 119 now reads `lock.release();` (commit `c43016a`).
[security] **Dead guard `if (lock.release)` — RESOLVED.** `cron.mjs:119` now reads `lock.release()` unconditionally. Commit `c43016a` removed the dead guard that was the prior Simplicity 🔴 blocker.
[simplicity] The prior 🔴 (`if (lock.release)` dead guard at `cron.mjs:119`) is confirmed resolved in commit `c43016a`. Line 119 now reads `lock.release();` — unconditionally. No new veto-category violations.
[simplicity] - Prior 🔴 confirmed fixed by direct file read (`cron.mjs:119 = lock.release()`)
🟡 [architect] bin/lib/cron.mjs:108 — No timeout on `_runSingleFeature`: a hung agent holds `.team/.cron-lock` indefinitely; all subsequent cron-tick invocations exit 0 silently with "already running"; add a configurable wall-clock timeout (`AGT_RUN_TIMEOUT`, default 30 min) that releases the lock, reverts the board item, and posts a timeout comment
🟡 [architect] bin/lib/cron.mjs:114 — `_setProjectItemStatus` return discarded on failure revert; a `false` return leaves the item permanently stuck in "in-progress" and silently dropped from all future runs (line 89 filters for "ready" only); log a warning on `false` return
🟡 [architect] bin/lib/cron.mjs:115 — `_commentIssue` called inside `catch(err)` with no inner try/catch; if it throws (network/auth), the exception escapes the catch block and propagates out of `cmdCronTick` (lock IS released via `finally`, but function throws instead of returning cleanly); wrap in try/catch and log on failure
🟡 [architect] bin/lib/cron.mjs:20 — Duplicate PROJECT.md parsers: `readProjectNumber` (line 26) and `readTrackingConfig` (via `github.mjs`) each independently parse the same file; a format change silently breaks one without the other; consolidate into a single reader
🟡 [engineer] `bin/lib/cron.mjs:114` — `_setProjectItemStatus` return value discarded on failure-revert path; `false` return leaves board item permanently stuck in "in-progress", silently dropped from all future runs (line 89 filters `status === "ready"` only); log a warning on `false`
🟡 [engineer] `bin/lib/cron.mjs:115` — `_commentIssue` throw is unhandled inside the catch block; a missing `gh` binary causes ENOENT from `spawnSync` that escapes the catch and rejects `cmdCronTick` instead of exiting cleanly; wrap in try/catch, log and swallow
🟡 [engineer] `bin/lib/cron.mjs:116` — Raw `err.message` posted verbatim to public GitHub comment; ENOENT and auth errors expose absolute local paths; sanitize before posting: `err.message.replace(/\/[^\s:'"]+/g, "<path>").slice(0, 300)`
🟡 [engineer] `test/cron-tick.test.mjs:184` — Failure-path ordering not enforced; `.some()` accepts "ready" recorded before "in-progress"; mirror the `findIndex`-based assertion from test #3 at lines 153–157 (`inProgressIdx < readyIdx`)
🟡 [engineer] `test/cron-tick.test.mjs:125` — "First item only" contract incompletely tested; `runCalled` is boolean not a count; no assertion that issue #8 transitions do NOT appear in `statusTransitions`
🟡 [product] `test/cron-tick.test.mjs:184` — Failure path ordering not enforced; `.some()` passes even if "ready" is recorded before "in-progress" or "in-progress" is skipped; apply `findIndex`-based ordering (`inProgressIdx < readyIdx`) mirroring the success-path assertion at lines 153–157
🟡 [product] `bin/lib/cron.mjs:114` — `_setProjectItemStatus` return discarded on failure revert; a `false` return leaves the board item permanently stuck in "in-progress" and silently out of the queue (line 89 filters `status === "ready"` only); log a warning at minimum
🟡 [product] `bin/lib/cron.mjs:115` — Raw `err.message` posted verbatim to public GitHub issue comment; ENOENT errors expose local absolute paths; strip paths and truncate to ≤300 chars before posting
🟡 [product] `test/cron-tick.test.mjs:125` — "First item only" contract not fully enforced; `runCalled` is boolean, not a count; no assertion that issue #8 transitions were NOT recorded; add call-count assertion and verify zero entries for issueNumber 8
[product] Four 🟡 backlog items filed above. None block merge. The implementation is shippable.
🟡 [tester] `test/cron-tick.test.mjs:184` — Failure-path ordering unverified; both "in-progress" and "ready" use `.some()`, so reversed ordering passes silently; mirror the `findIndex`-based ordering assertion from test #3 (lines 153–157)
🟡 [tester] `test/cron-tick.test.mjs:125` — First-item-only contract incomplete; `runCalled` is boolean not a count, and no assertion that issue #8 transitions never appear in `statusTransitions`; add call-count assertion and `assert.ok(statusTransitions.every(t => t.issueNumber !== 8))`
🟡 [tester] `bin/lib/cron.mjs:115` — `_commentIssue` throw unhandled and untested; if it throws (network/auth failure), exception escapes the `catch(err)` block and `cmdCronTick` itself throws; add a test where `commentIssue` throws and assert the function exits cleanly
🟡 [security] bin/lib/cron.mjs:115 — Raw `err.message` posted verbatim to public GitHub issue comment; ENOENT and `gh` auth errors expose local absolute paths and internal state; strip paths with `.replace(/\/[^\s:'"]+/g, "<path>")` and truncate to ≤300 chars before posting.
🟡 [simplicity] test/cron-tick.test.mjs:67 — Dead test setup (carried): `writeProjectMd(teamDir)` at lines 67, 96, 126, 163 writes PROJECT.md in 4 tests where both `readTrackingConfig` and `readProjectNumber` are mocked via `deps`; the file is created, never read, and deleted; remove to eliminate false signal that file content matters
🟡 [simplicity] test/cron-tick.test.mjs:184 — Ordering gap (carried): `.some()` used for both "in-progress" and "ready" assertions; reversed order or skipped "in-progress" passes silently; apply `findIndex`-based ordering assertion matching test #3 (lines 153–157)
[simplicity] - Two 🟡 items are carried from the prior review and go to backlog; neither is new code from this iteration
🔵 [architect] bin/lib/cron.mjs:89 — No `?? []` guard before `.filter()`; a null return from `_listProjectItems` throws an uncontextual TypeError; change to `(items ?? []).filter(...)`
🔵 [architect] test/cron-tick.test.mjs:184 — Failure-path ordering unverified: both "in-progress" and "ready" assertions use `.some()`; mirror test #3's `findIndex` approach (`inProgressIdx < readyIdx`)
🔵 [engineer] `bin/lib/cron.mjs:89` — No `?? []` guard before `.filter()`; null return from `_listProjectItems` throws uncontextual TypeError
🔵 [engineer] `bin/lib/cron.mjs:105` — `_setProjectItemStatus` return discarded on "in-progress" pre-execution transition; silent false goes unlogged
🔵 [engineer] `bin/lib/cron.mjs:110` — `_setProjectItemStatus` return discarded on "done" transition; silent false goes unlogged
🔵 [tester] `test/cron-tick.test.mjs:67` — Dead test setup: `writeProjectMd(teamDir)` called in tests 1–4 but both `readProjectNumber` and `readTrackingConfig` are mocked; file is never read; remove to eliminate false signal
🔵 [tester] `bin/lib/cron.mjs:89` — No null guard before `.filter()`; `_listProjectItems` returning `null` throws an uncontextual TypeError; add `(items ?? []).filter(...)` and a test for null return
🔵 [security] bin/lib/cron.mjs:100 — Title sanitization omits Unicode bidi overrides (U+202A–U+202E, U+2066–U+2069); minor terminal-display spoofing risk; extend regex if terminal integrity matters.
🔵 [simplicity] bin/lib/cron.mjs:39 — Stale JSDoc: `@param args` says "(unused for now)" but `args` is forwarded to `_runSingleFeature` at line 108; remove the parenthetical

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs
🔴 iteration-escalation — Persistent eval warning: fabricated-refs recurred in iterations 1, 2

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs