# Feature: Autonomous Re-planning Loop

## Goal
When a task is blocked after exhausting all retries, dispatch a re-plan agent that analyzes the failure and can inject replacement sub-tasks into the execution queue — so the sprint recovers autonomously rather than silently abandoning the work.

## Scope

- **Re-plan trigger**: After a task transitions to `blocked` (all retries exhausted), automatically invoke a re-plan agent before moving to the next task.
- **Re-plan agent input**: Original task description, full failure context (gate output, review findings, attempt history), list of remaining unstarted tasks, and the feature spec.
- **Re-plan agent output**: One of three verdicts:
  - `split` — replace the blocked task with 2–3 smaller sub-tasks (injected into the queue immediately after current position)
  - `inject` — add one prerequisite task before a retry of the blocked task (e.g. missing dependency, missing file)
  - `abandon` — no re-plan possible; blocked task stays blocked, sprint continues as-is
- **Injection mechanics**: New tasks from `split` or `inject` are appended to STATE.json `tasks` array and picked up by the existing execution loop in order.
- **Re-plan cap**: Maximum one re-plan attempt per original task (tracked in STATE.json). A sub-task that blocks does not trigger another re-plan.
- **Progress logging**: Re-plan decisions (verdict + rationale) are appended to `progress.md` and recorded in STATE.json `transitionHistory`.
- **Backlog integration**: If the re-plan agent flags warnings during analysis, they are routed to the warning backlog (same as review warnings).

## Out of Scope

- Re-planning triggered by anything other than a blocked task (e.g. slow progress, review warnings, partial failures).
- Human approval of the re-plan — must be fully autonomous.
- Re-planning the entire feature from scratch (only the blocked task and its immediate context are re-planned).
- Cross-feature re-planning or roadmap-level adjustments.
- Re-planning sub-tasks that themselves become blocked (one level only).
- Changing already-passed tasks.
- Changing the quality gate or flow template mid-sprint.

## Done When

- [ ] A blocked task automatically triggers a re-plan agent call (no new CLI flag required; behavior is always-on).
- [ ] Re-plan agent receives: original task brief, failure context (gate stdout/stderr, eval.md if present), remaining task list, and feature spec path.
- [ ] Re-plan agent produces a structured output (JSON) with `verdict: "split" | "inject" | "abandon"` and `tasks: [...]` for split/inject cases.
- [ ] `split` verdict: new sub-tasks are written into STATE.json and executed in order; original blocked task is marked `blocked` with a `replan: "split"` annotation.
- [ ] `inject` verdict: prerequisite task is inserted before a retry of the original blocked task; original task is reset to `pending` with attempt count reset to 0.
- [ ] `abandon` verdict: sprint continues exactly as today (blocked task remains blocked, no retry).
- [ ] Re-plan is capped at one attempt per original task; a sub-task that blocks does not re-trigger re-planning.
- [ ] Re-plan decision and rationale are appended to `progress.md` and recorded in STATE.json `transitionHistory`.
- [ ] `agt status` reflects injected sub-tasks with a visual indicator (e.g. `↳ split from task-N`).
- [ ] Existing behavior is unchanged when no task is blocked (zero regression).
- [ ] Integration test: a synthetic spec with a deliberately un-fixable task triggers re-plan, injected tasks execute, sprint completes without human input.
