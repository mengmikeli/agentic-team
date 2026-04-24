## Parallel Review Findings

🟡 [architect] `bin/lib/finalize.mjs:116` — `readTrackingConfig()` is called unconditionally but `projMatch` is computed and never acted on; remove the block until project-board integration is actually implemented, to avoid phantom I/O on every finalize
[architect] The `🟡` on `finalize.mjs:116` is the most notable architectural concern: dead/incomplete project-board integration code that pays I/O cost on every finalize while delivering nothing. Goes to backlog.
🟡 [engineer] `bin/lib/finalize.mjs:115` — `state.approvalIssueNumber` is never closed; SPEC items 3 and 6 require it — add `// TODO: task-6 — close approvalIssueNumber here` so the gap is visible in source before that task ships
🟡 [engineer] `bin/lib/finalize.mjs:128` — `issuesClosed++` fires unconditionally inside try; a silent `gh` failure still increments the count — change to `if (closeIssue(task.issueNumber, comment)) issuesClosed++`
🟡 [product] bin/lib/finalize.mjs:123 — `closeIssue` return value discarded; `issuesClosed` inflates on `gh` failure, misleading callers about actual close count — fix: `if (closeIssue(task.issueNumber, comment)) issuesClosed++`
🟡 [product] bin/lib/finalize.mjs:124 — Dead no-op block (`projMatch` computed, nothing called); implies project-board integration that doesn't exist — remove or complete before release
🟡 [tester] `bin/lib/finalize.mjs:123` — `closeIssue` return value is discarded; `issuesClosed` increments even when close fails — change to `if (closeIssue(task.issueNumber, comment)) issuesClosed++`
🟡 [tester] `bin/lib/finalize.mjs:124` — Dead code block: `projMatch` computed but never used; project board "done" status promised in comment is never set — either remove the block or call `setProjectItemStatus`
🟡 [security] `test/harness.test.mjs:279` — Fake `gh` stub accepts all invocations silently; test asserts count only, not which issues were targeted — replace with a capturing stub that logs `$@` to a temp file and assert on the invocation log
🟡 [security] `bin/lib/finalize.mjs:58` — `_write_nonce` tamper check tests presence only (`!state._write_nonce`), not authenticity; combined with the plain-string `_written_by` check, tamper detection is bypassable by anyone with filesystem write access — pre-existing; backlog to add HMAC-signed state writes
[security] - The `issuesClosed` counter increments unconditionally regardless of whether `closeIssue` returns true — already flagged as 🟡 by the Tester review; the security implication is that the JSON output is a misleading audit signal under failure
🟡 [simplicity] `bin/lib/finalize.mjs:124` — Dead code: `projMatch` computed but never used; `if (tracking)` block is a no-op that falsely implies project-board update occurs; remove or implement
🔵 [architect] `test/harness.test.mjs:279` — Stub `gh` script does not record call arguments; a capturing stub (`write $@ to a temp file`) would let the test assert the correct issue numbers are targeted, not just the count
🔵 [architect] `bin/lib/finalize.mjs:129` — Silent `catch` is appropriate for best-effort semantics, but adding `issueCloseFailed` to the output JSON would make partial failures observable to callers
🔵 [engineer] `test/harness.test.mjs:279` — Stub records no call arguments; cannot assert which issue numbers or comment strings were dispatched to `gh issue close`
🔵 [product] test/harness.test.mjs:279 — `gh` stub does not record which issue numbers were targeted; a capturing stub would protect against regressions in argument correctness
🔵 [tester] `test/harness.test.mjs:277` — Missing test for `gh` exit non-zero → `issuesClosed` should be 0, but the discarded return value means it would report 2 — add a failure-path test to catch the regression
🔵 [tester] `test/harness.test.mjs:277` — No assertion on the comment text passed to `closeIssue`; a capturing stub would guard against silent regressions
🔵 [security] `bin/lib/finalize.mjs:124` — Dead block: `readTrackingConfig()` I/O paid and `projMatch` computed on every finalize, but no action taken; misleading comment implies project-board update happens — remove until implementation is complete (also flagged by Tester/Architect/Simplicity)
🔵 [simplicity] `test/harness.test.mjs:308` — Duplicates `harnessJSON` last-line JSON parsing; extend `harnessJSON` to accept optional `{ env }` to allow reuse and remove the raw `execFileSync` call
🔵 [simplicity] `test/harness.test.mjs:278` — `mkdtempSync` / `tmpdir` used at line 278 but imported at lines 364–365; move to the top-of-file import block

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs