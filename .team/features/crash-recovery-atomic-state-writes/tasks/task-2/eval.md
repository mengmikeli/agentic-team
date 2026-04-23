## Parallel Review Findings

### [security]
---

## Findings

🟡 `run.mjs:504-508` — `applyCrashRecovery()` calls `writeState()` even for `status: "paused"` and `status: "completed"`, overwriting existing tasks and changing status to `"executing"`. Tests for these paths only check `recovered === false` — they do not read STATE.json back to verify the state was preserved on disk. A user explicitly rerunning a completed feature loses its task history.

🟡 `util.mjs:93` — `isPidAlive()` returns `false` for all exceptions including `EPERM`. O

### [architect]
## Findings

**Verdict: PASS** (5 backlog items)

---

🟡 `bin/lib/run.mjs:906` — `syncTaskState()` overwrites harness-updated task statuses with stale in-memory values (always `pending`); after task-1 passes, calling `syncTaskState()` resets task-1 back to `pending` in STATE.json; if a crash then occurs, recovery re-runs already-completed tasks contradicting "preserving all other task statuses"; update in-memory task status on gate pass/fail before calling `syncTaskState()`

🟡 `bin/lib/util.mj

### [devil's-advocate]
---

**Verdict: PASS** (3 warnings to backlog, 3 suggestions)

---

## Findings

🟡 `test/crash-recovery.test.mjs` — `lockFile()` has zero test coverage; SPEC criterion 6 verified by code inspection only; add tests for acquire/release, stale PID eviction, and `{ acquired: false }` on timeout

🟡 `bin/lib/run.mjs:909` — `syncTaskState()` sets `s.tasks = tasks` from the in-memory array where `.status` is never updated after harness transitions; confirmed by this feature's own STATE.json: task-1 sh