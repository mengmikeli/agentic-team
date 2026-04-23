# Feature: Oscillation Detection + Tick Limits

## Goal
Prevent infinite execution loops by tracking per-task tick counts that survive replans, and detecting repeating state-transition cycles that indicate a task or feature is stuck.

## Background

Current limits (`MAX_RETRIES_PER_TASK = 3`, `MAX_TOTAL_TRANSITIONS = 100`) guard against simple retry loops but miss two failure modes:

1. **Replan cycles** — A task fails 3× → blocked → replan creates a replacement task with `attempts: 0`. The new task has a fresh retry budget. This can repeat indefinitely: `task-1 → blocked → replan → task-1a → blocked → replan → task-1b → ...`
2. **Gate/review oscillation** — Gate returns PASS, reviewer returns FAIL, task retries. Same outcome on every attempt: `gate PASS → review FAIL → gate PASS → review FAIL → ...` The retries are consumed but no progress is made.

`transitionHistory` already records every state change. The data exists; the detection and enforcement logic does not.

## Scope

1. **Per-task tick field in STATE.json** — Add `ticks` to each task object. `ticks` counts total agent dispatches for that task slot across its full lifetime, including across replans. Unlike `attempts` (which tracks the current retry loop) and `retries` (which counts failed→in-progress), `ticks` never resets.

2. **Replan tick inheritance** — When replan creates a replacement task, the replacement inherits `ticks` from the task it replaces (plus 1). New tasks spawned for *new* work (not replacing a failed task) start at `ticks: 0`.

3. **Max ticks per task enforcement** — When a task's `ticks` reaches `maxTaskTicks` (default: 6, configurable via `TASK_MAX_TICKS` env var or `--max-task-ticks` flag), the harness `transition` command rejects any further `in-progress` transition for that task slot and force-transitions it to `blocked` with `reason: "tick-limit-exceeded"`. No replan is attempted.

4. **Oscillation pattern detection** — During each `transition` call, scan the task's slice of `transitionHistory`. If the last 2×K entries (for K ≥ 2) form a repeating pattern (e.g., `[failed, in-progress, failed, in-progress]`), emit a warning to stderr and record an `oscillation` event in `progress.md`. On the third detected repetition of the same cycle for one task, halt the feature with `status: "oscillation-halted"` and exit non-zero.

5. **Progress.md logging** — When a tick limit or oscillation halt triggers, append a structured entry to `progress.md`:
   - Tick limit: task ID, tick count, what was blocked
   - Oscillation: task ID, the repeating pattern, how many repetitions were detected

6. **Unit tests** — Tests covering: tick increment on dispatch, replan inheritance, tick-limit enforcement blocking transition, oscillation pattern detection (cycle of length 2 and 3), feature halt on third repetition.

## Out of Scope

- Changing existing `MAX_RETRIES_PER_TASK` or `MAX_TOTAL_TRANSITIONS` constants
- Cross-feature oscillation detection
- Automatic recovery or self-healing when oscillation is detected (halt only)
- Outer-loop (product-level) cycle capping — separate feature
- Dashboard/UI changes to visualize tick history
- Persisting oscillation metrics across features for trend analysis

## Done When

- [ ] Each task object in STATE.json has a `ticks` field that increments on every agent dispatch (including retries)
- [ ] A replacement task created by replan starts with `ticks` equal to the replaced task's `ticks + 1`, not 0
- [ ] `agt-harness transition` rejects `in-progress` for a task at or above `maxTaskTicks`, writing `reason: "tick-limit-exceeded"` and status `blocked` to STATE.json
- [ ] `maxTaskTicks` is configurable via `TASK_MAX_TICKS` env var (default: 6)
- [ ] `transition.mjs` detects a repeating pattern of length K ≥ 2 in the task's `transitionHistory` after the pattern repeats at least 2× and logs a warning to `progress.md`
- [ ] On the 3rd repetition of the same oscillation pattern for a single task, the harness exits non-zero and sets feature `status: "oscillation-halted"` in STATE.json
- [ ] `progress.md` contains a timestamped entry whenever a tick limit or oscillation halt fires, including the task ID and the triggering pattern or count
- [ ] Unit tests pass for: tick increment, replan inheritance, tick-limit rejection, oscillation detection (length-2 cycle), feature halt condition
- [ ] A manual smoke test with a mock task that always fails confirms the run terminates cleanly (not via `MAX_TOTAL_TRANSITIONS`) within `maxTaskTicks × 2` transitions
