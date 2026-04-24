## Parallel Review Findings

### [security]
---

**Findings:**

🟡 `bin/lib/iteration-escalation.mjs:17` — `[...layers]` throws TypeError for null/non-iterable `layers`; change to `Array.isArray(layers) ? [...layers] : []`

🟡 `bin/lib/iteration-escalation.mjs:34` — `entry.iteration` has no null guard on `entry`; a null element in a STATE.json-sourced `gateWarningHistory` array crashes the run loop; add `if (!entry || typeof entry !== 'object') continue;`

🔵 `bin/lib/iteration-escalation.mjs:13` — `task` parameter has no null guard; `tas

### [architect]
---

**Overall verdict: PASS** (4 warnings → backlog, 1 suggestion)

**Findings:**

🟡 bin/lib/run.mjs:1088 — WARN+escalation logic copy-pasted verbatim between `review` path (lines 1088–1109) and `multi-review` path (lines 1158–1179); changes must be made in two places. Extract to a shared helper.

🟡 bin/lib/run.mjs:1094 — `attempt` counter resets to 1 on each `_runSingleFeature` call; crash+recovery produces duplicate `{iteration:1}` entries that Set-deduplicate to one value, delaying escalat

### [devil's-advocate]
---

**Verdict: PASS** (2 warnings to backlog)

---

**Findings:**

🟡 `test/iteration-escalation.test.mjs:152` — Integration tests simulate the run-loop using imported functions but never call `run.mjs`; a broken wiring (e.g., `recordWarningIteration` removed or moved) passes all 508 tests silently; add one harness-CLI or spy-based test that exercises the actual `run.mjs` escalation path

🟡 `bin/lib/run.mjs:1070` — The "never retried a third time" claim is flow-scoped: `light-review` (1–2 task