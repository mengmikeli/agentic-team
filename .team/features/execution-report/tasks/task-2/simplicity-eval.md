# Simplicity Review — execution-report (task-2)

**Reviewer role:** Simplicity Advocate
**Verdict: PASS**
**Date:** 2026-04-24

---

## Files Opened and Read

- `bin/lib/report.mjs` (all 161 lines)
- `test/report.test.mjs` (all 293 lines)
- `.team/features/execution-report/tasks/task-1/handshake.json`
- `.team/features/execution-report/tasks/task-2/handshake.json`
- `.team/features/execution-report/tasks/task-1/simplicity-eval.md`
- `.team/features/execution-report/tasks/task-2/eval.md`
- `.team/features/execution-report/SPEC.md`
- `bin/agt.mjs` (cmdReport wiring — grep only)

---

## Resolution of task-1 🔴 Findings

### Finding 1 — Dead variable `state` (test/report.test.mjs:133–138): RESOLVED ✅

Previous: `state` declared, never asserted; only `state3` at line 150 was used.

Current (lines 133–140): The `it()` block now reads:
```js
it("handles null/undefined task.status in blocked/failed section without throwing", () => {
  const state3 = makeState({ tasks: [{ id: "task-1", status: "blocked", attempts: 0 }] });
  assert.doesNotThrow(() => buildReport(state3), "Should not throw for blocked task without title");
});
```
`state3` is the only variable declared and it IS referenced in `assert.doesNotThrow(...)`. No dead variable.

### Finding 2 — Dead variable `state2` (test/report.test.mjs:142–149): RESOLVED ✅

Previous: `state2` and the comment block at 147–149 were dead; only `state3` was asserted.

Current (lines 142–152): The block is now two separate, well-formed tests — "marks in-progress features in header" (uses `state` and `report` in `assert.ok`) and "marks completed features in header" (same pattern). Both variables are fully asserted. No dead code.

### Finding 3 — `formatDuration` premature abstraction (bin/lib/report.mjs:8): RESOLVED ✅

Previous: `formatDuration` was a private, 9-line helper with a single call site at line 28.

Current: `formatDuration` does not exist. Duration is computed inline (lines 17–30 of `buildReport`). No single-site private helper.

---

## Per-Criterion Results — Current Code

### 1. Dead Code — PASS

- All imports used: `existsSync` and `writeFileSync` are defaults in deps injection; `join` used at lines 136 and 154; `readState` used as default dep.
- No commented-out code.
- No unreachable branches.
- All test variables are asserted (verified line-by-line for `buildReport` and `cmdReport` test blocks).

### 2. Premature Abstraction — PASS

- `buildReport`: exported, called at `cmdReport:151` (production) and directly in 11 `it()` blocks in `test/report.test.mjs`. ≥2 call sites.
- `cmdReport`: exported, wired in `agt.mjs:75` (production) and exercised in 8 `it()` blocks in `test/report.test.mjs`. ≥2 call sites.
- No interfaces with a single implementation.

### 3. Unnecessary Indirection — PASS

`cmdReport` injects 6 deps (`readState`, `existsSync`, `writeFileSync`, `stdout`, `exit`, `cwd`). Each dep has substantive logic within `cmdReport` that uses it — this is testability infrastructure, not delegation. The injected versions have different behavior (spy/stub) from the real ones. Not pure pass-through.

### 4. Gold-Plating — PASS

- `--output md` is required by SPEC and tested at `test/report.test.mjs:242`.
- No feature flags with a single ever-used value.
- No speculative extensibility or config options beyond what SPEC requires.

---

## Complexity Concerns (🟡 — backlog, carryover from task-1)

These were already in the backlog after task-1 and remain there. They do not block merge on simplicity grounds.

**`bin/lib/report.mjs:19`** — `new Date(state.createdAt).getTime()` returns `NaN` for a malformed ISO string. `Math.round(NaN / 60000)` propagates `NaN`, rendering `"NaNm"` in the header. Add `if (isNaN(startMs)) { duration = "N/A"; }` guard.

**`bin/lib/report.mjs:136`** — `featureName` from CLI argv passed directly to `path.join(_cwd(), ".team", "features", featureName)` with no boundary assertion. Path traversal via `../../../../tmp/x` escapes the intended tree. Assert `resolve(featureDir).startsWith(resolve(_cwd(), ".team", "features") + sep)` before I/O.

---

## Suggestions (🔵 — optional, no backlog impact)

**`test/report.test.mjs:134`** — Variable is named `state3` while all other `it()` blocks use `state` as their local variable name. Rename to `state` for consistency — `state3` is a naming artifact from the multi-variable iteration that has been cleaned up but the name was not normalized.

**`test/report.test.mjs:133`** — Test title "handles null/undefined task.status" is misleading. The task data has `status: "blocked"` (not null/undefined); what is actually being tested is that a missing `task.title` does not throw. Title should be "does not throw when task has no title property" or similar.

---

## Findings Summary

No findings.

(All task-1 🔴 findings resolved. Backlog items are carryover 🟡. Suggestions are 🔵 only.)

---

## Verdict: PASS

All three veto categories (dead code, premature abstraction, unnecessary indirection, gold-plating) are clear in the current code. The builder addressed each 🔴 finding from the prior review directly:

- Dead `state` → replaced with proper `state3` assertion
- Dead `state2` → replaced with two real, asserting tests
- `formatDuration` single-site abstraction → inlined

No new critical findings introduced. Backlog 🟡 items carry forward unchanged.
