# Progress: autonomous-re-planning-loop

**Started:** 2026-04-21T04:30:22.412Z
**Tier:** functional
**Tasks:** 11

## Plan
1. A blocked task automatically triggers a re-plan agent call (no new CLI flag required; behavior is always-on).
2. Re-plan agent receives: original task brief, failure context (gate stdout/stderr, eval.md if present), remaining task list, and feature spec path.
3. Re-plan agent produces a structured output (JSON) with `verdict: "split" | "inject" | "abandon"` and `tasks: [...]` for split/inject cases.
4. `split` verdict: new sub-tasks are written into STATE.json and executed in order; original blocked task is marked `blocked` with a `replan: "split"` annotation.
5. `inject` verdict: prerequisite task is inserted before a retry of the original blocked task; original task is reset to `pending` with attempt count reset to 0.
6. `abandon` verdict: sprint continues exactly as today (blocked task remains blocked, no retry).
7. Re-plan is capped at one attempt per original task; a sub-task that blocks does not re-trigger re-planning.
8. Re-plan decision and rationale are appended to `progress.md` and recorded in STATE.json `transitionHistory`.
9. `agt status` reflects injected sub-tasks with a visual indicator (e.g. `↳ split from task-N`).
10. Existing behavior is unchanged when no task is blocked (zero regression).
11. Integration test: a synthetic spec with a deliberately un-fixable task triggers re-plan, injected tasks execute, sprint completes without human input.

## Execution Log

