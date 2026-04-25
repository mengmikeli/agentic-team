# Progress: max-review-rounds-escalation

**Started:** 2026-04-25T00:14:31.143Z
**Tier:** functional
**Tasks:** 17

## Plan
1. After exactly 3 review FAILs on a task, `task.status` becomes `"blocked"` and `task.lastReason` is `"review-escalation: 3 rounds exceeded"`.
2. After 1 or 2 review FAILs the task is NOT blocked — retry continues normally.
3. A GitHub issue comment is posted containing the task title, round count, and deduplicated findings table on escalation.
4. Findings that appear in multiple rounds appear only once in the comment table.
5. A progress.md entry `🔴 Review-round escalation: blocked after 3 review FAIL round(s)` is written on escalation.
6. Escalation does NOT fire on build fails or compound-gate fails — only on review verdict FAIL.
7. Missing or malformed `handshake-round-N.json` files do not crash escalation; comment still posts with available data.
8. `reviewRounds` is persisted to STATE.json after each increment so a crash-restart resumes the correct count.
9. Both single-review (`flow.phases.includes("review")`) and multi-review (`flow.phases.includes("multi-review")`) paths trigger escalation.
10. `bin/lib/review-escalation.mjs` exists with all five exports (`MAX_REVIEW_ROUNDS`, `incrementReviewRounds`, `shouldEscalate`, `deduplicateFindings`, `buildEscalationComment`, `buildEscalationSummary`).
11. `test/review-escalation.test.mjs` passes with full coverage of all exported functions and the integration scenario.
12. `bin/lib/run.mjs` calls `incrementReviewRounds` + `shouldEscalate` in both single-review and multi-review paths, triggers escalation on round 3, and breaks the retry loop.
13. `reviewRounds` is written to STATE.json after each increment via the atomic state-write path.
14. Per-round `handshake-round-{N}.json` is written to the task artifact directory on each review FAIL.
15. On escalation, a GitHub comment is posted with the deduplicated findings table (verified by test stub or manual run).
16. `progress.md` receives the `🔴 Review-round escalation` line on escalation.
17. All existing tests continue to pass (`npm test` green).

## Execution Log

