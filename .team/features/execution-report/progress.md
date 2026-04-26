# Progress: execution-report

**Started:** 2026-04-26T01:35:58.012Z
**Tier:** functional
**Tasks:** 17

## Plan
1. `agt report <feature>` prints all required sections to stdout for a completed feature.
2. `agt report <feature> --output md` writes REPORT.md to the feature dir and prints a confirmation line; does NOT also print the full report to stdout.
3. Task Summary table includes a Title column populated from `task.title`.
4. What Shipped section lists passed-task titles; absent when no tasks passed.
5. Cost Breakdown shows `$X.XXXX` when `tokenUsage.total.costUsd` is present; shows `N/A` otherwise.
6. Cost Breakdown shows per-phase split from `tokenUsage.byPhase` when available.
7. Blocked / Failed section shows `lastReason` for each problem task; section absent when all tasks passed.
8. Recommendations fires for tasks with ≥ 3 attempts, gate warning history, all-blocked feature, and zero-pass gates.
9. `agt help report` exits 0 and includes "agt report", "--output", and "agt report my-feature".
10. `agt report` exits 1 with usage message when no feature name given.
11. `agt report no-such-feature` exits 1 with "not found" in output.
12. All existing `test/report.test.mjs` tests pass.
13. `buildReport` adds Title column to Task Summary table and emits What Shipped section for passed tasks.
14. Three new unit tests covering title column and What Shipped pass alongside all existing tests (`node --test test/report.test.mjs`).
15. `agt report <feature>` and `agt report <feature> --output md` work end-to-end against a real feature directory.
16. `agt help report` exits 0 with correct output (covered by existing integration test).
17. Feature marked completed in `.team/PRODUCT.md` completed list.

## Execution Log

### 2026-04-26 01:44:26
**Task 1: `agt report <feature>` prints all required sections to stdout for a completed feature.**
- Verdict: 🟡 Review FAIL (attempt 1)
- Will retry with review feedback

### 2026-04-26 01:52:56
**Task 1: `agt report <feature>` prints all required sections to stdout for a completed feature.**
- Verdict: 🟡 Review FAIL (attempt 2)
- Will retry with review feedback

