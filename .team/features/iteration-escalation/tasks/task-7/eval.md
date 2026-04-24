## Parallel Review Findings

### [security]
---

## Findings

🟡 `bin/lib/run.mjs:1108` — `gateWarningHistory` is written to STATE.json from in-memory and reloaded on crash recovery without validating layer names; a crafted STATE.json could inject entries to force premature escalation on the next run. Whitelist layer names against the known compound-gate enum when deserializing from disk.

🟡 `bin/lib/iteration-escalation.mjs:35` — `entry.iteration` is added to a Set with no type check; `null`/`NaN` values from a tampered STATE.json cause

### [architect]
---

**Findings:**

🟡 bin/lib/run.mjs:1083 — WARN recording + escalation check is duplicated verbatim between `review` (lines 1101–1122) and `multi-review` (lines 1171–1192) phases; a format change to the synthetic finding or progress.md entry requires two in-sync edits. Extract to a shared helper.

🟡 bin/lib/run.mjs:1153 — When escalation fires in the `review` phase, the `multi-review` phase still runs unconditionally: parallel agent reviews are dispatched and `recordWarningIteration` is call

### [devil's-advocate]
---

**Verdict: PASS**

Here are the findings:

🟡 `bin/lib/run.mjs:1153` — Multi-review phase runs unconditionally even after the single-review phase has already set `escalationFired = true`; `recordWarningIteration` is called a second time with the same attempt number (line 1177), adding a duplicate history entry and triggering a redundant `checkEscalation`. Set deduplication prevents incorrect behavior but real agent calls are wasted. Guard with `if (!escalationFired)` before the multi-review