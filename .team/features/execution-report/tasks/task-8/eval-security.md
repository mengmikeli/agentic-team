# Security Review — Task 8: Recommendations Edge-Case Tests

**Reviewer:** Security Specialist
**Verdict:** PASS

## Scope of Change

Task-8 added 3 edge-case tests to `test/report.test.mjs` (lines 355-413). No production code was modified. The tests cover:

1. Zero-pass guard: no "No gate passes recorded" recommendation when `gates: []`
2. All 4 recommendation triggers firing simultaneously
3. Gate warning layer deduplication across multiple `gateWarningHistory` entries

## Files Reviewed

| File | Lines Read | Method |
|------|-----------|--------|
| `bin/lib/report.mjs` | 1-194 (full) | Direct read |
| `test/report.test.mjs` | 1-597 (full) | Direct read |
| `bin/lib/util.mjs` | 190-198 (`readState`) | Grep + read |
| `tasks/task-8/handshake.json` | 1-13 (full) | Direct read |
| `git diff HEAD~2..HEAD` | All changed files | git diff |

## Test Verification

```
npm test (565 pass, 0 fail, 2 skipped)
```

All 47 report-specific tests pass including the 3 new edge-case tests.

---

## Per-Criterion Results

### 1. Input Validation

**PASS** — No new input surface was introduced. Existing protections verified by reading `report.mjs`:

- **Path traversal** (line 163): `basename()` check + explicit `.` / `..` rejection. Tests at lines 577-596 cover `../../etc`, `.`, and `..`.
- **Output format** (line 157): Only `"md"` accepted; other values exit 1.
- **Feature name** (line 151): Missing name exits 1 with usage.

### 2. Data Flow in New Tests

**PASS** — The 3 new tests construct `state` objects via `makeState()` with hardcoded literals. No external input, no file I/O, no network. Data flows:

- `gates: []` → `failGates = 0` → `failGates > 0 && passGates === 0` is `false` → zero-pass rec does NOT fire (correct).
- `gateWarningHistory` with overlapping layers → `flatMap` + `new Set()` deduplication at line 105 → single occurrence verified by regex count at test line 411.
- All 4 triggers fire independently — each recommendation code path is exercised without interfering with others.

### 3. Injection / Output Safety

**PASS** — Report output is plain text / markdown. No HTML rendering, shell interpolation, or database queries. `escapeCell()` at line 8-10 handles pipe characters in markdown table cells. Test at line 286-304 validates column structure.

### 4. Secrets / Credentials

**PASS (N/A)** — No secrets, tokens, or PII involved. STATE.json contains execution metadata only (task IDs, statuses, attempt counts, costs).

### 5. Error Handling

**PASS** — No new error paths introduced. Existing error handling verified:

- `readState()` wraps `JSON.parse` in try/catch, returns `null` on failure.
- `cmdReport` exits cleanly on null state (line 178).
- Invalid `createdAt` guarded by `Number.isFinite(mins)` at line 26 (falls back to "N/A").

### 6. Prior Security Findings Addressed

The prior Tester eval (task-8 eval.md) flagged 4 yellow issues. Checking their status:

| Prior Finding | Status |
|---|---|
| `.`/`..` path traversal bypass | **Fixed** — explicit check at line 163 |
| No test for zero-pass gate rec | **Fixed** — test at line 355-363 (this task) |
| No test for partial-problem rec | **Fixed** — test at line 327-338 (task-7 or prior) |
| Invalid createdAt → NaN | **Fixed** — `Number.isFinite` guard at line 26 |

---

## Findings

No findings at critical (red) or warning (yellow) level.

🔵 `bin/lib/report.mjs:158` — User-provided `outputVal` reflected to stderr without ANSI escape sanitization. Negligible risk for a local CLI tool.

🔵 `bin/lib/report.mjs:73` — `toFixed(4)` would throw `TypeError` if `costUsd` is a non-numeric truthy value in a corrupted STATE.json. Currently safe because STATE.json is harness-written. A `typeof costUsd === 'number'` guard would harden further.

---

## Edge Cases Checked

| Edge case | Covered? | Evidence |
|---|---|---|
| No gates ran → no zero-pass rec | Yes | Test line 355-363 |
| All 4 recs fire simultaneously | Yes | Test line 366-390 |
| Duplicate warning layers deduplicated | Yes | Test line 392-413, regex count |
| Path traversal `../../etc` | Yes | Test line 577 |
| `.` and `..` as feature name | Yes | Tests line 584, 591 |
| Empty `gates` array | Yes | Test line 355 |
| `gateWarningHistory` with empty `layers` | Implicit | `flatMap(e => e.layers || [])` handles it |
| Null/undefined `costUsd` | Yes | Test line 244-248 |
| Non-numeric `costUsd` | No | Low risk — harness-written |

## Summary

This is a test-only change that closes previously flagged coverage gaps for the Recommendations section. No new attack surface introduced. The implementation handles all inputs defensively with appropriate validation, escaping, and error handling for its context as a local CLI tool. The two blue suggestions are optional hardening — neither represents a realistic threat in the current trust model.
