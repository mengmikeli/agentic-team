# Failure Handling

## Subagent produces bad output

**First failure:** Tighten the brief — add more context, explicit constraints, code examples.
**Second failure:** Reduce task size — break it into smaller, more mechanical pieces.
**Third failure:** Coordinator edits directly or switches to a more capable model.

Never debug a subagent's bad output. Discard and re-approach.

## Tests are flaky

Stop and fix before continuing. Flaky tests erode trust in the safety net. If a test is intermittent, either fix the root cause or delete the test and replace it with a reliable one.

## QA blocks release

Triage by severity:
- **P0 (broken):** Fix before merge. No exceptions.
- **P1 (annoying):** Fix before merge if < 30 min. Otherwise file issue, ship with known issue.
- **P2 (polish):** File issue, ship. Fix in next sprint.

If QA blocks release 3+ times on the same sprint, escalate to operator — the spec or implementation approach may need rethinking.

## Operator goes offline mid-sprint

**Bounded autonomy rules:**
- Continue mechanical work (implementation tasks with clear specs)
- Continue QA (run the checklist, file results)
- Pause on: design decisions, scope changes, production deploys
- Post status update summarizing what was done and what's waiting
- Resume when operator returns

## PR conflicts

Coordinator resolves conflicts, not the implementer agents. The coordinator has the broadest context and knows merge order. If conflicts are frequent, it's a signal that work should be more sequential (subagent swarm) or that shared foundations need to ship first.

## Sprint stalls

Default thresholds (adjust per team):
- No progress for ~2 hours on an active sprint → coordinator pings the owning agent
- No response in ~1 hour → mark as stalled
- Stalled ~4+ hours → reassign, reduce scope, or escalate to operator

These are starting points. Tighten for time-sensitive work, loosen for exploratory sprints.
