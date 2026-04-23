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
