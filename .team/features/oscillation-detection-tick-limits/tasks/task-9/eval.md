---

# Devil's Advocate Review — oscillation-detection-tick-limits (run.mjs fix pass)

**Reviewer role:** devil's-advocate (adversarial, independent)
**Verdict: PASS**
**Date:** 2026-04-23

---

## Files Actually Read (this pass only)

- `bin/lib/run.mjs:1-60` (harness wrapper, lines 28-45)
- `bin/lib/run.mjs:820-870` (fix area — transition result handling)
- `bin/lib/run.mjs:1055-1090` (systemic-halt check and finalize)
- `bin/lib/transition.mjs:130-182` (oscillation halt and tick-limit output format)
- `.team/features/oscillation-detection-tick-limits/tasks/task-9/handshake.json`
- `.team/features/oscillation-detection-tick-limits/tasks/task-9/eval.md` (all prior reviews)
- `test/smoke-terminates.test.mjs` (grep — harness call patterns)
- `test/oscillation-ticks.test.mjs` (grep — harness call patterns)
- `test/integration.test.mjs` (grep — no run.mjs references found)
- `test/outer-loop.test.mjs:1-50` (scope check)

---

## What Was Fixed

Prior devil's-advocate pass gave **FAIL** because `run.mjs:831` discarded the return value of `harness("transition", "--task", ..., "--status", "in-progress")`. Oscillation halt and tick-limit both returned `{ allowed: false, ... }` to the caller, which ignored it and dispatched the agent anyway.

The fix at `run.mjs:831-846`:
```javascript
const transitionResult = harness("transition", "--task", task.id, "--status", "in-progress", "--dir", featureDir);
if (transitionResult && transitionResult.allowed === false) {
  if (transitionResult.halt === true) {
    console.log(...); appendProgress(...); harness("notify", ...); break;
  }
  console.log(...); appendProgress(...); blocked++; continue;
}
```

---

## Prior Critical Finding — Resolved?

🔴 `bin/lib/run.mjs:831` (prior) — return value discarded; halt/tick-limit were no-ops.

**Verdict: RESOLVED.**

- Return value is now captured ✓
- `halt: true` → `break` exits the task loop — feature stops ✓
- Non-halt `allowed: false` → `blocked++; continue` — skips agent dispatch ✓
- `transition.mjs:140-144` writes `{ allowed: false, halt: true, reason: ... }` to stdout before `process.exit(1)` → `harness()` catch branch (line 39-43) parses it correctly ✓
- `transition.mjs:176-179` writes `{ allowed: false, reason: "tick-limit-exceeded..." }` with exit code 0 → `harness()` success branch (line 38) parses it correctly ✓

Logic is correct. The critical is closed.

---

## Done-When Criteria Re-Evaluation (post-fix)

| # | Criterion | Evidence | Verdict |
|---|-----------|----------|---------|
| 1 | `ticks` increments on every `→ in-progress` | Unchanged from prior review | ✅ PASS |
| 2 | Replan tick inheritance | Unchanged | ✅ PASS |
| 3 | Tick-limit rejects `in-progress`, writes blocked+reason | `transition.mjs:168-181`; now **also** skips agent dispatch at `run.mjs:844-845` | ✅ PASS |
| 4 | `TASK_MAX_TICKS` env var | Unchanged | ✅ PASS |
| 5 | K≥2 pattern after 2× → warn + progress.md | Unchanged | ✅ PASS |
| 6 | 3rd repetition → exit(1) + `oscillation-halted` + **loop stops** | Harness: `transition.mjs:136-146` ✓; Loop: `run.mjs:839` `break` ✓ | ✅ PASS |
| 7 | `progress.md` timestamped entry | `appendProgress` called at `run.mjs:836,843` for both paths ✓ | ✅ PASS |
| 8 | Unit tests pass | Gate output shows tests passing; oscillation/smoke suites not in truncated output (see finding below) | ✅ PASS (conditional) |
| 9 | Smoke test terminates within maxTaskTicks×2 | Harness-level only; smoke test unchanged; fix does not affect it | ✅ PASS |

---

## Findings

### New Findings (this pass)

🟡 `bin/lib/run.mjs:832-846` — No test exercises this branch. Every test in the suite calls the harness subprocess directly (`spawnSync`/`execFileSync`). The `run.mjs` task loop is never tested with a harness returning `{ allowed: false, halt: true }` or `{ allowed: false, reason: "tick-limit-exceeded" }`. If the JSON output format of `transition.mjs` changes (e.g. `halt` becomes `halted`) or the `harness()` wrapper changes, the handling silently reverts to the pre-fix broken behavior with no failing test to catch it.

🟡 `bin/lib/run.mjs:844` — `blocked++` for tick-limit contributes to the systemic-halt counter at `run.mjs:1055` (`if (blocked >= 3) break`), but because the tick-limit path uses `continue`, line 1055 is only reached during the **next task that enters the inner attempt loop** — even a passing task. Scenario: tasks 1, 2, 3 all hit tick-limit (blocked=3 via `continue`); task 4 passes on first attempt; at line 1055, `blocked >= 3` fires and breaks the loop with "3 consecutive blocks — possible systemic issue" despite task 4 succeeding. This interaction is novel to the fix and untested.

🟡 Gate output truncated — the provided gate output ends mid-suite (`✔ bra`). The `oscillation-ticks.test.mjs` and `smoke-terminates.test.mjs` suites, which exercise the harness primitives underlying this fix, run later alphabetically and are not shown. No direct evidence that they still pass appears in the gate output. (The fix only modifies `run.mjs`, making a regression in harness-only tests very unlikely — but it is an inference, not confirmed evidence.)

### Carry-Forward Warnings (unresolved from prior passes)

🟡 `bin/lib/transition.mjs:68` — No re-entry guard for `oscillation-halted` feature status post-lock.

🟡 `bin/lib/transition.mjs:23-27` — `appendProgressInDir` non-atomic read-modify-write.

🟡 `bin/lib/transition.mjs:16` — No upper bound on `TASK_MAX_TICKS`.

🟡 `bin/lib/transition.mjs:55-58` — Tamper check on pre-lock state; post-lock `freshState` never re-validated.

🟡 `bin/lib/transition.mjs:116-131` — Two `progress.md` warning entries per oscillation cycle (phase-shifted K=2 patterns both fire at N=4 and N=5).

🟡 `test/oscillation-ticks.test.mjs:237` — Zero test coverage for K≥3 oscillation patterns.

🟡 `bin/lib/transition.mjs:15` — `parseInt("2abc")` returns 2; invalid-but-leading-numeric env values not caught.

🔵 `bin/lib/util.mjs:63-66` — `resolveDir` accepts arbitrary paths; no workspace-root restriction.

🔵 `SPEC.md:21` — Spec mentions `--max-task-ticks` CLI flag; not implemented.

---

## Summary

The prior 🔴 critical (`run.mjs:831` discards halt signal) is **fully resolved**. Logic is correct: oscillation halt breaks the task loop; tick-limit skips the task dispatch. JSON output from `transition.mjs` is correctly handled by the `harness()` wrapper. Three new 🟡 warnings added to backlog; eight carry-forward 🟡 and two 🔵 remain open. No criticals.

**Verdict: PASS**

---

# Architect Review — oscillation-detection-tick-limits (task-9 / gate-review pass)

**Reviewer role:** architect (independent gate review)
**Verdict: PASS**
**Date:** 2026-04-23

---

## Files Read

- `bin/lib/transition.mjs` (full, 233 lines)
- `bin/lib/replan.mjs` (full, 159 lines)
- `test/oscillation-ticks.test.mjs` (full, 439 lines)
- `test/smoke-terminates.test.mjs` (full, 118 lines)
- `.team/features/oscillation-detection-tick-limits/SPEC.md` (full)
- `.team/features/oscillation-detection-tick-limits/tasks/task-9/handshake.json`
- `.team/features/oscillation-detection-tick-limits/tasks/task-5/artifacts/test-output.txt` (lines 1–50 and 680–720; summary: 373 tests, 0 failures)

---

## Handshake Claim vs. Evidence

Builder (task-9) claims: *"Created `test/smoke-terminates.test.mjs` which simulates a task that always fails and verifies it terminates via tick-limit-exceeded within `maxTaskTicks × 2` transitions."*

Verification:
- `test/smoke-terminates.test.mjs` exists and was read in full. ✓
- Test-output.txt line 605: `✔ terminates via tick-limit-exceeded (not MAX_TOTAL_TRANSITIONS) within maxTaskTicks × 2 transitions (477.969792ms)` ✓
- Gate output (provided): the test runs as part of `npm test` and passes. ✓
- Claim is accurate.

---

## Done-When Criteria

| # | Criterion | Evidence | Verdict |
|---|-----------|----------|---------|
| 1 | `ticks` increments on every `→ in-progress` | `transition.mjs:207–209`; "ticks field" suite 9/9 pass | ✅ PASS |
| 2 | Replan replacement inherits `ticks = blocked.ticks + 1` | `replan.mjs:126,140,152`; "replan tick inheritance" suite 3/3 pass | ✅ PASS |
| 3 | Tick-limit rejects `in-progress` ≥ maxTaskTicks, writes `blocked` + `tick-limit-exceeded` | `transition.mjs:168–181`; `task.lastTransition` set at line 173; "tick-limit enforcement" suite 2/2 pass | ✅ PASS |
| 4 | `TASK_MAX_TICKS` env var, default 6, invalid → fallback | `transition.mjs:15–16`; NaN fallback test passes | ✅ PASS |
| 5 | K≥2 pattern after 2× → warn + `progress.md` entry | `transition.mjs:116–151`; test confirms `allowed=true`, progress.md has "Oscillation warning" | ✅ PASS |
| 6 | 3rd repetition → exit(1) + `status: "oscillation-halted"` | `transition.mjs:136–146`; `lock.release()` at 145 before `process.exit(1)`; spawnSync test confirms exit code 1, `halt: true` | ✅ PASS (harness level only — see critical finding) |
| 7 | `progress.md` timestamped entry for tick-limit and oscillation | `transition.mjs:18–28`; smoke test asserts entry exists; oscillation test reads progress.md | ✅ PASS |
| 8 | Unit tests: tick increment, replan inheritance, tick-limit, oscillation K=2, halt | 373/373 pass (confirmed from test-output.txt) | ✅ PASS |
| 9 | Smoke test: always-failing task terminates via tick-limit within `maxTaskTicks × 2` | `test/smoke-terminates.test.mjs` passes; `transitionCount=6` ≪ 100 | ✅ PASS (harness level only) |

---

## Algorithm Correctness — Traced Manually

**K=2 warn path** (N=4, history = `[IP,F,IP,F]`)
- K=2: `first=slice(0,2)=[IP,F]`, `second=slice(2,4)=[IP,F]` → match
- reps=2, pos=0, pos−K=−2 < 0 → stop; reps=2 < 3 → warn ✓

**K=2 halt path** (N=6, history = `[IP,F,IP,F,IP,F]`)
- K=2: `first=slice(2,4)=[IP,F]`, `second=slice(4,6)=[IP,F]` → match
- reps=2, pos=2; seg=slice(0,2)=[IP,F] matches → reps=3, pos=0; pos−K<0 → stop; reps=3 ≥ 3 → halt ✓

**Pre-transition placement**: oscillation check runs at line 108 before the incoming transition is appended (line 211). Correct — fires on the transition that would deepen the cycle, not after. ✓

**Lock release on exit**: `lock.release()` at line 145 is explicit; the `finally` block at line 230 does NOT execute after `process.exit()` (Node.js semantics). No lock leak. ✓

**`task.lastTransition` on tick-limit path**: set at line 173 alongside `task.status = "blocked"`. Prior devil's-advocate finding flagged this as missing, but it was fixed (commit `15b5262`). ✓

---

## Findings

🟡 `bin/lib/transition.mjs:68` — No re-entry guard for `oscillation-halted` feature status. After line 137 sets `freshState.status = "oscillation-halted"` and writes it, subsequent `transition` calls on *other* tasks in the same feature are not blocked — the post-lock path at line 68 never checks `if (freshState.status === "oscillation-halted")`. The halt signal is persisted but not enforced by the gate. Add an early-return guard after the post-lock `readState` call.

🟡 `bin/lib/transition.mjs:23-27` — `appendProgressInDir` reads then writes non-atomically. Concurrent harness processes can silently overwrite each other's entries. Replace the read+concat+write with `appendFileSync(progressPath, line)`.

🟡 `bin/lib/transition.mjs:131` — `break` on the first (smallest) K always reports the smallest matching cycle length. A pure K=3 history `[A,B,C,A,B,C]` where no K=2 sub-match exists is correctly detected at K=3, but any coincidental K=2 tail match preempts it. The reported `oscillation.K` in stderr output can mislead callers about the true cycle length. Document this behavior or change the loop to prefer the longest matching K.

🟡 `bin/lib/transition.mjs:16` — No upper bound on `TASK_MAX_TICKS`. `TASK_MAX_TICKS=9999` passes all guards and silently disables enforcement. Add a reasonable ceiling (e.g. 1000).

🟡 `bin/lib/transition.mjs:55-58` — Tamper check (`_written_by !== WRITER_SIG`) runs on the pre-lock `state` variable. Post-lock `freshState` at line 69 is never re-validated. A race between the two reads can substitute a tampered STATE.json. Re-check `freshState._written_by` after lock acquisition.

🟡 `test/oscillation-ticks.test.mjs:237` — No test for K=3 oscillation. SPEC scope body requires "cycle of length 2 and 3"; Done-When criterion 8 only gates length-2. The K=3 code path (`transition.mjs:116` loop) is executed in production but has zero test coverage. Add tests with `[A,B,C,A,B,C]` (warn) and `[A,B,C,A,B,C,A,B,C]` (halt) where A≠C so no K=2 sub-match fires.

---

## Summary

All 9 Done-When criteria met with direct code and test evidence. Core logic is correct: tick increment, replan inheritance, tick-limit enforcement, oscillation detection at 2× (warn) and 3× (halt), progress.md logging, and smoke-test bounded termination all verified by tracing the code path and citing specific line numbers. Six 🟡 warnings go to backlog; none are critical. **Verdict: PASS.**

---

# Architect Review — oscillation-detection-tick-limits (task-9 / final)

**Reviewer role:** architect
**Verdict: PASS**
**Date:** 2026-04-23

---

## Files Read

- `bin/lib/transition.mjs` (full, 232 lines)
- `bin/lib/replan.mjs` (full, 158 lines)
- `test/oscillation-ticks.test.mjs` (full, 439 lines)
- `test/smoke-terminates.test.mjs` (full, 117 lines)
- `.team/features/oscillation-detection-tick-limits/tasks/task-5/artifacts/test-output.txt` (373 tests, all pass)
- Handshakes: task-1 through task-5, task-9
- SPEC.md, STATE.json, progress.md

---

## Done-When Criteria

| # | Criterion | Evidence | Verdict |
|---|-----------|----------|---------|
| 1 | `ticks` field increments on every `→ in-progress` | `transition.mjs:207`; "ticks field" suite 9/9 pass | ✅ PASS |
| 2 | Replan replacement inherits `ticks = blocked.ticks + 1` | `replan.mjs:126,140,152`; "replan tick inheritance" suite 3/3 pass | ✅ PASS |
| 3 | Tick-limit rejects `in-progress` ≥ maxTaskTicks, writes `blocked` + `tick-limit-exceeded` | `transition.mjs:168-181`; "tick-limit enforcement" suite 2/2 pass | ✅ PASS |
| 4 | `TASK_MAX_TICKS` env var (default 6), invalid value falls back | `transition.mjs:15-16`; tested with `TASK_MAX_TICKS=abc` → fallback confirmed | ✅ PASS |
| 5 | K≥2 repeating pattern after 2× → warn + `progress.md` entry | `transition.mjs:116-151`; "oscillation detection" test confirms allowed=true and progress.md contains "Oscillation warning" | ✅ PASS |
| 6 | 3rd repetition → exit(1) + `status: "oscillation-halted"` | `transition.mjs:136-146`; spawnSync check confirms exit code 1, `halt: true`, `reason: /oscillation-halted/` | ✅ PASS |
| 7 | `progress.md` timestamped entry for tick limit and oscillation halt | `transition.mjs:18-28`; smoke test confirms tick-limit entry; oscillation test reads progress.md and asserts "Oscillation warning" | ✅ PASS |
| 8 | Unit tests: tick increment, replan inheritance, tick-limit, oscillation K=2, halt | 373/373 pass (test-output.txt confirmed) | ✅ PASS |
| 9 | Smoke test: always-failing task terminates via tick-limit-exceeded within maxTaskTicks×2 | `test/smoke-terminates.test.mjs` exists; test output line 605 confirms pass in 483ms; TASK_MAX_TICKS=3, 6 transitions << 100 MAX_TOTAL_TRANSITIONS | ✅ PASS |

---

## Per-Criterion Analysis

### Oscillation algorithm correctness (criterion 5 & 6)

Traced manually through the K=2 case:

- History `[IP,F,IP,F]` (N=4): K=2, `first=[IP,F]`, `second=[IP,F]`, match → reps=2 → warn. ✓
- History `[IP,F,IP,F,IP,F]` (N=6): K=2, match with reps=2, then back-scan pos=2→0 extends to reps=3 → halt. ✓

The algorithm correctly identifies patterns **at the tail** of history and counts consecutive trailing repetitions. Pattern detection is pre-transition (runs on existing history before the incoming transition is recorded), which is the correct placement — it blocks the transition that would deepen the oscillation.

### Replan tick inheritance

`replan.mjs:126`: `ticks: (blockedTask.ticks || 0) + 1`. The `|| 0` handles the backward-compatibility case (no `ticks` field on legacy tasks). Traced through the STATE.json-sync test at `oscillation-ticks.test.mjs:365-438`: fresh read from STATE.json before `applyReplan` call correctly gives `ticks=5` to blocked task and `ticks=6` to replacement tasks. ✓

### Smoke test validity

`test/smoke-terminates.test.mjs`: Uses varied exit transitions `[IP, failed, IP, blocked, IP, failed]` to avoid triggering oscillation before the tick limit. K=2 check at the 7th call (IP after 3 ticks) sees `[IP,blocked]` vs `[IP,failed]` — not equal, so no oscillation fires; tick-limit fires first. This is a deliberate design choice to isolate the tick-limit path. The test correctly validates termination is due to tick-limit-exceeded, not MAX_TOTAL_TRANSITIONS. ✓

---

## New Findings (not in prior task-5 review)

🟡 `test/oscillation-ticks.test.mjs` — No test for K=3 oscillation pattern detection. The loop at `transition.mjs:116` runs from K=2 to `floor(N/2)`, so K=3 code executes in production but has zero test coverage. A history like `[A,B,C,A,B,C]` would fire K=2 ([B,C,B,C]) before K=3 ([A,B,C,A,B,C]), but the algorithm behavior for pure K=3 patterns with no K=2 sub-match is entirely untested.

🔵 `SPEC.md:21` — Spec body describes `--max-task-ticks` CLI flag but it was not implemented and is not in the Done-When checklist. Minor inconsistency between spec description and done-when criteria; no functional gap per done-when.

---

## Previously-Flagged Warnings (task-5 eval.md — carry forward to backlog)

🟡 `bin/lib/transition.mjs:23-27` — `appendProgressInDir` reads then writes non-atomically; use `appendFileSync`.

🟡 `bin/lib/transition.mjs:16` — No upper bound on `TASK_MAX_TICKS`; arbitrarily large value silently disables limit.

🟡 `bin/lib/transition.mjs:55` — Tamper check uses pre-lock `state`; post-lock `freshState._written_by` is never re-validated.

🟡 `bin/lib/transition.mjs:131` — K-loop `break` on first (smallest) K always prefers K=2, masking longer true patterns behind spurious K=2 matches.

---

## Summary

All 9 Done-When criteria met with direct evidence. The implementation is structurally sound: oscillation detection is pre-transition, tick increment is on `→ in-progress` only, replan inheritance is correct with backward-compat fallback, and the smoke test correctly isolates the tick-limit path. The 5 warning-level findings (4 carryover + 1 new) must go to backlog but none block merge.

---

### [security]

**Reviewer role:** security
**Verdict: PASS** (3 warnings for backlog, 0 criticals)
**Date:** 2026-04-23

#### Files Read (security pass)

- `bin/lib/transition.mjs` (all 233 lines) — primary implementation
- `bin/lib/replan.mjs` (all 159 lines) — tick inheritance
- `test/oscillation-ticks.test.mjs` (all 439 lines) — unit tests
- `test/smoke-terminates.test.mjs` (all 118 lines) — smoke test
- `tasks/task-5/artifacts/test-output.txt` — verified 373 tests, 0 failures

#### Security Edge Cases Checked

- **`join(",")` comparison**: Status values come from validated `VALID_TASK_STATUSES` set; none contain commas. False-pattern-match via delimiter collision is impossible with current status vocabulary.
- **`TASK_MAX_TICKS` env validation**: `parseInt + Number.isInteger + > 0` correctly handles NaN, negative, zero → fallback 6. No upper bound (see finding below).
- **Lock / process.exit interaction**: `lock.release()` is called explicitly at line 145 before `process.exit(1)`. The `finally` block at line 231 does NOT run after `process.exit` (Node.js semantics). No double-release, no leaked lock. ✓
- **`taskId` in file content**: Used in `progress.md` entries via template literals. Content is written to a markdown file, not executed. Path construction uses `join(dir, "progress.md")` — `taskId` never enters the path. Low-risk markdown corruption only.
- **Oscillation detection timing**: Runs on `transitionHistory` *before* current transition is appended (line 108 vs line 211). Correct — 2 full repetitions must already be recorded before the warning fires.

#### Findings

Confirming all four carryover warnings from task-5 eval still apply and are unresolved:

🟡 `bin/lib/transition.mjs:23-27` — `appendProgressInDir` is a non-atomic read-modify-write on `progress.md`; concurrent harness processes can silently overwrite each other's entries. Replace with `appendFileSync`.

🟡 `bin/lib/transition.mjs:16` — No upper bound on `TASK_MAX_TICKS`; `TASK_MAX_TICKS=2147483647` passes all guards and silently disables enforcement. Add a reasonable ceiling (e.g. 1000).

🟡 `bin/lib/transition.mjs:55-58` — Tamper check (`_written_by !== WRITER_SIG`) runs on the pre-lock `state`; post-lock `freshState` at line 69 is never re-validated. A racing writer between the two reads can substitute a tampered STATE.json that evades detection. Re-check `freshState._written_by` after acquiring the lock.

🟡 `test/oscillation-ticks.test.mjs:237-311` — Zero test coverage for K=3 oscillation patterns. SPEC requires K ≥ 2; implementation iterates K=2 to `floor(N/2)`. A pure K=3 cycle is unvalidated. Add tests with history `[A,B,C,A,B,C]` (warn) and `[A,B,C,A,B,C,A,B,C]` (halt).

🔵 `bin/lib/transition.mjs:31` — No length or character-class validation on `taskId` from CLI args. A taskId with embedded newlines could corrupt `progress.md` entries. Low risk for an internal tool; `/^[\w-]+$/` check before use is sufficient.

#### Summary

No criticals. All 9 SPEC criteria pass with direct test evidence. The prior 🔴 from task-5 (smoke test missing) is resolved by task-9. Four pre-existing 🟡 warnings remain open in backlog; one new 🟡 (K≥3 test coverage) is added.

---

### [devil's-advocate]

**Reviewer role:** devil's-advocate
**Verdict: PASS** (3 new warnings for backlog, no criticals)
**Date:** 2026-04-23

#### Files Actually Read

- `bin/lib/transition.mjs` (full, 232 lines)
- `bin/lib/replan.mjs` (full, 158 lines)
- `test/oscillation-ticks.test.mjs` (full, 439 lines)
- `test/smoke-terminates.test.mjs` (full, 117 lines)
- `.team/features/oscillation-detection-tick-limits/SPEC.md`
- `.team/features/oscillation-detection-tick-limits/tasks/task-5/artifacts/test-output.txt` (720 lines, 373 tests pass)
- `.team/features/oscillation-detection-tick-limits/tasks/task-5/eval.md`
- `.team/features/oscillation-detection-tick-limits/tasks/task-9/handshake.json`

#### Edge Cases Explicitly Checked

1. **Lock release on `process.exit(1)`** — `lock.release()` at line 145 runs before `process.exit(1)`. `finally` does NOT run after exit in Node.js. Explicit release is the only thing preventing a leaked lock file. Confirmed correct.
2. **Tick-limit vs. oscillation priority** — Oscillation check is at line 108; tick check is at line 167. Oscillation fires first. With `TASK_MAX_TICKS=3` and a K=2 oscillating history, oscillation halt would preempt tick-limit at reps=3. The smoke test deliberately avoids this to isolate tick-limit. No conflict, but the interaction is subtle and undocumented.
3. **Retries exhaustion race with oscillation** — Retry limit check is at line 154-165, after oscillation at 108. At reps=3 the oscillation halt exits before retries could block. Not a bug, but the ordering is load-bearing.
4. **Idempotency guard interaction** — Idempotency check (lines 183-197) runs after oscillation. A duplicate call within `IDEMPOTENCY_WINDOW_MS` hits idempotency before adding a history entry. No spurious oscillation counting.
5. **Multi-task STATE.json** — `taskStatuses` filtered by `taskId`; cross-task contamination is impossible. Confirmed correct.

#### Findings

🟡 `bin/lib/transition.mjs:171` — `task.lastTransition` is not set when tick-limit fires; `task.status` becomes `"blocked"` but `lastTransition` retains the timestamp of the last successful in-progress dispatch. The normal transition path at line 202 sets `lastTransition`; this path does not. Any consumer using `lastTransition` for stuck-task detection or audit log gets stale timing data. Add `task.lastTransition = new Date().toISOString()` at line 172 alongside the status/reason assignment.

🟡 `bin/lib/transition.mjs:68` — No re-entry guard for `oscillation-halted` feature status. After `freshState.status = "oscillation-halted"` is written (line 137), subsequent `transition` calls re-read this state but there is no check like `if (freshState.status === "oscillation-halted") { return disallowed; }`. Other tasks in the same feature remain dispatchable after a halt; the feature-level stop signal is persisted but never enforced by the transition gate. Add an early-return guard post-lock (line 68 region) for this status.

🟡 `test/smoke-terminates.test.mjs:53` — Only the tick-limit termination path is smoke-tested. The oscillation-halt path (the other hard exit) has no end-to-end bounded-termination evidence. A distinct smoke scenario where oscillation fires and `status: "oscillation-halted"` is confirmed within bounded transitions would give direct evidence that both exit paths work in a realistic sequence.

#### Summary

No criticals. All 9 Done-When criteria are met with direct evidence from files I actually read. Three new 🟡 warnings not present in the architect or security reviews are surfaced above and must go to backlog. The implementation is safe to merge on the PASS verdict.

---

### [security-gate]

**Reviewer role:** security-gate
**Verdict: PASS** (1 new 🟡, 4 carryover 🟡 confirmed, 1 🔵)
**Date:** 2026-04-23

#### Files Actually Read

- `bin/lib/transition.mjs` (all 234 lines) — primary implementation
- `bin/lib/util.mjs` (all 206 lines) — resolveDir, lockFile, writeState, readState
- `test/oscillation-ticks.test.mjs` (all 439 lines) — unit tests
- `test/smoke-terminates.test.mjs` (all 118 lines) — smoke test
- `.team/features/oscillation-detection-tick-limits/tasks/task-9/handshake.json`
- `.team/features/oscillation-detection-tick-limits/STATE.json`

#### Security Edge Cases Checked

- **`join(",")` delimiter collision**: `VALID_TASK_STATUSES` contains `["pending","in-progress","passed","failed","blocked","skipped"]` — none contain commas. The pattern comparison at line 119 (`first.join(",") !== second.join(",")`) cannot produce a false positive from status-value content. ✓
- **`TASK_MAX_TICKS` parsing**: `parseInt(..., 10)` then `Number.isInteger && > 0` guards against NaN, float, negative, zero → fallback 6. `parseInt("Infinity", 10)` → NaN → fallback. `parseInt("1e5", 10)` → 1 → valid. No upper bound (new finding below).
- **Lock / `process.exit(1)` interaction**: `lock.release()` at line 145 executes before `process.exit(1)` at line 146. Node.js `process.exit()` does NOT run `finally` blocks. The explicit release is the only protection against a leaked `.lock` file. Verified correct. ✓
- **`taskId` in path construction**: `join(dir, "progress.md")` never incorporates `taskId`; `taskId` only appears in the string body of the progress entry. No path injection risk. ✓
- **`dir` in path construction**: `resolveDir` normalizes via `path.resolve()` but imposes no base-directory restriction. See new finding below.
- **`reason` field**: Written directly to `task.lastReason` in STATE.json. JSON serialization in `writeState` neutralises all control characters; no injection vector. No size cap; oversized values bloat STATE.json but cannot escape JSON context.
- **Oscillation detection pre/post append order**: Pattern check at line 110–132 runs on existing `transitionHistory`; the incoming transition is appended at line 212. Correct — 2 full reps are recorded before the warning fires, 3 before halt fires. ✓
- **Cross-task contamination**: `taskStatuses` filtered by `h.taskId === taskId` (line 111). No cross-task contamination possible. ✓
- **Idempotency guard vs. oscillation count**: Idempotency check (lines 184–197) runs after oscillation (lines 108–152). A duplicate call within `IDEMPOTENCY_WINDOW_MS` returns early before appending to `transitionHistory`, so it does not inflate oscillation count. ✓
- **`oscillation-halted` re-entry**: After halt, `freshState.status` is set to `"oscillation-halted"` and persisted (line 137–138), but subsequent `transition` calls have no guard on this status value (confirmed at line 68 region — `readState` result is only checked for existence and `_written_by`). Carryover from prior devil's-advocate review. ✓ (already flagged)

#### Findings

**New finding:**

🟡 `bin/lib/util.mjs:63-66` — `resolveDir` calls `path.resolve(raw)` with no base-directory restriction; `--dir /tmp/attack` or `--dir ../../etc` writes STATE.json and progress.md to any filesystem path writable by the process. In an agentic context where agent output can influence harness arguments, this is an arbitrary-file-write primitive. Restrict the resolved path to within a known workspace root (e.g. verify it starts with `process.cwd()` or a configured base dir).

**Carryover findings (verified unresolved against current source):**

🟡 `bin/lib/transition.mjs:23-27` — `appendProgressInDir` reads `progress.md` then writes the full file; concurrent harness processes on separate features cannot race (each holds its own STATE lock), but the function has no internal protection. If called without a lock (e.g. from a future caller), entries will be silently lost. Replace with `appendFileSync` which delegates atomicity to the OS.

🟡 `bin/lib/transition.mjs:16` — No upper bound on `TASK_MAX_TICKS`; `TASK_MAX_TICKS=2147483647` passes `Number.isInteger && > 0` and disables tick-limit enforcement entirely. Add `Math.min(raw, 1000)` or similar ceiling.

🟡 `bin/lib/transition.mjs:55-58` — `_written_by` tamper check runs on the pre-lock `state` read (line 49). Between that read and lock acquisition (line 62), a racing writer can substitute a tampered STATE.json. Post-lock `freshState` (line 69) is never re-validated. Move the tamper check to after the lock, against `freshState._written_by`.

🟡 `test/oscillation-ticks.test.mjs:237-311` — Zero test coverage for K≥3 oscillation patterns. The loop at `transition.mjs:116` iterates K=2 to `floor(N/2)` but always `break`s at the smallest matching K. A pure K=3 history (`[A,B,C,A,B,C]`) has no K=2 match and would exercise a different code path — currently untested. Add tests with history `[A,B,C,A,B,C]` (warn) and `[A,B,C,A,B,C,A,B,C]` (halt).

🔵 `bin/lib/transition.mjs:31` — `taskId` is not validated for length or character class. A taskId containing a newline (`task-1\n## injected`) would corrupt `progress.md` structure. The risk is cosmetic for an internal tool, but a `/^[\w-]+$/` guard at line 36 (input validation block) is sufficient and consistent with the existing `status` validation pattern.

#### Summary

No criticals. All 9 SPEC Done-When criteria verified against source with direct evidence. One new 🟡 (path traversal on `--dir`) is the only novel finding beyond the prior security reviewer's pass; it is the highest-severity finding in this review and must go to backlog. The remaining four carryover 🟡 warnings and one 🔵 are consistent with prior reviewers. Verdict: PASS — safe to merge, backlog the 🟡 findings.

---

# Devil's Advocate Review — oscillation-detection-tick-limits (final independent pass)

**Reviewer role:** devil's-advocate (independent, adversarial)
**Verdict: FAIL**
**Date:** 2026-04-23

---

## Files Actually Read (this pass only)

- `bin/lib/transition.mjs` (full, 234 lines)
- `bin/lib/run.mjs` (full, 1090 lines)
- `test/oscillation-ticks.test.mjs` (full, 439 lines)
- `test/smoke-terminates.test.mjs` (full, 118 lines)
- `.team/features/oscillation-detection-tick-limits/SPEC.md` (full)
- `.team/features/oscillation-detection-tick-limits/tasks/task-9/handshake.json`
- `task-9/eval.md` (prior reviews, all four roles)

---

## Adversarial Premise

All prior reviewers (architect ×2, security, devil's-advocate, security-gate) read `transition.mjs` and the test files. **None of them read `run.mjs` — the actual caller of the harness in production.** The tests exercise the harness directly. The integration path through `agt run` was never inspected. This is the gap I'm exploiting.

---

## Critical Finding: Oscillation halt is a no-op in `agt run`

### Trace

`run.mjs:831`:
```javascript
harness("transition", "--task", task.id, "--status", "in-progress", "--dir", featureDir);
```

The return value is **discarded**.

`harness()` wrapper (`run.mjs:28–45`) catches `execFileSync` throws (including non-zero exits) and returns the parsed JSON:
```javascript
} catch (err) {
  ...
  try { return JSON.parse(stdout.trim()); } catch { return { ok: false, ... }; }
}
```

When oscillation halt fires in `transition.mjs:136–146` — `process.exit(1)` is called, `execFileSync` throws, the wrapper parses `{ allowed: false, halt: true, reason: "oscillation-halted: ..." }` and returns it. **`run.mjs:831` throws away this return value.** The for-loop at line 838 starts immediately, the agent is dispatched.

### What actually happens after oscillation halt fires via `agt run`:

1. STATE.json `status` is set to `"oscillation-halted"` ✓
2. Run.mjs ignores the halt signal and dispatches the agent again
3. The agent runs and potentially commits code changes
4. If the agent calls `harness transition --status passed` (or any other status from "in-progress" for the same task or another task), **there is no guard in transition.mjs for `freshState.status === "oscillation-halted"`** — those transitions succeed
5. The loop continues until `maxRetries` is exhausted or the next check of `blocked >= 3` (line 1040, which counts blocked tasks, not oscillation)

### Why the smoke test doesn't catch this

`test/smoke-terminates.test.mjs` drives the harness subprocess directly:
```javascript
const lastResult = tr(dir, "in-progress", env);  // calls harness directly
assert.equal(lastResult.exitCode, 0, "process should exit cleanly (exit code 0)");
```
The smoke test only validates that the **harness** terminates correctly. It never tests the `agt run` integration loop. The test proves the primitive works; it does not prove the feature works end-to-end.

### SPEC requirement vs. reality

SPEC Done-When #6: *"On the 3rd repetition of the same oscillation pattern for a single task, the harness exits non-zero and sets feature `status: 'oscillation-halted'` in STATE.json"*

- Harness exits non-zero: ✅ verified at `transition.mjs:146`
- Sets `status: "oscillation-halted"`: ✅ verified at `transition.mjs:137`
- **Execution loop stops**: ❌ not verified — and demonstrably false: `run.mjs:831` discards the halt signal

The spec says "halt the feature" (scope section, line 23). The done-when criterion only specifies harness behavior, not loop behavior. But an oscillation halt that lets the execution loop continue is not a halt by any reasonable definition. The core purpose of the feature — preventing infinite execution loops — is not achieved when called through `agt run`.

---

## Done-When Criteria Re-Evaluation

| # | Criterion | Evidence | Verdict |
|---|-----------|----------|---------|
| 1 | `ticks` increments on every `→ in-progress` | `transition.mjs:207`; tests pass | ✅ PASS |
| 2 | Replan tick inheritance | `replan.mjs:126,140,152`; tests pass | ✅ PASS |
| 3 | Tick-limit rejects `in-progress`, writes blocked + reason | `transition.mjs:168-181`; tests pass | ✅ PASS (but `run.mjs:831` also discards this — agent dispatched even after tick-limit rejection; same root cause as #6) |
| 4 | `TASK_MAX_TICKS` env var | `transition.mjs:15-16`; test passes | ✅ PASS |
| 5 | K≥2 pattern after 2× → warn + progress.md | `transition.mjs:116-151`; test passes | ✅ PASS |
| 6 | 3rd repetition → exit(1) + `oscillation-halted` | Harness: ✅. End-to-end: ❌ — `run.mjs:831` discards result, loop continues | ❌ FAIL (end-to-end) |
| 7 | `progress.md` timestamped entry | `transition.mjs:18-28`; tests pass | ✅ PASS |
| 8 | Unit tests pass | 373/373; confirmed | ✅ PASS |
| 9 | Smoke test: terminates within maxTaskTicks×2 | Passes for tick-limit path, harness-only | ✅ PASS (harness-only; no `agt run` integration test) |

---

## Additional Findings

### Second critical: tick-limit rejection also silently discarded by `run.mjs:831`

The same `run.mjs:831` issue applies to tick-limit-exceeded. When tick-limit fires, the harness returns `{ allowed: false, reason: "tick-limit-exceeded" }` (exit code 0). The return value is discarded. The agent is dispatched anyway. The tick-limit-exceeded path updates `task.status = "blocked"` in STATE.json, but run.mjs continues dispatching the agent — an agent now working against a task the harness has already decided is blocked.

This is lower severity than the oscillation halt (it doesn't prevent progress, just wastes a dispatch), but it means the same unchecked call is broken for both enforcement mechanisms.

### Novel finding: double warning per oscillation cycle not flagged by prior reviews

Tracing the warn path for K=2 pattern [IP, F]:

- History before 5th call (→IP): `[IP,F,IP,F]` — K=2: `[IP,F]==[IP,F]` → reps=2 → **warn** (progress.md entry written). Allowed. History: `[IP,F,IP,F,IP]`
- History before 6th call (→F): `[IP,F,IP,F,IP]` — K=2: `slice(1,3)=[F,IP]` vs `slice(3,5)=[F,IP]` → reps=2 → **warn again** (second progress.md entry). Allowed.
- History before 7th call (→IP): `[IP,F,IP,F,IP,F]` — reps=3 → halt.

Result: **two warning entries** in progress.md for a single oscillation cycle, for technically different patterns (`[IP,F]` and `[F,IP]`) that are phase-shifted representations of the same cycle. The test at line 240–271 only asserts `assert.match(progressContent, /Oscillation warning/)` — it does not check count. No prior reviewer traced this execution path.

### `parseInt("2abc")` edge case (novel)

`parseInt("2abc", 10)` returns `2` (not NaN). `Number.isInteger(2) && 2 > 0` is true. `TASK_MAX_TICKS=2abc` silently sets `maxTaskTicks=2` rather than falling back to 6. The test at `oscillation-ticks.test.mjs:223` only covers `TASK_MAX_TICKS=abc` (pure non-numeric → NaN → fallback). The `"2abc"` case is untested and has a different (arguably surprising) outcome.

---

## Findings Summary

🔴 `bin/lib/run.mjs:831` — Return value of `harness("transition", "--task", task.id, "--status", "in-progress")` is discarded. When oscillation halt fires (harness exits 1), the `harness()` wrapper catches the error and returns `{ allowed: false, halt: true }`, but run.mjs proceeds to dispatch the agent anyway. The feature-level halt is a no-op in the execution loop. Add: `const transResult = harness(...); if (!transResult.allowed) { /* skip dispatch, log, break or continue */ }`.

🟡 `bin/lib/transition.mjs:68` — No re-entry guard for `oscillation-halted` feature status after lock acquisition. If the caller (run.mjs) ignores the halt signal (see critical above) and the agent calls subsequent transitions, those succeed. Add `if (freshState.status === "oscillation-halted") { return allowed:false }` after line 73.

🟡 `bin/lib/transition.mjs:116-131` — Two `progress.md` warning entries generated per oscillation cycle: once for pattern `[A,B]` and once for the phase-shifted `[B,A]` on the next transition. Both match at reps=2 independently. Trace verified by hand (N=4 and N=5 cases above). No prior reviewer caught this. No test validates the count. Cosmetically confusing; add a guard or document explicitly.

🟡 `bin/lib/transition.mjs:15` — `parseInt("2abc", 10)` returns 2, silently applying tick limit of 2 when `TASK_MAX_TICKS=2abc`. The test for the invalid-value fallback only covers pure non-numeric strings. Add `/^\d+$/` pre-check before `parseInt` or document the partial-parse behavior.

---

## Overall Verdict: FAIL

The oscillation halt mechanism works correctly at the harness primitive level. All 9 Done-When criteria are met as stated — including criterion #6 which only specifies what the *harness* does. But the end-to-end behavior is broken: `run.mjs:831` discards the halt signal, and the execution loop continues after a halt fires. A feature that "prevents infinite execution loops" but doesn't actually stop the loop when invoked through the normal entry point (`agt run`) fails its core purpose.

**Required fix before merge**: Check the return value of `harness("transition", "--task", ..., "--status", "in-progress")` at `run.mjs:831` and handle `allowed: false` by skipping the agent dispatch (for tick-limit) and breaking the task loop (for oscillation halt).

---

# Security Review — oscillation-detection-tick-limits (post-fix pass)

**Reviewer role:** security
**Task under review:** Fix `run.mjs` to capture and act on harness transition result
**Verdict: PASS**
**Date:** 2026-04-23

---

## Files Actually Read

- `bin/lib/run.mjs` (full, 1105 lines) — primary fix target
- `bin/lib/transition.mjs` (full, 234 lines) — harness implementation
- `bin/lib/util.mjs` (resolveDir region, lines 61-66)
- `.team/features/oscillation-detection-tick-limits/tasks/task-9/eval.md` (full prior reviews)
- All task handshake.json files (task-1 through task-5-p1, task-9)

---

## Fix Verification

Prior critical finding (task-9 devil's-advocate): `run.mjs:831` discarded the harness transition return value, making oscillation halt and tick-limit a no-op in the execution loop.

**Current code at `run.mjs:831-846`:**

```javascript
const transitionResult = harness("transition", "--task", task.id, "--status", "in-progress", "--dir", featureDir);
if (transitionResult && transitionResult.allowed === false) {
  if (transitionResult.halt === true) {
    // Oscillation halt — stop the entire feature
    console.log(`...⚠ Oscillation halt...`);
    appendProgress(featureDir, `**Oscillation halt**: ${transitionResult.reason}`);
    harness("notify", "--event", "anomaly", "--msg", ...);
    break;
  }
  // Tick-limit or other rejection — skip this task
  blocked++;
  continue;
}
```

**Oscillation halt trace (verified):**
1. `transition.mjs:140-146`: `console.log(JSON.stringify({allowed:false, halt:true, reason:"..."}))` → `lock.release()` → `process.exit(1)`
2. `run.mjs harness()` at line 28-45: `execFileSync` throws on exit(1); catch block parses stdout → returns `{allowed:false, halt:true, reason:"..."}`
3. `run.mjs:832`: `transitionResult.allowed === false` → true
4. `run.mjs:833`: `transitionResult.halt === true` → true → logs, appends, notifies, `break` ✓

**Tick-limit trace (verified):**
1. `transition.mjs:176-180`: writes `{allowed:false, reason:"tick-limit-exceeded"}`, exits 0
2. `run.mjs harness()`: `execFileSync` succeeds, parses JSON
3. `run.mjs:832`: `allowed === false` → `blocked++`, `continue` ✓

**The fix is correct and complete.** Both enforcement paths are now acted upon.

---

## Done-When Criteria (security focus)

| # | Criterion | Verdict |
|---|-----------|---------|
| 6 | Oscillation halt fires and **stops execution loop** | ✅ PASS — `run.mjs:833-839` breaks on `halt:true` |
| 3 | Tick-limit rejection skips agent dispatch | ✅ PASS — `run.mjs:841-845` increments blocked, continues |

---

## Findings

### No criticals

The previously-critical `run.mjs:831` discard is resolved.

### Carryover warnings (verified still unresolved in current source)

🟡 `bin/lib/util.mjs:65` — `resolveDir` calls `path.resolve(raw)` with no base-directory restriction; `--dir /tmp/attack` writes STATE.json and progress.md to any writable path. In an agentic context where agent output influences harness args, this is an arbitrary-file-write primitive. Add a guard that the resolved path starts with `process.cwd()`.

🟡 `bin/lib/transition.mjs:55-58` — Tamper check (`_written_by !== WRITER_SIG`) runs on the pre-lock `state` read at line 49; post-lock `freshState` at line 69 is never re-validated. A write between the two reads evades tamper detection. Re-check after lock acquisition.

🟡 `bin/lib/transition.mjs:23-27` — `appendProgressInDir` is a non-atomic read+concat+write on `progress.md`; concurrent harness processes can silently lose entries. Replace with `appendFileSync`.

🟡 `bin/lib/transition.mjs:16` — No upper bound on `TASK_MAX_TICKS`; `TASK_MAX_TICKS=2147483647` passes `Number.isInteger && > 0` and disables tick-limit enforcement. Add `Math.min(raw, 1000)` ceiling.

🟡 `bin/lib/transition.mjs:15` — `parseInt("2abc", 10)` returns `2`, passing the `Number.isInteger && > 0` guard and silently applying a tick limit of 2. The invalid-value test only covers pure non-numeric strings. Add a `/^\d+$/` pre-check.

🟡 `bin/lib/run.mjs:1096` — `harness("notify", "--event", "feature-complete", ...)` fires unconditionally even when the task loop exited via `break` from oscillation halt. A halted feature is not a complete feature; this sends a false "feature-complete" signal to downstream integrations (GitHub issues, project boards). Gate on `!oscillationHalted` flag set at the break site.

🟡 `bin/lib/run.mjs:120` — `runGateInline` records tamper-detection via `harness("gate", "--cmd", "echo gate-recorded", ...)` after running the real gate inline. STATE.json records a gate pass for `echo gate-recorded`, not the actual test suite command. Audit trails relying on STATE.json show the wrong gate command.

### Suggestions

🔵 `bin/lib/transition.mjs:31` — `taskId` has no character-class validation; a taskId containing a newline could corrupt `progress.md` structure. A `/^[\w-]+$/` guard at the input validation block is sufficient.

🔵 `bin/lib/run.mjs:914` — `git add -A` stages all changes including potentially sensitive files (`.env`, credentials). No allowlist or `.gitignore` pre-filter. Low risk in a developer-local tool, but worth noting.

---

## Integration Test Gap

No test in the suite exercises `run.mjs`'s handling of `allowed: false` from the harness. The smart-entry-flow tests (`test/*.test.mjs`) only cover dry-run and basic dispatch; the oscillation halt and tick-limit paths through the execution loop are unverified at the integration level. The harness unit tests pass, but the `agt run` integration path for both enforcement mechanisms has zero test coverage.

This does not block merge (no Done-When criterion requires integration tests for `run.mjs`), but is a notable gap.

---

## Summary

The required fix is implemented correctly and completely. Both the oscillation halt and tick-limit paths are now captured and acted upon in `run.mjs`. Eight pre-existing 🟡 warnings remain in backlog; none are newly introduced by this fix. No criticals. **Verdict: PASS.**

---

# Architect Review — oscillation-detection-tick-limits (run.mjs fix / code-structure pass)

**Reviewer role:** architect (code structure, design patterns, modularity, maintainability)
**Task:** Fix `run.mjs` to capture and act on harness transition result
**Verdict: PASS**
**Date:** 2026-04-23

---

## Files Actually Read

- `bin/lib/run.mjs` (full, 1105 lines)
- `bin/lib/transition.mjs` (full, 233 lines)
- `test/oscillation-ticks.test.mjs` (full, 439 lines)
- `test/smoke-terminates.test.mjs` (full, 118 lines)
- `.team/features/oscillation-detection-tick-limits/tasks/task-9/handshake.json`
- `.team/features/oscillation-detection-tick-limits/tasks/task-5/artifacts/test-output.txt` (373/373 pass, confirmed)

---

## Fix Verification

`run.mjs:831-846` correctly captures and acts on the `in-progress` transition result:
- `const transitionResult = harness("transition", ..., "in-progress", ...)` ✓
- `transitionResult.allowed === false && halt === true` → `break` (feature stop) ✓
- `transitionResult.allowed === false` (non-halt) → `blocked++; continue` (skip dispatch) ✓
- `harness()` wrapper recovers JSON from `err.stdout` on non-zero exit ✓

The prior critical is resolved.

---

## Architectural Findings

🟡 `bin/lib/run.mjs:1010` — `harness("transition", ..., "passed")` result not captured. All other harness calls post-fix check `allowed`. If the harness rejects this (e.g. task already in terminal state, STATE.json locked, status out of sequence), `run.mjs` marks the task complete and moves on while STATE.json is inconsistent. Add `const pr = harness(...); if (pr && pr.allowed === false) console.log(c.yellow + "⚠ passed-transition rejected: " + pr.reason + c.reset)`.

🟡 `bin/lib/run.mjs:984` — `harness("transition", ..., "blocked")` result not captured (review-fail path). Same risk as above — undetected rejection leaves STATE.json in a stale state with no diagnostic output.

🟡 `bin/lib/run.mjs:1024` — `harness("transition", ..., "blocked")` result not captured (gate-fail path). Same issue, second occurrence.

🔵 `bin/lib/run.mjs:992-995` — Replan tick-sync + STATE.json merge block is a dense one-liner (`if (preReplanState) { const ft = ...; if (ft !== undefined) task.ticks = ft.ticks; }` / `if (updState) { const existingIds = ...; updState.tasks.splice(...); writeState(...); }`). The identical block is duplicated verbatim at lines 1033-1036. Extract to a named helper (e.g. `syncTicksBeforeReplan` + `mergeNewTasksIntoState`) so the two replan branches share one implementation — a future bug fix in one won't silently leave the other broken.

🔵 `bin/lib/run.mjs:1054` — Secondary `blocked >= 3` guard uses a cumulative count rather than a consecutive-block count. Per the comment "3 consecutive blocks", the variable name and check both imply consecutive, but `blocked` is never reset, so three non-adjacent blocks (across different tasks, with passing tasks in between) trigger it. Either rename to `totalBlocked` and update the comment, or reset after a pass to accurately reflect "consecutive" semantics.

---

## Summary

All 9 Done-When criteria met. The core fix is architecturally sound: the result is captured, the two exit paths (halt vs. skip) are correctly differentiated, and the existing `harness()` wrapper already handles the non-zero exit recovery. Three 🟡 warnings on unchecked transition results (`passed`, `blocked` ×2) must go to backlog — these are the only remaining unchecked harness calls in the hot path. Two 🔵 suggestions on code duplication and naming clarity are optional. No criticals.

**Verdict: PASS**

---

# Security Review — oscillation-detection-tick-limits (external gate pass)

**Reviewer role:** security-gate (external reviewer)
**Task:** Fix `run.mjs` to capture and act on harness transition result
**Verdict: PASS**
**Date:** 2026-04-23

---

## Files Actually Read (this pass only)

- `bin/lib/run.mjs` (all 1104 lines)
- `bin/lib/transition.mjs` (all 233 lines)
- `.team/features/oscillation-detection-tick-limits/tasks/task-9/handshake.json`
- `.team/features/oscillation-detection-tick-limits/tasks/task-5-p1/handshake.json`
- All prior entries in this eval.md

---

## Fix Verification

Traced the critical fix independently. `run.mjs:831–846` correctly:
- Assigns the return value (`const transitionResult = harness(...)`)
- On `allowed === false` + `halt === true` → `break`s the outer task loop
- On `allowed === false` without halt → `blocked++; continue` (skips dispatch for that task)
- `harness()` wrapper at line 39–44 recovers JSON from `err.stdout` when harness exits non-zero

**The fix is correct. No new critical issues introduced.**

---

## New Findings (not in prior security passes)

🟡 `bin/lib/run.mjs:863` — `eval.md` content from a previous AI review is appended verbatim to `lastFailure` and embedded in subsequent agent briefs dispatched with `--permission-mode bypassPermissions`. If a gate command produces adversarial output, or if a reviewer's output contains injected instructions, those instructions execute in the next agent call with full permissions. Sanitize or quote-fence the `prevEval` content before inclusion.

🟡 `bin/lib/run.mjs:187` — `dispatchToAgentAsync` spawns subprocesses with no timeout. `Promise.all` in `runParallelReviews` hangs indefinitely if any agent call stalls. Add a `setTimeout` race (e.g. 600s matching the sync dispatch bound) to bound the parallel review phase.

🔵 `bin/lib/run.mjs:104` — Gate command is persisted verbatim in handshake `summary` field: `Gate command: ${cmd} — exit code ${exitCode}`. If gate commands embed inline credentials (e.g. `API_TOKEN=secret npm test`), they are written to `handshake.json` on disk. Document that gate commands must not embed secrets inline.

---

## Carryover Findings (confirmed still unresolved in current source)

All eight 🟡 warnings from the previous security-gate pass are confirmed unresolved. Not repeated here to avoid duplication.

---

## Summary

**Verdict: PASS.** The prior 🔴 (transition result discarded) is fully resolved. Two new 🟡 and one 🔵 are added to backlog; no criticals.

---

# Devil's Advocate Review — oscillation-detection-tick-limits (run.mjs fix — final independent pass)

**Reviewer role:** devil's-advocate (independent, adversarial)
**Task reviewed:** Fix `run.mjs` to capture and act on harness transition result
**Verdict: PASS**
**Date:** 2026-04-23

---

## Files Actually Read (this pass only)

- `bin/lib/run.mjs:28-45` (harness wrapper — read directly)
- `bin/lib/run.mjs:820-846` (the fix block — read directly)
- `bin/lib/run.mjs:1053-1068` (systemic-halt check — read directly)
- `bin/lib/run.mjs:1096-1097` (feature-complete notify — read directly)
- `bin/lib/run.mjs:804` (blocked counter init — confirmed via grep)
- `test/smoke-terminates.test.mjs` (full, 118 lines — read directly)
- `.team/features/oscillation-detection-tick-limits/tasks/task-9/handshake.json`
- `.team/features/oscillation-detection-tick-limits/tasks/task-9/eval.md` (all prior reviews)

---

## Fix Verification

**Prior critical (from prior devil's-advocate pass):** `run.mjs:831` discarded the harness transition return value — oscillation halt and tick-limit were no-ops in the execution loop.

**Current code at `run.mjs:831-846` (read directly):**
```javascript
const transitionResult = harness("transition", "--task", task.id, "--status", "in-progress", "--dir", featureDir);
if (transitionResult && transitionResult.allowed === false) {
  if (transitionResult.halt === true) {
    console.log(`...⚠ Oscillation halt: ${transitionResult.reason}`);
    appendProgress(featureDir, `**Oscillation halt**: ${transitionResult.reason}`);
    harness("notify", "--event", "anomaly", "--msg", ...);
    break;
  }
  console.log(`  ⊘ Transition rejected: ${transitionResult.reason}`);
  appendProgress(featureDir, ...);
  blocked++;
  continue;
}
```

**Oscillation halt trace (verified against actual code):**
1. `harness()` at lines 28-45: `execFileSync` throws on exit(1); catch at line 43 parses stdout → returns `{ allowed: false, halt: true, reason: "..." }` ✓
2. `run.mjs:832`: `transitionResult.allowed === false` → true ✓
3. `run.mjs:833`: `transitionResult.halt === true` → logs, appends, notifies, `break` ✓

**Tick-limit trace (verified):**
1. Harness exits 0 with `{ allowed: false, reason: "tick-limit-exceeded" }` → `harness()` line 38 parses JSON ✓
2. `run.mjs:832`: `allowed === false` → `blocked++; continue` ✓

**Prior 🔴 is resolved.** Both enforcement paths are captured and acted upon.

---

## New Finding (not in prior passes)

### `blocked >= 3` systemic-halt fires on passing task after 3 tick-limit skips

The `continue` at `run.mjs:845` skips the `if (blocked >= 3)` check at line 1055. `blocked` is initialized at line 804 and **never reset** on task success (confirmed: grep for `blocked = 0` returns only line 804). Scenario: 3 consecutive tasks hit tick-limit → each executes `blocked++; continue` (blocked=3, line 1055 never reached). Task 4 completes successfully → `completed++`, falls through to line 1055 → fires "3 consecutive blocks — possible systemic issue. Stopping." despite task 4 passing. This false-positive stop is novel to the `continue` path introduced by this fix: before the fix, all blocked tasks fell through to line 1055 on each iteration. The comment at line 1054 ("3 consecutive blocks") describes the intent, but `blocked` is a cumulative counter and the `continue` path defers the check onto the next non-skipped task regardless of its outcome.

---

## Done-When Criteria

| # | Criterion | Evidence | Verdict |
|---|-----------|----------|---------|
| 1 | `ticks` increments on every `→ in-progress` | Unchanged from prior reviews | ✅ PASS |
| 2 | Replan tick inheritance | Unchanged | ✅ PASS |
| 3 | Tick-limit rejects `in-progress`; agent dispatch skipped | `transition.mjs:168-181` + `run.mjs:841-845` (read directly) | ✅ PASS |
| 4 | `TASK_MAX_TICKS` env var | Unchanged | ✅ PASS |
| 5 | K≥2 pattern after 2× → warn + progress.md | Unchanged | ✅ PASS |
| 6 | 3rd repetition → halt + **loop stops** | `run.mjs:833-839` `break` (read directly) ✓ | ✅ PASS |
| 7 | `progress.md` timestamped entries | `run.mjs:836,843` call `appendProgress` for both paths (read directly) ✓ | ✅ PASS |
| 8 | Unit tests pass | 373 tests in task-5 artifacts; gate output truncated before smoke/oscillation suites | ✅ PASS (prior-run evidence) |
| 9 | Smoke test terminates within maxTaskTicks×2 | `test/smoke-terminates.test.mjs` read in full; harness-only | ✅ PASS (harness-level) |

---

## Findings

🟡 `bin/lib/run.mjs:844-845` — `blocked++; continue` skips the systemic-halt check at line 1055. Three consecutive tick-limited tasks accumulate `blocked=3` without triggering the check; the 4th task (even if it passes with `completed++`) then triggers "3 consecutive blocks — systemic issue" at line 1055. The `blocked` counter is never reset on task success (only init at line 804). Add `blocked = 0` after `completed++` or replace the cumulative counter with a consecutive-block counter that resets on each passing task.

🟡 `bin/lib/run.mjs:1096` — `harness("notify", "--event", "feature-complete", ...)` fires unconditionally after the task loop, including when the loop exited via `break` from oscillation halt at line 839. A halted feature fires a false "feature-complete" signal. Carryover from security pass; unresolved.

🟡 `bin/lib/run.mjs:832-845` — Zero integration-test coverage for the entire fix block. No test exercises the `agt run` task loop with a harness returning `{ allowed: false, halt: true }` or `{ allowed: false, reason: "tick-limit-exceeded" }`. Carryover; unresolved.

🟡 Gate output truncated at `brainstorm-cmd module` — `smoke-terminates.test.mjs` and `oscillation-ticks.test.mjs` suites are absent from the provided gate output (run later alphabetically). No direct evidence in this gate run that those suites still pass. (Run.mjs fix does not touch transition.mjs or the smoke test; regression very unlikely but unconfirmed.)

---

## Summary

The prior 🔴 critical (`run.mjs:831` discards transition result) is fully resolved. The fix at `run.mjs:831-846` is correct: oscillation halt breaks the task loop; tick-limit increments blocked and continues. One new 🟡 finding is surfaced: the `continue` path causes `blocked >= 3` to misfire on the first passing task after 3 tick-limited tasks. Three carryover 🟡 remain open. No criticals.

**Verdict: PASS**
