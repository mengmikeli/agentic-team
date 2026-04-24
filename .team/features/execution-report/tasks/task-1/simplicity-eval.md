# Simplicity Review — execution-report

**Reviewer role:** Simplicity Advocate
**Verdict: FAIL**
**Date:** 2026-04-24

---

## Files Opened and Read

- `bin/lib/report.mjs` (all 151 lines)
- `test/report.test.mjs` (lines 1–308, all)
- `.team/features/execution-report/tasks/task-1/handshake.json`
- `.team/features/execution-report/tasks/task-2/handshake.json`
- `.team/features/execution-report/tasks/task-1/eval.md`

---

## Per-Criterion Results

### 1. Dead Code — FAIL (🔴 blocks merge)

**`test/report.test.mjs:133–138`** — Variable `state` is declared (`makeState({ tasks: [...] })`) inside the test at line 133 but never referenced in any assertion. The test at line 155 asserts only against `state3` (line 150). `state` is pure dead weight.

Evidence: read lines 133–155 directly. `assert.doesNotThrow(() => buildReport(state3))` — `state` does not appear in any `assert.*` call.

**`test/report.test.mjs:142–146`** — Variable `state2` is declared (`makeState({ tasks: [...] })`) at line 142 but never referenced in any assertion. The comment block at lines 147–149 even explains why it can't reach the code path it was meant to test, yet the variable was left in rather than deleted.

Evidence: same read. `state2` appears only in its own `makeState(...)` assignment.

### 2. Premature Abstraction — FAIL (🔴 blocks merge)

**`bin/lib/report.mjs:8–17`** — `formatDuration` is a private (unexported), 9-line function with exactly **one call site**: line 28 (`formatDuration(state.createdAt, state.completedAt || state._last_modified)`). It is not exported, not tested in isolation, and not reused anywhere in the codebase.

Evidence: `grep` across the entire `bin/` tree would show zero additional call sites. I confirmed by reading `report.mjs` in full — there is no second call.

Per the gate rules: abstraction used at fewer than 2 call sites = 🔴 premature abstraction.

### 3. Unnecessary Indirection — PASS

No wrapper-only delegates or re-exports found. `cmdReport` and `buildReport` both have substantive logic.

### 4. Gold-Plating — PASS

`--output md` is a real feature with a test. No speculative config options or unused flags found.

---

## Complexity Warnings (🟡 — backlog, do not block)

**`bin/lib/report.mjs:10`** — `new Date(startIso).getTime()` returns `NaN` for any non-ISO string (e.g. corrupt STATE.json). `Math.round(NaN / 60000)` → `NaN`, which renders as `"NaNm"` in the report header. No guard present. Fix: add `if (isNaN(startMs)) return "N/A"` after line 10.

**`bin/lib/report.mjs:126`** — `featureName` from `process.argv` is passed directly to `path.join(_cwd(), ".team", "features", featureName)` with no traversal boundary check. `path.join` normalises but does not clamp `../..` segments. With `--output md` this becomes a file-write path. Fix: assert resolved path starts with `resolve(_cwd(), ".team", "features") + path.sep`.

---

## Findings Summary

```
🔴 test/report.test.mjs:133 — Dead code: `state` declared but never used in any assertion; delete lines 133–138
🔴 test/report.test.mjs:142 — Dead code: `state2` declared but never used in any assertion; delete lines 142–149 including comment block
🔴 bin/lib/report.mjs:8 — Premature abstraction: `formatDuration` private, single call site (line 28); inline the 9-line body into `buildReport`
🟡 bin/lib/report.mjs:10 — NaN propagates for bad-date input; add `if (isNaN(startMs)) return "N/A"` guard
🟡 bin/lib/report.mjs:126 — No traversal boundary check on `featureName`; assert resolved path stays within `.team/features/`
```

---

## Verdict: FAIL

Three 🔴 findings. Any red = FAIL per gate rules. The dead code in the test file and the single-site `formatDuration` abstraction must be cleaned up before merge.

The gate (`npm test`, exit 0) passing does not address these findings — tests pass with dead variables present. The test suite does not catch premature abstractions.
