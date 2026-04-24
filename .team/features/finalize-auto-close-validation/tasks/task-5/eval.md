## Parallel Review Findings

🟡 [architect] `bin/lib/finalize.mjs:9` — `setProjectItemStatus` imported but never called; remove the unused import or implement the board-status update it was introduced to support (pre-existing from task-3/task-4 reviews, unresolved — must go to backlog)
🟡 [architect] `bin/lib/finalize.mjs:124` — `projMatch` computed and immediately discarded; the entire `if (tracking)` block is dead code implying an incomplete board-status update; delete or implement (pre-existing from task-3/task-4, unresolved — must go to backlog)
🟡 [architect] `bin/lib/finalize.mjs:118` — No `Number.isInteger(task.issueNumber)` guard; a crafted STATE.json with a string value passes the truthy check and silently reaches `gh issue close` (pre-existing from task-3, unresolved — must go to backlog)
🟡 [architect] `bin/lib/finalize.mjs:128` — `issuesClosed++` fires unconditionally regardless of `closeIssue`'s return value; count inflates silently on `gh` failure (pre-existing from task-4, unresolved — must go to backlog)
[architect] The four 🟡 warnings are pre-existing debt carried forward from task-3 and task-4 reviews. They are not introduced by this task but must be added to backlog.
🟡 [engineer] `bin/lib/finalize.mjs:125` — `projMatch` assigned but never read; dead code implies unfinished board-status update; remove assignment or implement the intended call
🟡 [product] `test/harness.test.mjs:547` — `result.note === "already finalized"` asserts an undocumented API contract not in SPEC.md; if consumers parse finalize JSON they will depend on this field — document the `note` field in finalize's JSON contract → add to backlog
[product] The one 🟡 is a documentation gap — undocumented API contract on the `note` field. Not a correctness gap. The implementation guard at `finalize.mjs:26–33` is minimal and correct. Recommend merge.
🟡 [tester] `test/harness.test.mjs:547` — `result.issuesClosed` absence not asserted; add `assert.equal(result.issuesClosed, undefined)` to lock in that the early-return path never counts or attempts to close issues
🟡 [tester] `bin/lib/finalize.mjs:26` — Post-lock completed guard at line 82 has zero test coverage; the TOCTOU race scenario (two concurrent `finalize` calls) is real but untested — add a backlog item to cover with a fixture that pre-populates `status: "completed"` only in the re-read to exercise line 82
[tester] The two 🟡 items (missing `issuesClosed === undefined` assertion, untested post-lock double-check path) are test-quality gaps that belong in the backlog. Neither represents a production safety hole — `closeIssue` has its own null-guard as a backstop, and the post-lock path is behaviorally identical to the pre-lock path.
🟡 [security] `bin/lib/finalize.mjs:118` — `task.issueNumber` has no integer type guard; a crafted STATE.json with `issueNumber: "bad"` passes the truthy check and silently reaches `gh issue close "bad"` — add `Number.isInteger(task.issueNumber)` guard (pre-existing, unresolved from task-3 and task-4 reviews)
🟡 [security] `bin/lib/finalize.mjs:128` — `issuesClosed++` fires unconditionally regardless of `closeIssue` return value; count inflates when `gh` fails — change to `if (closeIssue(...)) issuesClosed++` (pre-existing, unresolved from task-3 and task-4 reviews)
🟡 [security] `bin/lib/finalize.mjs:21` — STATE.json tamper detection relies on the string field `_written_by` with no cryptographic backing; a filesystem-write-capable actor can set `status: "completed"` to trigger the idempotency early-exit without legitimate prior finalization (pre-existing structural constraint — `approval.json` uses HMAC; STATE.json does not)
[security] The core implementation is correct and secure for its threat model. The idempotency guard at `finalize.mjs:26` is ordered after tamper detection (line 21) and duplicated post-lock (line 82) for TOCTOU safety. The test uses a capturing `gh` stub (`echo "$@" >> logfile`) and asserts zero invocations — stronger evidence than non-capturing stubs used in prior tasks in this series. The fixture includes both `issueNumber: 601` and `approvalIssueNumber: 700`, covering both close paths. All three 🟡 findings are pre-existing debt, none introduced by this change.
🟡 [simplicity] `bin/lib/finalize.mjs:124-127` — Dead code: `projMatch` is computed but never used; `if (tracking)` block contains only this dead variable and a comment implying project-board updates happen. Delete the block or implement it.
🔵 [architect] `test/harness.test.mjs:517` — `featureDir` for `already-done-test` is never cleaned up in `finally`; unlike `fakeBinDir` (line 552) it persists in `testDir` across the test run
🔵 [architect] `test/harness.test.mjs:508` — No assertion that `STATE.json` was not mutated (e.g., `completedAt` unchanged) during the idempotent call; adding it would fully lock in the "no file modification" contract
🔵 [engineer] `test/harness.test.mjs:546` — test does not assert `result.issuesClosed === undefined`; a future regression adding `issuesClosed: 0` to the already-finalized response would go undetected; add an explicit assertion
🔵 [product] `test/harness.test.mjs:519` — Fixture includes `approvalIssueNumber: 700` but the no-gh-calls assertion covers it implicitly; a variant without `approvalIssueNumber` would confirm the guard works for task-only features too
🔵 [product] `.team/features/finalize-auto-close-validation/tasks/task-[1-4]/handshake.json` — All 4 review tasks trip `fabricated-refs` compound gate (WARN); recurring pattern — investigate whether reviewer eval.md files are citing paths that don't resolve at gate-check time
🔵 [tester] `test/harness.test.mjs:508` — Tamper-then-complete path (tamper check at line 21 fires before completed check at line 26) is untested; a corrupt-but-completed STATE.json returns an error, not "already finalized" — document this ordering in the tamper-detection suite
🔵 [tester] `test/harness.test.mjs:519` — Fixture includes `approvalIssueNumber: 700` correctly modeling a real completed state; add a comment explaining its purpose to prevent accidental removal during future fixture cleanup
🔵 [security] `bin/lib/finalize.mjs:124` — Dead code: `readTrackingConfig()` is called and `projMatch` computed but never used; remove or complete the block to avoid misleading future reviewers about project board status being updated on finalize
🔵 [simplicity] `bin/lib/finalize.mjs:82` — Duplicate `status === "completed"` guard inside the lock has no comment explaining the double-check. Add `// Re-check after acquiring lock — concurrent finalize may have completed first` to prevent readers from mistaking it for redundancy.

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs