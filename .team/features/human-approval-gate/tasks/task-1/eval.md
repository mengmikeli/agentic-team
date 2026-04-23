## Parallel Review Findings

### [security]
---

## Security Review: human-approval-gate / task-1

**Verdict: ITERATE**

Files I actually read: `bin/lib/outer-loop.mjs`, `bin/lib/github.mjs`, `bin/lib/util.mjs`, `test/outer-loop.test.mjs`, `test/harness.test.mjs` (github section), all task artifacts.

The approval gate code **was implemented** (the prior eval.md was stale from an earlier iteration). The logic is largely correct: `createApprovalIssue` writes to STATE.json atomically, the re-entry guard is in place, and polling is wired up.

### [architect]
## Findings

🔴 `bin/lib/outer-loop.mjs:64` — `createApprovalIssue` writes a minimal STATE.json with no `status` field; `_runSingleFeature` later patches `status: "executing"` onto it (`run.mjs:815`), causing `applyCrashRecovery` (`run.mjs:499`) to falsely trigger crash recovery on every first run of an approval-gated feature — skips `initProgressLog`, corrupts `_recovery_count`, prints false "Resuming from crashed state" message; fix: store approval fields in a separate `approval.json` sidecar 

### [devil's-advocate]
---

**Verdict: ITERATE**

The gate logic itself is implemented and mostly correct. What's broken is the test layer, and two Done When criteria are unmet.

---

**Findings:**

🔴 `test/outer-loop.test.mjs:516` — Existing `outerLoop` tests hang indefinitely when `gh` is authenticated; `mockDeps` omits `createIssue`/`getProjectItemStatus` so real GitHub calls fire; test passes in CI only because `gh` is unavailable there; inject mocks for all approval-gate deps in every `outerLoop` test

🔴 `test/