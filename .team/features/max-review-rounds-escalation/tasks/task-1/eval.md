# Security Review — max-review-rounds-escalation

**Reviewer role:** security
**Date:** 2026-04-24
**Overall verdict:** PASS

---

## Files Read

- `.team/features/max-review-rounds-escalation/tasks/task-1/handshake.json`
- `.team/features/max-review-rounds-escalation/tasks/task-2/handshake.json`
- `.team/features/max-review-rounds-escalation/tasks/task-2/artifacts/test-output.txt`
- `bin/lib/review-escalation.mjs` (full file, 85 lines)
- `bin/lib/run.mjs:1120–1299` (review and escalation paths)
- `test/review-escalation.test.mjs` (full file, 309 lines)

---

## Per-Criterion Results

### 1. Input validation — escalation path does not accept external input — PASS

Evidence: `run.mjs:1284` calls `buildEscalationSummary(taskDir, task.title, task.reviewRounds)`. All three arguments are derived from internal harness state (`featureDir` → `taskDir`, `STATE.json` task object). `STATE.json` is tamper-protected (HMAC integrity check confirmed by test output line 407: "rejects manually edited STATE.json"). No path reaches this code from user-supplied network or CLI input.

The `taskDir` → `roundPath` construction at `review-escalation.mjs:73` is `join(taskDir, \`handshake-round-${r}.json\`)` where `r` is a loop integer bounded by `task.reviewRounds` (max 3 by `MAX_REVIEW_ROUNDS`). No path traversal vector exists.

### 2. GitHub comment content — no injection of untrusted data — PASS with caveats

Evidence: `buildEscalationComment` at `review-escalation.mjs:55` pipe-escapes `f.text` before inserting into the markdown table (`f.text.replace(/\|/g, "\\|")`). GitHub's rendering pipeline sanitizes XSS. The comment body is purely internal-machine-generated content (LLM review output routed through `parseFindings` → `handshake-round-N.json` → `buildEscalationSummary`).

Caveat: `f.severity` at line 55 is inserted unescaped into `| ${icon} ${f.severity} |`. Severity values originate from `parseFindings()` which constrains them to `"critical"`, `"warning"`, or `"suggestion"`, so realistically benign. Similarly, `taskTitle` at line 60 is inserted raw into the markdown heading without escaping; task titles come from tamper-protected STATE.json.

### 3. Escalation bypass via NaN — PARTIAL PASS

Evidence: `incrementReviewRounds` at `review-escalation.mjs:15` guards with `typeof task.reviewRounds !== "number"`. `typeof NaN === "number"` is `true`, so a NaN value passes this guard. `NaN += 1` stays `NaN`. `shouldEscalate` at line 28 evaluates `(NaN ?? 0) >= 3` = `NaN >= 3` = `false` — escalation never fires. This creates a theoretical permanent bypass.

Realistic attack surface: `reviewRounds` can only reach this state if STATE.json is compromised with a NaN value. STATE.json tamper detection (HMAC) blocks manual edits (test line 407 confirms). No code path within the harness sets `reviewRounds` to NaN. Risk is low but the guard is incorrect.

### 4. JSON parsing of handshake-round files — PASS

Evidence: `buildEscalationSummary:76` wraps `JSON.parse(readFileSync(...))` in `try/catch`. Malformed files are silently skipped, producing an empty findings list rather than a crash. The `if (Array.isArray(hs.findingsList))` guard at line 77 prevents prototype pollution via a non-array `findingsList`. Items within the array are not further validated (see finding below), but the worst outcome is undefined values appearing in a GitHub comment — not a security issue.

### 5. commentIssue guarded against null/undefined — PASS

Evidence: `run.mjs:1285`: `if (task.issueNumber) commentIssue(task.issueNumber, escalationSummary)`. This correctly prevents calling with falsy values. `task.issueNumber` originates from the GitHub issue-creation response, stored in tamper-protected STATE.json.

### 6. No secrets in escalation artifacts — PASS

Evidence: `handshake-round-N.json` files at `run.mjs:1197–1198` contain only finding text, severity strings, and metadata copied from the review handshake. No tokens, keys, or env vars are written into these files. `escalationSummary` is built solely from finding text and metadata — no credential leakage path.

---

## Findings

🟡 bin/lib/review-escalation.mjs:15 — `typeof NaN === "number"` is `true`; a NaN `reviewRounds` bypasses the init guard, keeps `NaN` after increment, and makes `shouldEscalate` permanently return `false` (`NaN >= 3 === false`); replace guard with `!Number.isFinite(task.reviewRounds)` to close the bypass

🔵 bin/lib/review-escalation.mjs:77 — `findingsList` items are spread into `allFindings` without field validation; if an item lacks `text` or `severity`, `deduplicateFindings` uses `undefined` as the dedup key and `buildEscalationComment` renders `| 🔵 undefined | undefined |` in the GitHub comment; add `if (typeof f.text === "string" && f.severity)` guard before push

🔵 bin/lib/review-escalation.mjs:55 — `f.severity` is concatenated directly into the markdown table cell (`| ${icon} ${f.severity} |`) without sanitization; if a future code path produces a severity string containing `\n` or `|`, extra rows could be injected into the GitHub comment; add severity to an allowlist: `const safeSeverity = ["critical","warning","suggestion"].includes(f.severity) ? f.severity : "unknown"`

---

## Summary

The previous review's two critical gaps (missing `commentIssue` call and missing integration test for 3 FAILs → blocked) have both been addressed. `run.mjs:1284–1285` now calls `buildEscalationSummary` and `commentIssue` unconditionally in the escalation path. The integration test at `test/review-escalation.test.mjs:243–309` simulates the full 3-FAIL loop and asserts `status === "blocked"` and `lastReason === "review-escalation: 3 rounds exceeded"`. All 581 tests pass (gate handshake confirms exit code 0).

The one security-relevant weakness is the NaN bypass in `incrementReviewRounds` — rated 🟡 because STATE.json is tamper-protected, making exploitation require a pre-existing HMAC bypass, but the guard is straightforwardly wrong and should be fixed before the pattern is copied.

No critical findings. **PASS.**

---

# Simplicity Review — max-review-rounds-escalation

**Reviewer role:** simplicity
**Date:** 2026-04-24
**Overall verdict:** PASS

---

## Files Read

- `bin/lib/review-escalation.mjs` (full file, 85 lines)
- `bin/lib/run.mjs:1–25` (imports), `1120–1299` (review + escalation paths)
- `test/review-escalation.test.mjs` (full file, 309 lines)
- `.team/features/max-review-rounds-escalation/tasks/task-1/handshake.json`
- `.team/features/max-review-rounds-escalation/tasks/task-2/handshake.json`
- `.team/features/max-review-rounds-escalation/tasks/task-2/artifacts/test-output.txt`

---

## Per-Criterion Results

### 1. Core module (`review-escalation.mjs`) complexity — PASS

All five functions are single-purpose and small: `incrementReviewRounds` (6 lines), `shouldEscalate` (2 lines), `deduplicateFindings` (7 lines), `buildEscalationComment` (9 lines), `buildEscalationSummary` (14 lines). No unnecessary indirection. Each abstraction earns its keep.

### 2. Escalation block in `run.mjs` — PASS with warnings

`run.mjs:1282–1292` is the escalation block. It is flat, linear, and follows the same pattern as the adjacent iteration-escalation block. The logic is easy to follow. Two warnings below concern the surrounding state-write duplication and the new artifact format it introduces.

### 3. State write pattern growth — WARNING

The feature added two copies of a 6-line read-state → find-task → mutate-field → write-state block (lines 1168–1172 and 1251–1255). This pattern already existed at lines 1148–1152 and 1226–1230 before this feature. There are now four identical blocks, each carrying the same silent-discard bug (if `rrTask` is null, the write is silently skipped with no diagnostic). The pattern grows with each new task field.

### 4. `handshake-round-N.json` artifact type — WARNING

`buildEscalationSummary` reads `handshake-round-1.json` through `handshake-round-N.json`. These files are written at `run.mjs:1197–1199` and `1274–1277`. They are:
- Not registered in any harness schema
- Not surfaced by `agt audit` or any manifest
- Not cleaned up by any tooling

A task that hit 3 review rounds will have four JSON files in its directory (`handshake.json`, `handshake-round-1.json`, `handshake-round-2.json`, `handshake-round-3.json`) with no explanation. Future developers will not know which are authoritative. The same result (deduplicated per-round findings) could be achieved by accumulating `findingsList` in STATE.json under `task.roundFindings[]` — zero new files, zero new file format.

### 5. Double emoji in escalation comment table — WARNING

`buildEscalationComment:54` constructs rows as `| ${icon} ${f.severity} | ${f.text} |`. The `icon` is derived from `f.severity` (e.g., `"🔴"`). But `f.text` is the raw finding line as stored in `handshake-round-N.json`, which already starts with the same emoji (e.g., `"🔴 bin/lib/run.mjs:42 — Missing test"`). Rendered table rows appear as:

```
| 🔴 critical | 🔴 bin/lib/run.mjs:42 — Missing test |
```

The emoji appears twice. The test at line 172 checks only that `"🔴 critical"` and `"foo:1 — bad thing"` exist as substrings, so this double-render is not caught.

### 6. `shouldEscalate`'s `maxRounds` optional param — SUGGESTION

The `maxRounds` parameter exists solely for test isolation (no caller in `run.mjs` passes it). Its presence on the public function signature invites future callers to wire it from external config, which would bypass the 3-round policy. A JSDoc `// @param {number} [maxRounds] - Test-only override; do not wire from external input` would prevent this.

---

## Findings

🟡 bin/lib/run.mjs:1168 — State write pattern (readState → findTask → mutate → writeState) is now duplicated at lines 1148-1152, 1168-1172, 1226-1230, and 1251-1255; each copy carries the same silent-discard risk if task is not found; extract `persistTaskField(featureDir, taskId, field, value)` before a 5th copy is added

🟡 review-escalation.mjs:54 — `buildEscalationComment` prepends `icon` from `f.severity` to the severity column, but `f.text` already leads with the same emoji; table rows render `| 🔴 critical | 🔴 foo:1 — bar |` — double icon in every row of the GitHub escalation comment; drop the icon from the severity column or strip it from the text column

🟡 review-escalation.mjs:73 — `handshake-round-N.json` is a new artifact type not registered in harness schema, `agt audit`, or any manifest; a task with 3 review rounds leaves 4 undocumented JSON files with no legend; accumulate `findingsList` in STATE.json under `task.roundFindings[]` instead to eliminate N extra files and the new implicit file format

🔵 review-escalation.mjs:27 — `shouldEscalate`'s `maxRounds` optional param is test-only but lives on the public signature, inviting callers to bypass the 3-round policy at runtime; add `// test-only override; do not wire from external config` JSDoc to signal it is not a runtime seam

🔵 test/review-escalation.test.mjs:244 — Suite labeled "integration: 3 consecutive review FAILs → task blocked" but it simulates the logic in-memory with no harness I/O, disk state, or run.mjs wiring; rename to "simulation: pure-function chain" to accurately scope what is covered

---

## Summary

The `review-escalation.mjs` module is appropriately small and well-factored — 5 functions, 85 lines, no unnecessary abstraction. The escalation block in `run.mjs` is clean and follows established patterns.

The three warnings are real costs that grow over time: the state-write duplication worsens with each new task field added; the unregistered `handshake-round-N.json` format will silently confuse future developers inspecting task directories; and the double-icon in GitHub comments degrades the primary user-visible deliverable. None block merge, but all three should be tracked in the backlog.

No critical simplicity findings. **PASS.**

---

# Tester Review — max-review-rounds-escalation (round 3)

**Reviewer role:** tester
**Date:** 2026-04-24
**Overall verdict:** PASS

---

## Files Read

- `.team/features/max-review-rounds-escalation/tasks/task-1/handshake.json`
- `.team/features/max-review-rounds-escalation/tasks/task-2/handshake.json`
- `.team/features/max-review-rounds-escalation/tasks/task-2/artifacts/test-output.txt`
- `bin/lib/review-escalation.mjs` (full file, 84 lines)
- `test/review-escalation.test.mjs` (full file, 309 lines)
- `bin/lib/run.mjs:1155–1310` (review and escalation paths)
- `bin/lib/github.mjs:140–148` (`commentIssue` signature)

---

## Per-Criterion Results

### 1. `task.reviewRounds` increments on review FAIL only — PASS
Evidence: `incrementReviewRounds` at `review-escalation.mjs:14–18`. Called at `run.mjs:1167` (serial path) and `run.mjs:1250` (parallel path), both inside `if (synth.critical > 0)` blocks. Test at `test/review-escalation.test.mjs:84–100` confirms caller-controlled semantics. 581/581 pass.

### 2. Block at `reviewRounds >= 3` with correct `lastReason` — PASS (nominal path)
Evidence: `shouldEscalate` at `review-escalation.mjs:27–29`, called at `run.mjs:1282`. Reason string at `run.mjs:1287` uses live `task.reviewRounds`; on nominal path (no crash recovery) equals 3 — matches SPEC. Crash-recovery path produces wrong string (see 🟡 finding).

### 3. GitHub comment posted on escalation — PASS
Evidence: `run.mjs:1284–1285` calls `buildEscalationSummary` then `if (task.issueNumber) commentIssue(...)`. `commentIssue` is synchronous (`github.mjs:145`) — no fire-and-forget risk. This was the primary critical gap in prior rounds; now present.

### 4. `buildEscalationSummary` + deduplication — PASS
Evidence: `review-escalation.mjs:70–84` reads `handshake-round-{r}.json` for r=1..reviewRounds, collects `findingsList`, calls `deduplicateFindings`. Per-round files written at `run.mjs:1196–1199` (serial) and `run.mjs:1274–1277` (parallel). Three unit tests at `test/review-escalation.test.mjs:192–241` cover dedup, missing-file tolerance, and fallback.

### 5. `progress.md` escalation entry — PASS
Evidence: `run.mjs:1289` calls `appendProgress` with task title and round count inside escalation block.

### 6. Existing limits fire independently — PASS
Evidence: Escalation block at `run.mjs:1282` is a new `if` before existing `if (escalationFired)` at `run.mjs:1293`. Gate output: 581/581 pass including tick-limit and oscillation tests.

### 7. Unit tests — PASS
Evidence: 26 unit tests across `incrementReviewRounds` (5), `shouldEscalate` (8), `MAX_REVIEW_ROUNDS` (1), `deduplicateFindings` (5), `buildEscalationComment` (4), `buildEscalationSummary` (3). All pass.

### 8. Integration test: 3 FAILs → blocked — PASS (with caveat)
Evidence: `test/review-escalation.test.mjs:243–309` — 3 tests simulate the run loop in-memory, asserting `task.status === "blocked"`, `task.lastReason === "review-escalation: 3 rounds exceeded"`, and progress entry written. All pass. Caveat: simulates pure-function calls, not actual `run.mjs` wiring path.

---

## Findings

🟡 bin/lib/review-escalation.mjs:15 — `typeof NaN === "number"` is true; corrupt `NaN` passes the guard, stays `NaN` after `+= 1`, and `shouldEscalate` permanently returns false (`NaN >= 3` is always false); replace guard with `!Number.isFinite(task.reviewRounds)` (flagged in rounds 1 and 2 — still unaddressed)

🟡 bin/lib/run.mjs:1287 — Reason string interpolates live `task.reviewRounds`; crash-recovery with `reviewRounds = 3` already in STATE.json causes a 4th review FAIL to increment to 4 and produce `"review-escalation: 4 rounds exceeded"` instead of the SPEC-mandated `"review-escalation: 3 rounds exceeded"`; fix with `` `review-escalation: ${MAX_REVIEW_ROUNDS} rounds exceeded` `` (flagged in round 2 — still unaddressed)

🟡 bin/lib/run.mjs:1170 — When `rrTask` is null (task absent from fresh STATE.json snapshot), `reviewRounds` write is silently dropped; identical silent-discard at `run.mjs:1254` (parallel-review path); add `console.warn("[review-rounds] task not found in state — reviewRounds not persisted")` to both sites (flagged in rounds 1 and 2 — still unaddressed)

🔵 test/review-escalation.test.mjs:243 — Integration tests simulate run-loop behavior with pure-function calls only; the actual `run.mjs` wiring (that `incrementReviewRounds` fires in the review-fail branch, that `commentIssue` fires with `buildEscalationSummary` output, that `harness("transition", "--status", "blocked")` is invoked) has no automated coverage; `run.mjs` escalation block could be miswired without any test failing

🔵 bin/lib/review-escalation.mjs:38 — `deduplicateFindings` does not guard against `null`/`undefined` `f.text`; downstream `buildEscalationComment:55` calls `f.text.replace(...)` which throws `TypeError` if `text` is null; add `if (!f || f.text == null) return false` before the Set lookup

---

## Summary

The two critical gaps from prior rounds — missing `commentIssue` call and missing integration test — are now addressed. `buildEscalationSummary`, `deduplicateFindings`, and `buildEscalationComment` are all implemented and unit-tested. The 581/581 test suite confirms no regression.

Three recurring warnings from prior rounds remain unaddressed: NaN guard, crash-recovery reason string, and silent-discard on null task. None block the nominal path. The integration test exercises pure functions only, leaving `run.mjs` wiring untested by automation.

No critical findings. **PASS.**

---

# Architect Review — max-review-rounds-escalation

**Reviewer role:** architect
**Date:** 2026-04-24
**Overall verdict:** PASS

---

## Files Read

- `.team/features/max-review-rounds-escalation/tasks/task-1/handshake.json`
- `.team/features/max-review-rounds-escalation/tasks/task-2/handshake.json`
- `.team/features/max-review-rounds-escalation/tasks/task-2/artifacts/test-output.txt`
- `bin/lib/review-escalation.mjs` (full file, lines 1–85)
- `test/review-escalation.test.mjs` (full file, lines 1–309)
- `bin/lib/run.mjs:1140–1299` (review + escalation paths)
- `bin/lib/github.mjs:145–148` (commentIssue signature)

---

## Note on Prior Parallel Review (task-1 handshake, 8 critical findings)

The prior parallel review's 8 critical findings were verified directly against the current code. All 8 are false:

| Prior claim | Reality |
|---|---|
| "No `commentIssue` call in escalation block" | FALSE — `run.mjs:1285` has it |
| "`buildEscalationSummary` does not exist" | FALSE — `review-escalation.mjs:70–84` exports it |
| "No integration test for '3 FAILs → task blocked'" | FALSE — `test/review-escalation.test.mjs:243–308` contains it |

The compound gate's "fabricated-refs" trip was correct.

---

## Per-Criterion Results

### 1. Module boundaries — PASS

`review-escalation.mjs` is a well-bounded module: no harness calls, no knowledge of `run.mjs` internals, I/O limited to reading local task-dir files in `buildEscalationSummary`. `run.mjs` imports all five exports and calls them in the correct order. Boundary discipline is sound.

### 2. Increment-on-review-FAIL-only — PASS

`run.mjs:1165–1167` and `run.mjs:1248–1250` call `incrementReviewRounds` only inside `if (synth.critical > 0)`, after the review phase only. Build-fail and gate-fail paths do not reach it. Test at `review-escalation.test.mjs:84–100` verifies caller-controlled semantics.

### 3. Escalation block ordering — PASS (with reservation)

`run.mjs:1282–1292`: `shouldEscalate(task)` → `buildEscalationSummary` → `commentIssue` → `harness transition --status blocked` → `appendProgress` → `break`. Order is correct; `break` fires after all side effects. `commentIssue` is synchronous (`github.mjs:145`), no async ordering issue.

Reservation: reason string at `run.mjs:1287` uses `task.reviewRounds` (post-increment). After crash-recovery where STATE.json already carries `reviewRounds: 3`, the next review fail increments to 4, producing `"review-escalation: 4 rounds exceeded"` instead of the spec string.

### 4. Implicit coupling via filename convention — WARNING

`buildEscalationSummary` reads `handshake-round-${r}.json` (`review-escalation.mjs:73`). The identical template string is written at `run.mjs:1198` and `run.mjs:1276`. Three independent sites share this convention with no shared constant — silent divergence if the format changes.

### 5. State persistence duplication — WARNING

Four identical read-state→find-task→mutate→write-state blocks at `run.mjs:1148–1152, 1168–1172, 1226–1230, 1251–1255`. This is the feature's highest-risk architectural debt: the pattern amplifies with every new task field added.

### 6. No regression — PASS

581/581 tests pass. New escalation code sits in a new `if` block with independent `break`. No existing code paths were modified.

---

## Findings

🟡 bin/lib/run.mjs:1287 — Reason string uses `task.reviewRounds` (post-increment); after crash-recovery with `reviewRounds: 3` in STATE.json, next review fail produces `"review-escalation: 4 rounds exceeded"` instead of the spec-mandated string; fix: use `` `review-escalation: ${MAX_REVIEW_ROUNDS} rounds exceeded` ``

🟡 bin/lib/run.mjs:1168 — Read-state→find-task→assign-field→write-state block duplicated verbatim at four sites (1148–1152, 1168–1172, 1226–1230, 1251–1255); each carries the same silent null-discard; extract `persistTaskField(featureDir, taskId, field, value)` before a fifth copy is added

🟡 bin/lib/run.mjs:1171 — If `rrTask` is `null`, `reviewRounds` update is silently dropped; same discard at line 1254 (parallel path); add `console.warn("[review-rounds] task not found in state — reviewRounds not persisted")`

🔵 bin/lib/review-escalation.mjs:73 — `handshake-round-${r}.json` template string not shared with `run.mjs:1198` and `run.mjs:1276`; export `roundHandshakePath(taskDir, round)` to make the coupling explicit

---

## Summary

Architecturally sound at the module level. `review-escalation.mjs` is well-factored. The escalation block correctly posts a GitHub comment, transitions to blocked, and halts retries. 581/581 tests pass.

Priority backlog items: (1) reason-string drift after crash recovery violates the spec contract; (2) the duplicated state-write pattern is now at four sites and compounds with every new field.

No critical findings. **PASS.**
