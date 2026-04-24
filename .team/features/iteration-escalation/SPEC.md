# Feature: Iteration Escalation

## Goal
When the same compound-gate warning layers recur across ≥2 review iterations on a single task, auto-escalate to a hard FAIL instead of retrying — breaking infinite shallow-fix loops.

## Scope
- Track which compound-gate layers tripped per review attempt on each task, stored as `gateWarningHistory` on the task entry in `STATE.json`
- After each review that produces a WARN verdict, record the tripped layer names against the current attempt number
- Before permitting a retry: check if any layer name appears in the `gateWarningHistory` of a prior iteration for this same task
- If overlap found (same layer in ≥2 distinct iterations): override the verdict to FAIL, inject a synthetic critical finding `🔴 iteration-escalation — Persistent eval warning: {layers} recurred in iterations {n1}, {n2}`, and mark the task blocked — no further retries
- Log the escalation event to `progress.md` with reason and iteration numbers
- Unit tests covering:
  - Same layer tripped in iterations 1 and 2 → escalates to FAIL
  - Different layers each iteration → no escalation, normal retry
  - Layer tripped in iteration 1 only (single occurrence) → no escalation
  - Escalation on iteration 3 when layer first appeared in iteration 1 (non-consecutive recurrence)
- Integration test: full task loop with a synthetic eval.md that consistently trips `thin-content` across two attempts → task is escalated and blocked, not retried indefinitely

## Out of Scope
- Escalating based on FAIL verdicts (those already terminate the retry path)
- Tracking compound-gate history across different tasks
- Escalation based on backlog warnings (separate from compound-gate layer warnings)
- Changing the WARN→FAIL threshold (≥2 iterations is fixed, not configurable)
- Any UI or dashboard changes
- Human notification or GitHub issue creation on escalation

## Done When
- [ ] `STATE.json` task entries include a `gateWarningHistory` array (`[{iteration: N, layers: [...]}]`) written after each WARN verdict
- [ ] When the same compound-gate layer name appears in `gateWarningHistory` for ≥2 distinct iterations, the task is marked `blocked` with a synthetic critical finding naming the repeated layers and iteration numbers
- [ ] A retried task that received the same WARN layer twice is never retried a third time
- [ ] A task with different WARN layers in each iteration is still retried normally up to the existing retry limit
- [ ] The escalation event appears in `progress.md`
- [ ] All unit tests described in Scope pass
- [ ] The integration test described in Scope passes
- [ ] All existing tests continue to pass
