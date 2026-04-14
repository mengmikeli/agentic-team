# Failure Handling

Failures are **contained**, not escalated. The loop always terminates.

## Task Failure (during orchestrate)

| Attempt | Action |
|---------|--------|
| 1 | Dispatch with original brief |
| 2 | Tighten brief — include failure output, narrow scope, add hints |
| 3 | Reduce to minimum viable change |
| 4+ | Mark **blocked**, record reason, skip to next task |

**Never stall.** A blocked task doesn't block the sprint. Other tasks continue. The completion report lists what's blocked and why. The operator decides whether to accept or fix in a follow-up sprint.

**Never escalate mid-loop.** The coordinator does not pause execution to ask the operator for guidance. The loop runs to completion or exhaustion, then presents results.

## Consecutive Failures

If 3+ tasks fail consecutively, orchestrate sends an anomaly alert:
- `"3 consecutive failures — possible spec gap or environment issue."`
- Continue attempting remaining tasks
- Include pattern analysis in completion report

## Flaky Quality Gates

If a gate passes intermittently:
- Retry once to distinguish flaky from genuinely broken
- If still inconsistent, mark the task as blocked with "flaky gate" reason
- Don't loop forever trying to get a clean run

## Sprint Stalls

If no progress for an extended period:
- Orchestrate detects stall via timeout (configurable per task, default 30 min)
- Mark current task blocked
- Move to next task
- Report stall in completion report

## Operator Goes Offline

Not relevant during orchestrate execution — the operator is already outside the loop by design. Orchestrate runs autonomously regardless of operator presence.

For brainstorm phase (where operator is needed): pause and wait. Don't make design decisions without the operator.

## Post-Sprint Failures

After orchestrate finishes and the operator reviews:
- **Blocked tasks need fixing** → new sprint targeting specific gaps
- **Deliverable needs changes** → new sprint or direct edit
- **Framework itself broke** → fix the skill, commit, apply to next sprint
