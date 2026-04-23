# Security Review — oscillation-detection-tick-limits

**Verdict: PASS**

---

## Files Reviewed

- `bin/lib/transition.mjs` (full file, 220 lines)
- `bin/lib/util.mjs` (full file, 220 lines)
- `test/oscillation-ticks.test.mjs` (full file, 511 lines)
- `.team/features/oscillation-detection-tick-limits/tasks/task-7-r1-r1/artifacts/test-output.txt`
- `.team/features/oscillation-detection-tick-limits/tasks/task-7-r1-r1/handshake.json`

---

## Criteria Results

### 1. progress.md receives a timestamped entry on tick-limit events — PASS

**Evidence**: `transition.mjs:162` calls `appendProgress(dir, ...)` with a message containing the task ID and tick count. `util.mjs:63-66` generates a `### YYYY-MM-DD HH:MM:SS` header before every entry. Test at `oscillation-ticks.test.mjs:255-260` confirms presence of `###\s+\d{4}-\d{2}-\d{2}`, task ID `t1`, text `Tick limit exceeded`, and `1 ticks` in the written file. All assertions pass in the gate output (line 345 of test-output.txt).

### 2. progress.md receives a timestamped entry on oscillation halt events — PASS

**Evidence**: `transition.mjs:126` calls `appendProgress` when `reps >= 3`. `transition.mjs:137` calls `appendProgress` at the warn level (`reps == 2`). Test at `oscillation-ticks.test.mjs:375-383` confirms timestamp header, task ID, `Oscillation halted`, pattern string containing `in-progress`, and repetition count `3`. All assertions pass (line 351 of test-output.txt).

### 3. Entry includes task ID — PASS

**Evidence**: Both `appendProgress` calls embed `\`${taskId}\`` (backtick code span) in the entry string. The `taskId` is validated at `transition.mjs:69` — if the task doesn't exist in STATE.json the function returns early. Reaching either `appendProgress` call requires the task to be a real STATE.json entry.

### 4. Entry includes triggering pattern or count — PASS

**Evidence**:
- Tick-limit: message at `transition.mjs:162` includes `${currentTicks} ticks ≥ ${maxTaskTicks}`. Both values are integers derived from STATE.json and environment — not user-controlled text.
- Oscillation halt: message at `transition.mjs:126` includes `pattern [${patStr}] repeated ${oscillation.reps}×` where `patStr = oscillation.pattern.join(" → ")`. Pattern values are task statuses validated against `VALID_TASK_STATUSES` before being stored in `transitionHistory`. They cannot contain arbitrary user input.

### 5. Input validation — PASS

- `taskId` from CLI is validated against STATE.json tasks before use in any log entry (`transition.mjs:69`).
- `status` from CLI is validated against `VALID_TASK_STATUSES` at `transition.mjs:28`.
- `TASK_MAX_TICKS` env var: `parseInt` result is checked with `Number.isInteger(x) && x > 0`; zero, negative, and non-numeric values all fall back to 6 (`transition.mjs:14-15`). Test confirms NaN falls back to 6 (test-output.txt line 344).
- Oscillation pattern values come only from validated transitions.

### 6. Error handling — PASS WITH NOTE

`appendProgress` wraps writes in try/catch (`util.mjs:67-72`). However, the fallback catch at line 71 attempts `writeFileSync(progressPath, line)` — this could silently overwrite existing content if the initial write fails. Logged as a warning (see findings below).

### 7. Tamper detection — PASS

STATE.json tamper detection at `transition.mjs:42-45` prevents modified states from being processed. This protects the `transitionHistory` used by oscillation detection.

### 8. Locking — PASS

The STATE.json lock (`transition.mjs:49-53`) uses `{ flag: "wx" }` for atomic creation. Lock is released via `finally` block for normal exits, and via explicit `lock.release()` at `transition.mjs:132` before `process.exit(1)` in the oscillation-halt path.

---

## Findings

🟡 util.mjs:68-69 — `appendProgress` reads then writes without locking `progress.md`; concurrent harness calls can silently drop entries; replace with `fs.appendFileSync(progressPath, line)` which is a single atomic syscall

🟡 util.mjs:71 — fallback catch calls `writeFileSync(progressPath, line)` which would overwrite existing content on a partial write failure; this silently destroys prior progress entries; remove the fallback write or append to a temp location

🔵 util.mjs:63 — the read-modify-write pattern in `appendProgress` is equivalent to `fs.appendFileSync(progressPath, line)`; using appendFileSync directly removes the TOCTOU race and simplifies the code

---

## Verdict Rationale

The feature correctly implements all three required behaviors: timestamped entries, task ID inclusion, and triggering pattern/count inclusion. All relevant tests pass (376/376). The two 🟡 warnings are data integrity concerns in `appendProgress` that do not affect correctness under normal (non-concurrent) operation, and the harness currently operates sequentially per feature. They go to backlog.

**PASS** (backlog: 2 warnings)
