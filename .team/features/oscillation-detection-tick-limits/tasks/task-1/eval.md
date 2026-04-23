## Parallel Review Findings

### [security]
---

## Security Review: `oscillation-detection-tick-limits`

**Overall verdict: PASS** — no criticals, 2 warnings for backlog.

---

### Findings

🟡 `bin/lib/transition.mjs:15-16` — No upper bound on `TASK_MAX_TICKS`; `TASK_MAX_TICKS=999999` disables tick-limit enforcement entirely; add `Math.min(_rawMaxTicks, 100)` to preserve the safety guarantee

🟡 `bin/lib/transition.mjs:169,207` — `Number.isInteger()` guard silently resets tick counter to 1 when `task.ticks` is a float (e.g. `1.5` in STA

### [architect]
---

**Verdict: PASS** (3 backlog warnings, 0 critical)

---

**Findings:**

🟡 `bin/lib/transition.mjs:15` — `--max-task-ticks` CLI flag required by SPEC is absent; only `TASK_MAX_TICKS` env var is implemented; add `getFlag(args, "max-task-ticks")` and prefer it over env var

🟡 `bin/lib/transition.mjs:171` — SPEC specifies `reason: "tick-limit-exceeded"` written to STATE.json but code writes `task.lastReason`; tests confirm `lastReason` works but field name diverges from SPEC; standardize

🟡 

### [devil's-advocate]
**Findings:**

🟡 `bin/lib/transition.mjs:164` — `task.retries` incremented before tick-limit check fires; when tick-limit blocks, state is written with inflated retries; subsequent `failed→in-progress` attempt may hit "max retries reached" instead of "tick-limit-exceeded"; move mutation after the tick-limit guard

🟡 `bin/lib/transition.mjs:116-132` — K loop breaks on first K=2 match; a K=3 repeating pattern (e.g. [IP,F,B] × 3) always has a K=2 sub-pattern that fires first with reps=2 (warning)