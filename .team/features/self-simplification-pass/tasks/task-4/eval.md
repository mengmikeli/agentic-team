# Architect Review — task-4: Warning findings appear in simplify-eval.md and progress.md but do not block

**Reviewer:** Architect
**Date:** 2026-04-26
**Verdict:** ITERATE

---

## Files Actually Read

- `.team/features/self-simplification-pass/tasks/task-4/handshake.json`
- `bin/lib/run.mjs` lines 1505–1641 — simplify block, warning path, finalize gate, completion report, usage-write block
- `bin/lib/simplify-pass.mjs` lines 220–240 — `runSimplifyPass` return values, `runSimplifyFixLoop` escalation logic
- `test/simplify-pass.test.mjs` lines 328–541, 560–735 — warning tests and fix-loop tests
- `git show 5695b4d` — the fix commit diff (four findings resolved)

---

## Per-Criterion Results

### 1. Warning path appears in `simplify-eval.md` and `progress.md`
**PASS (behavior correct)**

`run.mjs:1531–1540` adds the warning block after the main simplify result dispatch. The guard at line 1532 correctly checks `!skipped && !escalated && !reverted && findings?.warning > 0`, preventing double-writes in terminal states. The `appendProgress` call at line 1539 is covered by the outer `catch` at line 1541.

### 2. Warnings do not block `finalize`
**PASS**

`run.mjs:1548` gates finalize solely on `simplifyResult?.escalated`. The word `warning` does not appear in the 300-char window before `harness("finalize"`. Source-text test at line 537–540 verifies this structurally.

### 3. `activePhases` fix (simplicity finding from prior review)
**FAIL — introduces critical regression**

The fix in commit `5695b4d` removed `activePhases2` from the second `if (usage.dispatches > 0)` block (line 1625) and replaced it with `activePhases`. However, `activePhases` is declared as `const` at line 1602 **inside a different `if (usage.dispatches > 0)` block** (lines 1595–1621). In JavaScript, `const` is block-scoped: it ceases to exist when its enclosing block closes. The second block at line 1625 is a sibling block, not a nested block.

Result: `ReferenceError: activePhases is not defined` at runtime whenever `usage.dispatches > 0` (any real run that dispatches at least one agent).

Verified:
```js
// Minimal reproduction
if (x > 0) { const activePhases = []; }
if (x > 0) { console.log(activePhases.length); }  // ReferenceError
```
Running `node --input-type=module` with this pattern confirms the error.

The test suite misses this because `_runSingleFeature` is injected as a mock in all test harnesses — the function body never executes in any test.

### 4. Warning tests coverage
**PASS with note**

Tests at lines 505–541 are source-text assertions: they read `run.mjs` as a string and verify the guard condition and finalize-gate structure. This is a reasonable proxy but does not verify runtime behavior. No behavioral test exercises `_runSingleFeature` with `findings.warning > 0` and checks that `simplify-eval.md` is created and `progress.md` is appended. This gap is pre-existing.

---

## Findings

🔴 bin/lib/run.mjs:1627 — `activePhases` used outside its block scope; declared with `const` inside first `if (usage.dispatches > 0)` block (line 1602, closes at 1621), unreachable in second `if (usage.dispatches > 0)` block (line 1625); causes ReferenceError on every real run — restore inline definition: `const activePhases = ["brainstorm","build","review","simplify"].filter(p => phases[p]);` at line 1626 (before the `if (activePhases.length > 0)` guard)
🟡 test/simplify-pass.test.mjs:505 — Warning path tested via source-text inspection only; add a behavioral unit test that calls `_runSingleFeature` (or the warning-surfacing slice) with a mocked `simplifyResult` having `findings.warning > 0` and asserts the `simplify-eval.md` file is created and `progress.md` is appended
🔵 bin/lib/run.mjs:1535 — `writeFileSync` overwrites `simplify-eval.md` on every run; if the same feature is run multiple times, earlier warning records are silently discarded — consider appending or including a run timestamp in the filename if history is useful

---

## Verdict: ITERATE

One critical regression was introduced by the simplicity fix: `const activePhases` declared in a sibling `if`-block is referenced out of scope. This throws `ReferenceError` on any real `agt run` dispatch. Fix: re-declare `activePhases` inline in the second block (one line, no new abstraction needed).

---

# Engineer Review (run_2) — task-4: Warning findings in simplify-eval.md and progress.md

**Reviewer role:** Engineer
**Date:** 2026-04-26
**Overall Verdict: ITERATE**

---

## Files Actually Read

- `.team/features/self-simplification-pass/tasks/task-4/handshake.json`
- `bin/lib/run.mjs` lines 1517–1553 (simplify result dispatch, warning block, finalize gate), lines 1589–1631 (completion report and usage-write blocks)
- `bin/lib/simplify-pass.mjs` full (241 lines)
- `test/simplify-pass.test.mjs` lines 437, 505–541

---

## Builder Claims vs Evidence (run_2)

| Claim | Verified? | Evidence |
|---|---|---|
| `!escalated && !reverted` guards added to warning block | ✓ | run.mjs:1532 — both guards present |
| `activePhases2` duplication eliminated | ✗ REGRESSION | run.mjs:1627 — `activePhases` referenced outside its block scope; `ReferenceError` at runtime |
| Source-text tests strengthened for escalated/reverted | ✓ | test/simplify-pass.test.mjs:516–519 checks both keywords in 600-char window |
| Finalize-guard slice asserts no `warning` reference | ✓ | test/simplify-pass.test.mjs:537–540 verified |

---

## Per-Criterion Results

### 1. Warning detection condition — PASS

`run.mjs:1532`: `!simplifyResult.skipped && !simplifyResult.escalated && !simplifyResult.reverted && (simplifyResult.findings?.warning ?? 0) > 0` — all four guards correct. `?.warning ?? 0` handles undefined/null findings safely.

### 2. `simplify-eval.md` write — PASS (when reached)

`run.mjs:1535–1537`: `writeFileSync` inside inner try/catch. Content is counts only (pre-existing backlog item).

### 3. `progress.md` write — PASS (when reached)

`run.mjs:1539`: `appendProgress` called correctly. `appendProgress` (util.mjs:63–73) has its own nested try/catch and cannot propagate throws.

### 4. Finalize non-blocking — PASS

`run.mjs:1548` gates only on `simplifyResult?.escalated`. No warning count in finalize path.

### 5. `activePhases` scope regression — FAIL (critical)

`const activePhases` is declared at line 1602 inside the first `if (usage.dispatches > 0)` block (lines 1595–1621). The block closes at line 1621. JavaScript `const` is block-scoped — the binding does not survive beyond the closing brace.

The second `if (usage.dispatches > 0)` block (lines 1625–1631) references `activePhases` at line 1627 — a sibling scope where the binding does not exist. This produces `ReferenceError: activePhases is not defined` at runtime on any run where `usage.dispatches > 0`.

The test suite does not catch this because `_runSingleFeature` is mocked in all test harnesses — the function body containing these blocks never executes.

Minimal reproduction confirming the error:
```js
// const is block-scoped; this is equivalent to the structure at lines 1595–1631
if (x > 0) { const activePhases = []; }
if (x > 0) { console.log(activePhases.length); }  // ReferenceError
```

Fix: add a local declaration in the second block before use:
```js
// run.mjs:1626 — add before line 1627
const activePhases = ["brainstorm", "build", "review", "simplify"].filter(p => phases[p]);
```

### 6. Source-text test coverage — PASS with gap (pre-existing)

Both tests at lines 505–541 are source-text assertions, not behavioral tests. Condition mutations are undetectable. Already backlogged from run_1.

---

## Findings

🔴 bin/lib/run.mjs:1627 — `activePhases` referenced outside its declaring block scope; `const activePhases` declared inside the first `if (usage.dispatches > 0)` block (line 1602, closes line 1621) is not accessible in the sibling block at line 1625; throws `ReferenceError` on every real dispatch — add `const activePhases = ["brainstorm","build","review","simplify"].filter(p => phases[p]);` at line 1626 inside the second block
🟡 test/simplify-pass.test.mjs:505 — Source-text assertions cannot detect condition mutations or guard deletions; no behavioral test exercises the warning path at runtime (carried from run_1 backlog)
🔵 bin/lib/run.mjs:1535 — `writeFileSync` overwrites `simplify-eval.md` on each run; inconsistent with `appendProgress` append semantics for `progress.md` (carried from run_1 backlog)

---

## Summary

The three core warning-surfacing requirements are correctly implemented at run.mjs:1532–1540 and the finalize gate at 1548 is clean. However, the `activePhases2` deduplication fix introduced a critical scope regression: `const activePhases` declared in the first `if (usage.dispatches > 0)` block (closed at line 1621) is referenced in a sibling block at line 1627. This throws `ReferenceError` on every real feature run. The test suite does not catch this because `_runSingleFeature` is fully mocked.

**ITERATE — one 🔴 blocker requires fix before merge.**
