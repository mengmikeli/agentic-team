# Progress: oscillation-detection-tick-limits

**Started:** 2026-04-23T03:57:41.972Z
**Tier:** functional
**Tasks:** 9

## Plan
1. Each task object in STATE.json has a `ticks` field that increments on every agent dispatch (including retries)
2. A replacement task created by replan starts with `ticks` equal to the replaced task's `ticks + 1`, not 0
3. `agt-harness transition` rejects `in-progress` for a task at or above `maxTaskTicks`, writing `reason: "tick-limit-exceeded"` and status `blocked` to STATE.json
4. `maxTaskTicks` is configurable via `TASK_MAX_TICKS` env var (default: 6)
5. `transition.mjs` detects a repeating pattern of length K ≥ 2 in the task's `transitionHistory` after the pattern repeats at least 2× and logs a warning to `progress.md`
6. On the 3rd repetition of the same oscillation pattern for a single task, the harness exits non-zero and sets feature `status: "oscillation-halted"` in STATE.json
7. `progress.md` contains a timestamped entry whenever a tick limit or oscillation halt fires, including the task ID and the triggering pattern or count
8. Unit tests pass for: tick increment, replan inheritance, tick-limit rejection, oscillation detection (length-2 cycle), feature halt condition
9. A manual smoke test with a mock task that always fails confirms the run terminates cleanly (not via `MAX_TOTAL_TRANSITIONS`) within `maxTaskTicks × 2` transitions

## Execution Log

### 2026-04-23 04:18:25
**Task 1: Each task object in STATE.json has a `ticks` field that increments on every agent dispatch (including retries)**
- Verdict: 🟡 Review FAIL (attempt 1)
- Will retry with review feedback

