# Feature: Dashboard Active Task Indicator

## Goal
Replace the generic "N/M tasks complete" display with the specific executing task's name and attempt number so observers can tell at a glance what the agent is working on right now.

## Requirements
- When a feature is executing, the active feature's hero card must show the current in-progress task's title and attempt number (e.g. "task-2 · attempt 2: Implement token breakdown UI").
- The feature timeline list must show the active task name inline for any feature with status `executing`, replacing or supplementing the plain "N/M tasks" count.
- Task cards in the TaskBoard "Active" column must display the attempt number badge.
- If no task is `in-progress` (e.g. between transitions), fall back gracefully to the existing "N/M tasks complete" display.
- The display must update in real-time via the existing SSE connection — no additional polling required.

## Acceptance Criteria
- [ ] StatusHero shows `"<task-title> (attempt <N>)"` when the active feature has exactly one in-progress task.
- [ ] StatusHero falls back to `"N of M tasks complete"` when no task is in-progress.
- [ ] FeatureTimeline row for an executing feature shows the active task title instead of (or appended to) the task count.
- [ ] TaskBoard Active-column task cards display an attempt badge (e.g. `×2`) when `attempts > 1`.
- [ ] All three display points update within one SSE event cycle (≤500 ms after `task-started` fires) without a page refresh.
- [ ] Gate tasks (title `"Quality gate passes"`) are excluded from active task display, matching existing filter logic.
- [ ] No layout breakage on narrow viewports (the task title truncates with ellipsis rather than wrapping uncontrollably).

## Technical Approach

### Data already available
`STATE.json` tasks have `id`, `title`, `status`, `attempts`. The active task is the first task with `status === "in-progress"` in the feature's `tasks` array. The `/api/features` response already includes this array.

### Active task helper
Add a utility in `dashboard-ui/src/lib/utils.ts` (or a new `task-utils.ts`):
```ts
export function getActiveTask(tasks: Task[]): Task | null {
  return tasks.find(t => !isGateTask(t) && t.status === "in-progress") ?? null;
}
```
`isGateTask` logic mirrors the existing filter in `feature-timeline.tsx`.

### Component changes
1. **`dashboard-ui/src/components/status-hero.tsx`** — Replace the static count line with a conditional: if `activeTask` exists, render task title + attempt badge; else render existing count text.
2. **`dashboard-ui/src/components/feature-timeline.tsx`** — For rows where `feature.status === "executing"`, render `activeTask.title` (truncated) after the count chip.
3. **`dashboard-ui/src/components/task-board.tsx`** — Task cards in the Active column get a small attempt badge (`×N`) when `task.attempts > 1`. No structural changes to the kanban layout.

### Types
`dashboard-ui/src/types.ts` already has `Task` with `attempts: number` and `title: string` — no schema changes needed.

### SSE
The existing `task-started` event already triggers a full feature refetch (`use-features.ts`). No new events or server-side changes required.

## Testing Strategy
- **Unit**: Pure helper `getActiveTask` — test with all-pending, one in-progress, multiple in-progress (should return first), gate task in-progress (should skip), all-passed.
- **Component**: Render StatusHero with a fixture that has one in-progress task; assert title and attempt text appear. Render with no in-progress tasks; assert fallback count appears.
- **Manual**: Run `agt harness` on a live feature, watch the dashboard hero update when `task-started` fires. Confirm attempt number increments on retry.

## Out of Scope
- Showing elapsed time for the current task (covered by token breakdown / future execution report).
- Changing the SSE event schema or adding new events.
- Displaying multiple simultaneous in-progress tasks (parallel execution is not yet implemented).
- Mobile-specific active task notification (push/badge).
- Historical "last active task" when a feature is completed.

## Done When
- [ ] `getActiveTask` utility exists and has passing unit tests.
- [ ] StatusHero displays active task name + attempt number when a task is in-progress.
- [ ] StatusHero falls back cleanly when no task is in-progress.
- [ ] FeatureTimeline shows active task name for executing features.
- [ ] TaskBoard attempt badge renders on Active-column cards with `attempts > 1`.
- [ ] All changes update live via SSE without page refresh.
- [ ] `npm run build` in `dashboard-ui/` passes with no type errors.
