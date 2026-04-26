# Security Review — task-6: Per-Phase Cost Split

**Reviewer role:** Security
**Verdict: PASS**
**Date:** 2026-04-26

---

## Scope Reviewed

- `bin/lib/report.mjs` (full file, 193 lines): `buildReport()` per-phase rendering at lines 75-78, `cmdReport()` input validation at lines 134-193.
- `bin/lib/util.mjs:190-198`: `readState()` — the JSON parser that feeds data into `buildReport()`.
- `test/report.test.mjs` (full file, 537 lines): 44 tests covering per-phase rendering, cost formatting, path traversal, and format validation.
- Git diff `582b843..53ba88a` (the N/A fix commit) and `53ba88a..6fd01a0` (the per-phase split tests).
- `.team/features/execution-report/tasks/task-6/handshake.json`: builder claims.
- `.team/features/execution-report/tasks/task-5/eval-security.md`: prior security review on total cost formatting.

---

## Threat Model

`buildReport()` consumes `STATE.json`, which is authored exclusively by the harness via `writeState()` (`util.mjs:200-206`). The `tokenUsage.byPhase` object is populated by the harness during execution — there is no external user input path to phase names or cost values. `readState()` uses `JSON.parse()` which produces plain objects without prototype pollution risk.

The output is a markdown report written to stdout or to a local `REPORT.md` file — not served to browsers, not sent over a network, not evaluated as code. The only meaningful adversary is someone with local filesystem write access to `.team/` directories, at which point they can modify any code directly and the report is the least of concerns.

---

## Builder Claims vs Evidence

| Claim (handshake.json) | Evidence | Verified |
|---|---|---|
| Fixed `$N/A` bug to render `N/A` when phase costUsd missing | Git diff `53ba88a`: changed `$${v.costUsd?.toFixed(4) ?? "N/A"}` to `v.costUsd != null ? \`$${v.costUsd.toFixed(4)}\` : "N/A"` at report.mjs:77 | Yes |
| Verifies phase name format | Test at report.test.mjs:260-261: asserts `build: $0.0060` and `gate: $0.0040` | Yes |
| Verifies Per-phase split label | Test at report.test.mjs:259: asserts `Per-phase split:` present | Yes |
| N/A fallback when byPhase is absent | Test at report.test.mjs:264-272: asserts `N/A` on the Per-phase split line | Yes |
| N/A for individual phases with missing costUsd | Test at report.test.mjs:274-284: `review: {}` renders `review: N/A` | Yes |
| All 44 report tests pass | Independently ran `node --test test/report.test.mjs`: 44 pass, 0 fail | Yes |

---

## Per-Criterion Findings

### 1. Input Validation — Per-Phase Data

**Code under review (`report.mjs:75-78`):**
```js
const byPhase = state.tokenUsage?.byPhase;
const perPhase = byPhase
  ? Object.entries(byPhase).map(([k, v]) => `${k}: ${v.costUsd != null ? `$${v.costUsd.toFixed(4)}` : "N/A"}`).join(", ")
  : `N/A (see \`agt metrics\`)`;
```

- **Optional chaining** `state.tokenUsage?.byPhase` safely traverses absent intermediate objects. No TypeError on missing `tokenUsage`.
- **`byPhase` truthiness check** correctly differentiates: object present -> enumerate phases; absent/null/undefined -> show N/A.
- **`v.costUsd != null`** (loose equality) catches both `null` and `undefined` while allowing `0` through. This is the correct guard for a numeric field that can be zero.
- **`Object.entries(byPhase)`** only returns own enumerable properties — no prototype pollution vector.

**Edge cases traced:**

| Input | Path | Output | Secure? |
|---|---|---|---|
| `byPhase: { build: { costUsd: 0.006 } }` | `!= null` true | `build: $0.0060` | Yes |
| `byPhase: { build: { costUsd: 0 } }` | `!= null` true | `build: $0.0000` | Yes |
| `byPhase: { review: {} }` | `costUsd === undefined`, `!= null` false | `review: N/A` | Yes |
| `byPhase: { review: { costUsd: null } }` | `!= null` false | `review: N/A` | Yes |
| `byPhase: undefined` | outer guard falsy | `N/A (see agt metrics)` | Yes |
| `tokenUsage: undefined` | `?.` -> undefined | `N/A (see agt metrics)` | Yes |
| `byPhase: { build: { costUsd: NaN } }` | `!= null` true | `build: $NaN` | Cosmetic only |
| `byPhase: { build: { costUsd: "string" } }` | `!= null` true, `.toFixed()` throws | TypeError | See finding below |

### 2. Output Injection

- Phase keys (`k`) are interpolated into a plain-text line (not a markdown table, not HTML, not shell). No control-character or code-injection path.
- `toFixed(4)` on a number produces a digit-and-dot string. No injection vector.
- The output context is stdout or a local `.md` file. No web rendering, no eval, no shell execution of the output.

### 3. Path Traversal / File Write Safety

Reviewed in prior task-5 security eval. Unchanged and still correct:
- `basename()` comparison at report.mjs:163 blocks directory traversal
- Explicit `.` and `..` rejection
- `--output md` writes only to `join(featureDir, "REPORT.md")` — no user-controlled filename
- Three tests cover traversal rejection (report.test.mjs:478-497)

### 4. Data Source Trust Boundary

`readState()` at util.mjs:190-198:
```js
export function readState(dir) {
  const statePath = resolve(dir, "STATE.json");
  if (!existsSync(statePath)) return null;
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}
```

- `JSON.parse` is safe against code execution — produces plain objects and arrays.
- Error handling with try/catch returns null on malformed JSON — no crash, no partial state.
- STATE.json is written by `writeState()` in the same module — harness-only trust boundary.

### 5. Authorization / Access Control

Not applicable — local CLI tool reading/writing within the project's `.team/` directory. No auth boundaries crossed.

### 6. Secrets Management

No secrets, tokens, or credentials are handled. Cost data is aggregated metadata, not sensitive.

### 7. Denial of Service

- `Object.entries(byPhase)` iterates once over phase keys — O(n) bounded by the number of phases (typically 2-4).
- `.toFixed(4)` is O(1). No recursive structures, no unbounded allocations.
- No external network calls.

---

## Prior Security Review (task-5) — Delta

The task-5 `eval-security.md` reviewed the total cost formatting at report.mjs:71-74. This review covers the per-phase split at lines 75-78 which was modified in commit `53ba88a`. The fix changed from:
```js
// Before (buggy): dollar sign applied unconditionally
`${k}: $${v.costUsd?.toFixed(4) ?? "N/A"}`

// After (correct): conditional formatting
`${k}: ${v.costUsd != null ? `$${v.costUsd.toFixed(4)}` : "N/A"}`
```

The fix is correct. The prior approach produced `$N/A` because the `$` prefix was outside the nullish coalescing expression. The new approach places the `$` inside the true branch of an explicit `!= null` check.

The task-5 security eval flagged `typeof` guard absence as a blue suggestion. The same observation applies to the per-phase code path — `.toFixed()` would throw on a non-numeric truthy value. However, this is the same trust boundary: STATE.json is harness-authored and JSON-parsed, so `costUsd` will always be a number if present.

---

## Findings

🔵 `bin/lib/report.mjs:77` — No `typeof` guard before `.toFixed()` on per-phase `v.costUsd`. A non-numeric truthy value (e.g., `"string"` from a hand-edited STATE.json) would throw TypeError. Low risk since STATE.json is harness-authored and JSON-parsed. Consider `typeof v.costUsd === 'number' && Number.isFinite(v.costUsd)` if future code paths allow external data sources.

🔵 `bin/lib/report.mjs:77` — If a `byPhase` entry value is `null` or a primitive (e.g., `byPhase: { build: null }`), accessing `v.costUsd` would throw TypeError. Not a current risk since the harness always writes objects, but a `v && typeof v === 'object'` guard would harden against manually edited STATE.json files.

No critical or warning-level findings.

---

## Test Verification

All 44 tests in `test/report.test.mjs` pass (independently verified):
- `renders tokenUsage.byPhase in Cost Breakdown with phase names and label` — PASS
- `shows N/A for per-phase split when byPhase is absent` — PASS
- `shows N/A for a phase whose costUsd is missing` — PASS
- `shows $X.XXXX total cost when tokenUsage.total.costUsd is present` — PASS
- `shows N/A for total cost when tokenUsage.total.costUsd is absent` — PASS
- Path traversal tests (3) — PASS
- Format validation tests (2) — PASS

---

## Summary

The per-phase cost split implementation is secure for its context. All data originates from harness-authored STATE.json parsed via `JSON.parse` (no code execution risk). The output is rendered to stdout or a local markdown file (no web injection surface). The `!= null` guard correctly handles the null/undefined/zero trichotomy for cost values. The `$N/A` formatting bug was correctly fixed by moving the dollar sign inside the conditional branch.

Two blue suggestions address robustness against hand-edited STATE.json files — neither represents a realistic security threat in the current trust model. No critical or warning-level issues. Merge is unblocked.
