# Simplicity Review — max-review-rounds-escalation

**Reviewer role:** Simplicity
**Round:** 3
**Verdict:** PASS

---

## Files I read

- `bin/lib/review-escalation.mjs` (all 84 lines)
- `bin/lib/run.mjs` lines 1155–1299 (escalation wiring in both review paths)
- `bin/lib/synthesize.mjs` (`parseFindings` implementation)
- `tasks/task-2/eval.md` (prior round findings)
- `tasks/task-3/artifacts/test-output.txt` (gate output)

---

## Criterion results

### 1. Task title in comment
**PASS** — `buildEscalationSummary(taskDir, task.title, task.reviewRounds)` at `run.mjs:1284` passes `task.title`; `buildEscalationComment` embeds it in the `## Review-Round Escalation: {taskTitle}` header.

### 2. Rounds attempted in comment
**PASS** — `reviewRounds` embedded in the body: "blocked after N consecutive review FAIL round(s)".

### 3. Deduplicated critical findings from each round
**PARTIAL PASS** — `deduplicateFindings` (review-escalation.mjs:36) correctly deduplicates by `f.text`. However `run.mjs:1197` stores `f.severity === "critical" || f.severity === "warning"` in `findingsList` — warnings are included even though the SPEC specifies only critical findings. Not a blocker but undocumented expansion.

### 4. GitHub comment posted
**PASS** — `commentIssue(task.issueNumber, escalationSummary)` at `run.mjs:1285`, guarded by `task.issueNumber`.

### 5. Tests pass
**PASS** — 593/593 tests pass. `buildEscalationComment`, `buildEscalationSummary`, `deduplicateFindings`, `shouldEscalate`, `incrementReviewRounds` all have unit and integration coverage.

### 6. Rendering correctness
**FAIL-ish (backlog)** — `parseFindings` keeps the leading emoji in `f.text` (e.g. `🔴 file:1 — msg`). `buildEscalationComment:54` prepends another icon + severity label before it, producing `| 🔴 critical | 🔴 file:1 — msg |`. Double icon on every row. Unaddressed from round 2.

---

## Findings

🟡 bin/lib/review-escalation.mjs:54 — Double icon: `f.text` from `parseFindings` already leads with the severity emoji; severity column renders `| 🔴 critical | 🔴 foo:1 — msg |` in every GitHub table row; drop the icon from the severity column or strip the leading emoji from `f.text`

🟡 bin/lib/review-escalation.mjs:73 — `handshake-round-N.json` is an undocumented artifact type: up to 3 extra files per task with no manifest entry, no audit coverage, no schema; accumulate findings under `task.roundFindings[]` in STATE.json to eliminate the implicit file format

🟡 bin/lib/run.mjs:1287 — `task.reviewRounds` used in reason string; crash-recovery with `reviewRounds: 3` in STATE.json causes next fail to produce "4 rounds exceeded" instead of spec-mandated "3 rounds exceeded"; replace with backtick template using `MAX_REVIEW_ROUNDS`

🟡 bin/lib/run.mjs:1167 — readState → findTask → mutate → writeState block duplicated verbatim at lines 1168–1172 and 1251–1255, each with silent null-discard when task absent; extract `persistTaskField(featureDir, taskId, field, value)` before a third copy appears

🟡 bin/lib/review-escalation.mjs:15 — `typeof NaN === "number"` is true; NaN `reviewRounds` bypasses the init guard, stays NaN after `+= 1`, and `shouldEscalate` permanently returns false (`NaN >= 3 === false`); replace guard with `!Number.isFinite(task.reviewRounds)`

🔵 bin/lib/run.mjs:1197 — `findingsList` filter includes warnings (`f.severity === "critical" || f.severity === "warning"`) but SPEC says "critical findings"; add a comment explaining the intentional expansion or narrow to critical only

🔵 bin/lib/review-escalation.mjs:27 — `shouldEscalate(task, maxRounds)` optional param is test-only infrastructure on the public API surface; add `// test-only override — do not configure from external callers` to the JSDoc to prevent runtime misuse

---

## Summary

The core feature is correctly implemented and all 593 tests pass. `buildEscalationSummary` reads per-round handshakes, `deduplicateFindings` correctly deduplicates, and `commentIssue` posts the result. The main simplicity concerns (double icon, undocumented artifact files, NaN guard, duplicated state-write pattern, wrong round number in reason string) are all in backlog from prior rounds and remain unaddressed — they go back to backlog per the review protocol.

**Overall verdict: PASS** (5 warnings → backlog, 2 suggestions → optional)
