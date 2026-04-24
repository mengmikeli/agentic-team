# Architect Review — max-review-rounds-escalation

**Reviewer role:** Architect
**Verdict:** PASS

---

## Files Read

- `bin/lib/review-escalation.mjs` (full, 84 lines)
- `bin/lib/run.mjs:1–25` (imports), `1140–1299` (review + escalation paths)
- `test/review-escalation.test.mjs:1–70`, `100–210`, `240–309`
- `bin/lib/github.mjs:140–148` (`commentIssue` implementation)
- `.team/features/max-review-rounds-escalation/tasks/task-3/artifacts/test-output.txt` (gate: 593/593 pass)

---

## Overall Verdict: PASS

No critical findings. Five warnings go to backlog. Two suggestions are optional.

---

## Per-Criterion Results

### 1. Module boundary — PASS

`review-escalation.mjs` is well-bounded: 5 exported functions + 1 constant, no harness calls, no knowledge of `run.mjs` internals. The only I/O is reading `handshake-round-{r}.json` files inside `buildEscalationSummary`. `run.mjs` imports all five exports (`incrementReviewRounds`, `shouldEscalate`, `buildEscalationSummary` at line 18) and calls them at the correct integration points.

### 2. Escalation wiring — PASS

Confirmed at `run.mjs:1282–1291`: `shouldEscalate(task)` → `buildEscalationSummary(taskDir, task.title, task.reviewRounds)` → `commentIssue(task.issueNumber, escalationSummary)` (guarded) → `harness transition --status blocked` → `appendProgress` → `break`. Both serial (line 1167) and parallel (line 1250) review paths call `incrementReviewRounds` and persist `reviewRounds` to STATE.json before the escalation check runs.

### 3. GitHub comment deliverable — PASS

`buildEscalationSummary` reads `handshake-round-1..N.json` from `taskDir`, passes all findings through `deduplicateFindings`, and builds the comment via `buildEscalationComment`. Comment includes task title (markdown heading), round count ("blocked after N consecutive review FAIL round(s)"), and a deduplicated findings table. `commentIssue` at `github.mjs:145` is synchronous — no fire-and-forget risk. The guard `if (task.issueNumber)` prevents crash when no issue is linked.

### 4. Implicit filename coupling — WARNING (architectural concern)

The string `handshake-round-${r}.json` appears at three independent sites with no shared constant:
- `review-escalation.mjs:72` (reader — uses loop var `r`)
- `run.mjs:1198` (writer, serial path — uses `task.reviewRounds`)
- `run.mjs:1276` (writer, parallel path — uses `task.reviewRounds`)

If the format changes, all three must be updated manually with no compile-time guard. The owning module (`review-escalation.mjs`) should export a `roundHandshakePath(taskDir, round)` helper to make the coupling explicit and centralized.

### 5. State persistence duplication — WARNING (architectural debt)

This feature added two copies of the read-state → find-task → assign-field → write-state pattern (lines 1168–1172 and 1251–1255). Pre-existing copies are at 1148–1152 and 1226–1230. There are now four identical blocks. Each carries a silent null-discard: if `rrTask` is absent from the fresh snapshot, the field update is silently dropped with no diagnostic. The pattern compounds with every new task field. A `persistTaskField(featureDir, taskId, field, value)` helper would centralize the null-discard handling.

### 6. NaN guard — WARNING (correctness)

`review-escalation.mjs:15`: `typeof task.reviewRounds !== "number"`. Since `typeof NaN === "number"` is `true`, a NaN value passes the guard, stays NaN after `+= 1`, and `shouldEscalate` permanently evaluates `NaN >= 3 === false` — the escalation cap never fires. Mitigated in practice by STATE.json HMAC tamper detection, but the guard is semantically wrong. Fix: `!Number.isFinite(task.reviewRounds)`.

### 7. Reason string drift after crash recovery — WARNING (spec violation on crash path)

`run.mjs:1287` uses `` `review-escalation: ${task.reviewRounds} rounds exceeded` `` where `task.reviewRounds` is the post-increment live value. On the nominal 3-round path this equals 3 and matches the spec. After crash recovery where STATE.json already carries `reviewRounds: 3`, the next review fail increments to 4 and emits `"review-escalation: 4 rounds exceeded"` — breaking any automation that parses `lastReason` against the spec-mandated constant string. Fix: `` `review-escalation: ${MAX_REVIEW_ROUNDS} rounds exceeded` ``.

### 8. Warnings included in "critical findings" comment — WARNING (undocumented spec drift)

`run.mjs:1197` (serial) and `run.mjs:1275` (parallel): `findings.filter(f => f.severity === "critical" || f.severity === "warning")`. The SPEC specifies "critical findings". Warnings appear in the GitHub escalation comment with no explanation. Either narrow to critical-only or document the intentional expansion with a comment.

### 9. All tests pass — PASS

593/593 tests pass (gate output confirmed). `incrementReviewRounds`, `shouldEscalate`, `deduplicateFindings`, `buildEscalationComment`, `buildEscalationSummary`, and `MAX_REVIEW_ROUNDS` all have unit and integration coverage.

### 10. Double-icon claim from prior rounds — NOT PRESENT

Prior reviewers flagged a double-icon in the escalation table. Verified against current code: `buildEscalationComment:54` renders `| ${f.severity} | ${f.text.replace(/\|/g, "\\|")} |`. `f.severity` is the string "critical"/"warning"/"suggestion" — no emoji prepended. The table renders `| critical | 🔴 foo:1 — msg |`. No double icon. Issue was fixed before this gate passed.

---

## Findings

🟡 bin/lib/review-escalation.mjs:72 — Template string `handshake-round-${r}.json` not shared with writer sites at `run.mjs:1198` and `run.mjs:1276`; three independent string literals create silent divergence if format changes; export `roundHandshakePath(taskDir, round)` from `review-escalation.mjs` to centralize the coupling in the owning module

🟡 bin/lib/run.mjs:1168 — Read-state→find-task→assign-field→write-state block duplicated at lines 1148–1152, 1168–1172, 1226–1230, and 1251–1255; this feature added two new copies, bringing the count to four; each silently discards the update when `rrTask` is null; extract `persistTaskField(featureDir, taskId, field, value)` before a fifth copy appears

🟡 bin/lib/review-escalation.mjs:15 — `typeof NaN === "number"` is true; a NaN `reviewRounds` passes the init guard, stays NaN after `+= 1`, and `shouldEscalate` permanently returns false (`NaN >= 3 === false`); replace guard with `!Number.isFinite(task.reviewRounds)`

🟡 bin/lib/run.mjs:1287 — Reason string uses live `task.reviewRounds` (post-increment); after crash-recovery with `reviewRounds: 3` already in STATE.json, a fourth review fail increments to 4 and emits `"review-escalation: 4 rounds exceeded"` — violating the spec-mandated string; fix: use `` `review-escalation: ${MAX_REVIEW_ROUNDS} rounds exceeded` ``

🟡 bin/lib/run.mjs:1197 — `findingsList` filter includes warnings (`severity === "critical" || severity === "warning"`); SPEC specifies "deduplicated critical findings"; warnings silently appear in the GitHub escalation comment with no documentation; add a comment explaining the intentional inclusion or narrow to critical only

🔵 test/review-escalation.test.mjs:243 — Integration suite verifies pure-function logic only; actual `run.mjs` wiring (`commentIssue` at line 1285, `appendProgress` at line 1289, harness transition at line 1286) has no automated coverage; `run.mjs` escalation block could be miswired without any test failing

🔵 bin/lib/review-escalation.mjs:27 — `shouldEscalate`'s `maxRounds` optional param is test-only but lives on the public function signature; add `// test-only override — do not wire from external config` to signal it is not a runtime configuration seam
