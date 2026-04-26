# Security Review — task-5

## Verdict: PASS

## Scope reviewed
- `bin/lib/report.mjs` (full file, 193 lines): `buildReport()` cost formatting at lines 67–83, `cmdReport()` input validation at lines 134–193.
- `bin/lib/util.mjs` (lines 190–198): `readState()` — the parser that feeds data into `buildReport()`.
- `test/report.test.mjs` (full file, 514 lines): 42 tests covering cost formatting, path traversal, and format validation.
- Git diffs `582b843..bef460e` (test additions) and `582b843..fd83434` (metadata only, no report.mjs changes).
- `.team/features/execution-report/tasks/task-5/handshake.json`: builder claims.

## Threat model
`buildReport()` consumes `STATE.json`, which is authored exclusively by the harness via `writeState()` (util.mjs:200–206). There is no external user input path to `tokenUsage.total.costUsd`. The output is a markdown report written to stdout or to a local `REPORT.md` file — not served to browsers, not sent over a network. The only meaningful adversary would be someone with local filesystem write access to `.team/` directories, at which point they could modify any code directly.

## Per-criterion findings

### Input validation
- `totalCostUsd != null` (report.mjs:72) correctly gates `.toFixed(4)`. Loose `!=` catches both `null` and `undefined` while allowing `0` through — correct behavior since zero is a valid cost.
- Optional chaining `state.tokenUsage?.total?.costUsd` (line 71) safely traverses absent intermediate objects. No risk of `TypeError` on missing `tokenUsage` or `total`.
- Per-phase rendering (line 77) uses `v.costUsd?.toFixed(4) ?? "N/A"` — optional chaining handles `undefined`/`null` costUsd per phase, falling back to `"N/A"`.

### Output injection
- `toFixed(4)` on a number produces a digit-and-dot string (e.g., `"0.0050"`). No markdown injection, no XSS vector.
- Phase keys (`k` in `Object.entries(byPhase)`) come from JSON-parsed data. JSON keys are always strings. Interpolated into a plain-text markdown line — no control-character or code-injection path.
- `escapeCell()` (line 8–10) escapes `|` characters in task titles to prevent markdown table column injection. Adequate for the output format.

### Path traversal / file write safety
- `cmdReport` rejects feature names that differ from `basename(featureName)` (line 163), blocking `../`, absolute paths, and multi-segment traversals.
- Explicit checks for `.` and `..` (line 163).
- `--output md` writes only to `join(featureDir, "REPORT.md")` — no user-controlled filename component.
- Three dedicated tests cover path traversal rejection (lines 494–513).

### Authorization / access control
Not applicable — this is a local CLI tool reading/writing within the project's `.team/` directory. No auth boundaries crossed.

### Secrets management
No secrets, tokens, or credentials are handled in this code path. Cost data is aggregated metadata, not sensitive.

### Denial of service
- `buildReport` iterates tasks and gates arrays once each — O(n) bounded by STATE.json size.
- `toFixed(4)` is O(1). No recursive structures, no unbounded allocations.
- No external network calls.

## Edge cases verified

| Edge Case | Code Path | Result |
|-----------|-----------|--------|
| `costUsd: 0` | `!= null` → true | Renders `$0.0000` — correct |
| `costUsd: null` | `!= null` → false | Renders `N/A` — correct |
| `costUsd: undefined` | `!= null` → false | Renders `N/A` — correct |
| `tokenUsage` absent | `?.` → undefined | Renders `N/A` — correct |
| `tokenUsage.total` absent | `?.` → undefined | Renders `N/A` — correct |
| `costUsd: -1.5` | `!= null` → true | Renders `$-1.5000` — cosmetically odd, not a security issue |
| `costUsd: Infinity` | `toFixed()` → `"Infinity"` | Renders `$Infinity` — cosmetic, harness would never produce this |
| `costUsd: "string"` | `.toFixed()` → TypeError | Would throw; but STATE.json is JSON-parsed so costUsd would be a number if present. Harness-only trust boundary. |

## Findings

🔵 `bin/lib/report.mjs:72` — No `typeof` guard before `.toFixed()`; a non-numeric `costUsd` (e.g., string from a hand-edited STATE.json) would throw TypeError. Low risk since STATE.json is harness-authored. Consider `typeof costUsd === 'number'` if future code paths allow external data sources.

No critical or warning-level findings.

## Test verification

All 42 tests in `test/report.test.mjs` pass (ran locally):
- `shows $X.XXXX total cost when tokenUsage.total.costUsd is present` — PASS
- `shows N/A for total cost when tokenUsage.total.costUsd is absent` — PASS
- `renders tokenUsage.byPhase in Cost Breakdown` — PASS
- Path traversal tests (3) — PASS
- Format validation tests (2) — PASS
