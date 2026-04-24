## Parallel Review Findings

🟡 [architect] `bin/lib/run.mjs:1311` — `escalationFired` (iteration-escalation) branch also blocks tasks but does NOT call `markChecklistItemBlocked`; both `shouldEscalate` and `escalationFired` produce a `blocked` status, but only one updates the parent checklist; add the same `getIssueBody`/`markChecklistItemBlocked`/`editIssue` block to the `escalationFired` branch for consistent parent-issue UI
🟡 [architect] `test/parent-checklist.test.mjs:94` — no integration test verifies the `shouldEscalate → getIssueBody → markChecklistItemBlocked → editIssue` chain in `run.mjs`; unit tests cover the pure function only; add a test that mocks `getIssueBody`/`editIssue` and confirms they are invoked on escalation
🟡 [engineer] `bin/lib/run.mjs:1299` — `if (parentBody)` coerces `""` (successful empty-body response) to falsy; blocked marker silently skipped on empty issue body; use `if (parentBody !== null)` to match the `getIssueBody` return contract (same pattern as unfixed backlog item at line 1356)
🟡 [engineer] `bin/lib/run.mjs:1301` — `editIssue(...)` return value discarded; gh CLI failure during blocked-marker write is invisible; check return and log a warning on `false` (same pattern as unfixed backlog item at line 1359)
[engineer] Both 🟡 warnings are carryovers from the prior backlog — they follow the exact same pattern as the existing `tickChecklistItem` call site. Neither is a new regression.
🟡 [product] `test/review-escalation.test.mjs:243` — Integration test does not verify that `getIssueBody`/`markChecklistItemBlocked`/`editIssue` are called when escalation fires; add a mocked test asserting `editIssue` is invoked with the blocked body after MAX_REVIEW_ROUNDS FAILs
🟡 [product] `bin/lib/run.mjs:1301` — `editIssue(...)` return value discarded; a GitHub API failure when writing the blocked marker leaves the parent checklist unchanged with no warning; log `⚠ Could not mark checklist item blocked for task #N` on false return (pre-existing pattern)
[product] Two 🟡 warnings go to backlog. Both are pre-existing patterns in this feature (the same gaps were flagged for the `tickChecklistItem` path in prior rounds). No criticals.
🟡 [tester] test/review-escalation.test.mjs:244 — Integration tests only check state transitions; add a mocked test asserting `getIssueBody` and `editIssue` are called with the blocked body when `shouldEscalate` fires (run.mjs:1297–1302)
🟡 [tester] bin/lib/run.mjs:1311 — Iteration-escalation block path skips `markChecklistItemBlocked`; parent checklist stays `- [ ] title (#N)` (unchecked) after iteration escalation; document as known limitation or add call mirroring run.mjs:1297–1302
🟡 [tester] bin/lib/run.mjs:1299 — `if (parentBody)` silently drops the blocked-marker update when `getIssueBody` returns null; add a warning log (matches existing `⚠` warning style in codebase)
🟡 [simplicity] `bin/lib/github.mjs:156` — `markChecklistItemBlocked` duplicates the guard, escape, and regex pattern from `tickChecklistItem` (lines 141-149); extract a shared `replaceChecklistItem(body, title, issueNumber, replacement)` helper so a format change only touches one place
🔵 [architect] `bin/lib/github.mjs:161` — regex not anchored to start of line (missing `^` with multiline flag `m`); could match mid-line in blockquote-style body content; add `RegExp(\`...\`, 'm')` with `^` prefix for robustness
🔵 [architect] `bin/lib/github.mjs:161` — `issueNumber` interpolated into regex without explicit integer coercion; add `parseInt(issueNumber, 10)` to make the numeric contract explicit and guard against string callers
🔵 [engineer] `test/parent-checklist.test.mjs` — no test covers title with regex-special chars (e.g., `"Fix (v2.0)"`) in `markChecklistItemBlocked`; add a case verifying the escaping at `github.mjs:158` handles these correctly
🔵 [tester] test/parent-checklist.test.mjs:97 — No test for title containing regex-special chars (e.g., `"Fix (v2.0)"`); add case verifying `github.mjs:158` escaping handles these
🔵 [tester] test/parent-checklist.test.mjs:117 — Already-blocked idempotency unverified; add case calling `markChecklistItemBlocked` on a body already in blocked format
🔵 [security] `bin/lib/run.mjs:1299` — `if (parentBody)` silently skips the blocked marker on an empty issue body (`""`) due to falsy coercion; use `if (parentBody !== null)` — reliability gap only, no security consequence
🔵 [security] `bin/lib/run.mjs:1311-1317` — iteration escalation (`escalationFired`) path does not call `markChecklistItemBlocked`; parent checklist silently shows iteration-blocked tasks as unchecked — operator-visible inconsistency, no security consequence
🔵 [simplicity] `test/review-escalation.test.mjs:243` — the "3 consecutive review FAILs → task blocked" integration test simulates escalation in-memory but never calls `getIssueBody` / `markChecklistItemBlocked` / `editIssue`; add a test with a mock `editIssue` to verify the blocked marker reaches the parent issue body when `approvalIssueNumber` is set

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs