# Progress: finalize-auto-close-validation

**Started:** 2026-04-24T03:18:11.251Z
**Tier:** functional
**Tasks:** 7

## Plan
1. Test: `agt finalize` on a feature with 2 task issues returns `issuesClosed: 2` in JSON output
2. Test: each closed task issue receives the correct comment (`"Task completed — gate passed."` for passed, status-specific for skipped)
3. Test: `finalize` also closes `state.approvalIssueNumber` when present, and `issuesClosed` reflects it
4. Test: tasks without `issueNumber` are skipped silently and do not affect the count
5. Test: calling `finalize` on an already-completed feature does not re-close issues
6. Implementation: `finalize.mjs` closes `state.approvalIssueNumber` in addition to task issues
7. All existing finalize tests continue to pass

## Execution Log

### 2026-04-24 03:28:50
**Task 1: Test: `agt finalize` on a feature with 2 task issues returns `issuesClosed: 2` in JSON output**
- Verdict: ✅ PASS (attempt 1)
- Gate: `npm test` — exit 0

### 2026-04-24 03:36:02
**Task 2: Test: each closed task issue receives the correct comment (`"Task completed — gate passed."` for passed, status-specific for skipped)**
- Verdict: ✅ PASS (attempt 1)
- Gate: `npm test` — exit 0

