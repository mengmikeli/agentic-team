# Progress: max-review-rounds-escalation

**Started:** 2026-04-24T04:55:17.164Z
**Tier:** functional
**Tasks:** 9

## Plan
1. `task.reviewRounds` field exists in STATE.json and increments by 1 each time a review phase produces a FAIL verdict (critical findings > 0 or compound gate FAIL).
2. When `task.reviewRounds` reaches 3, the task is immediately blocked (no further retry attempts) with `lastReason = "review-escalation: 3 rounds exceeded"`.
3. A GitHub comment is posted to the task's linked issue containing: task title, rounds attempted, and deduplicated critical findings from each round's handshake.json.
4. If no GitHub issue is linked, escalation is logged to `progress.md` only (no crash or unhandled error).
5. `progress.md` receives a dated escalation entry for every task that hits the cap.
6. Existing behavior is unchanged when `reviewRounds < 3` — tasks still retry normally up to the attempt budget.
7. Tick-limit enforcement, oscillation detection, and iteration-escalation all continue to fire independently (no regression).
8. Unit tests cover: counter increment on review FAIL, no increment on build/gate FAIL, block fires at round 3, summary generation with deduplication.
9. Integration test: a task that FAILs review 3 times ends up blocked with correct `lastReason` and a GitHub comment (or progress.md fallback) containing findings from all 3 rounds.

## Execution Log

### 2026-04-24 05:07:19
**Task 1: `task.reviewRounds` field exists in STATE.json and increments by 1 each time a review phase produces a FAIL verdict (critical findings > 0 or compound gate FAIL).**
- Verdict: 🟡 Review FAIL (attempt 1)
- Will retry with review feedback

