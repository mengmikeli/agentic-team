# Security Review: iteration-escalation

**Reviewer:** Security reviewer
**Date:** 2026-04-24
**Verdict:** PASS (0 critical, 3 warnings → backlog, 1 suggestion)

---

## Files Actually Read

- `bin/lib/iteration-escalation.mjs` (60 lines — pure functions, no I/O)
- `bin/lib/compound-gate.mjs` (183 lines — layers + orchestrator)
- `bin/lib/run.mjs` (full file, escalation paths at lines 1088–1213)
- `test/iteration-escalation.test.mjs` (248 lines, 20 targeted tests)
- `.team/features/iteration-escalation/tasks/task-1/handshake.json`
- `.team/features/iteration-escalation/tasks/task-1/artifacts/test-output.txt` — 508 tests, 0 failures

---

## Criteria Results

### Core functionality — PASS
Direct evidence: 20 iteration-escalation tests pass. Integration test `iteration-escalation.test.mjs:157` confirms builder is invoked exactly twice and then blocked when `thin-content` recurs. Non-consecutive iterations (1 and 3) escalate correctly (`test.mjs:211`). Different layers per iteration do not escalate (`test.mjs:194`). `gateWarningHistory` persists across simulated reload (`test.mjs:228`).

Logic trace in `run.mjs`: WARN path at line 1088 calls `recordWarningIteration(task, attempt, ...)` → persists to STATE.json (lines 1095–1099) → `checkEscalation` called (line 1102) → if fires, injects synthetic critical finding → `computeVerdict` sees `critical > 0` → `reviewFailed = true` → `escalationFired` check at line 1206 → `harness transition → blocked` + `break`. Both `review` and `multi-review` paths are handled (lines 1088–1109 and 1158–1179). Flows ensure only one path runs per attempt.

### Input validation — PASS with one gap
`checkEscalation` guards `!Array.isArray || length < 2` (line 28) and uses `entry.layers || []` (line 36). **Gap:** if an individual entry is `null` (e.g., from corrupted STATE.json), `entry.iteration` at line 34 throws TypeError with no catch. STATE.json has HMAC tamper detection, so exploitability is low, but robustness is incomplete.

### Iteration key stability across crash-resume — WARNING
`attempt` (the loop counter, resets to 1 on each `_runSingleFeature` call) is used as the iteration key (`run.mjs:1094`). If run A crashes after attempt-1 WARN+critical and run B resumes, run B attempt-1 produces `{iteration:1, ...}` again. `checkEscalation` deduplicates iteration numbers via Set: `Set({1})` has size 1 — no escalation yet. Escalation fires only when run B reaches attempt 2 (`Set({1,2})`, size 2). Net effect: the mechanism is **delayed by one extra attempt** after crash-resume, not bypassed. But the design intent is "≥2 distinct iterations" which this violates in spirit.

### STATE.json write safety — WARNING
`gateWarningHistory` write-back at `run.mjs:1095-1099` does `readState`/`writeState` without `lockFile`. The identical operation in `runGateInline` at `run.mjs:123` uses `lockFile`. In single-process normal operation this is safe; a concurrent invocation would silently lose a history entry.

### Escalation message construction — SUGGESTION
`escalMsg` at `run.mjs:1105` interpolates `escalation.layers.join(", ")` and `escalation.iterations.join(", ")` into a critical finding string. In practice, layer names are fixed strings from compound-gate (`"thin-content"` etc.) and iteration numbers are loop counters. However, the function contract does not enforce this — unexpected content from a corrupt-but-undetected STATE.json could reach the finding text and progress log. Low risk; suggest asserting against the known layer allowlist before interpolation.

---

## Findings

🟡 `bin/lib/run.mjs:1094` — `attempt` resets to 1 on each new run invocation; crash-resume causes duplicate `{iteration:1}` entries in persisted history; Set deduplication prevents them from counting as 2 distinct iterations, delaying escalation by one extra attempt. Use `(task.gateWarningHistory?.length ?? 0) + 1` or `task.ticks` as the key instead.

🟡 `bin/lib/iteration-escalation.mjs:34` — No null-entry guard on individual entries in `gateWarningHistory`; a null entry causes an uncaught TypeError. Add `if (!entry || typeof entry !== 'object') continue;` before `entry.iteration`.

🟡 `bin/lib/run.mjs:1095` — `gateWarningHistory` write-back omits `lockFile` (contrast: `runGateInline` at run.mjs:123 uses it); concurrent access silently drops history. Wrap with `lockFile` for consistency.

🔵 `bin/lib/run.mjs:1105` — Layer names from `escalation.layers` are embedded in finding text without an allowlist check; add a guard asserting each name is one of the five known compound-gate layer strings before interpolation.