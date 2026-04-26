# Feature: External Validator Integration

## Goal
Parse structured output from test runners, linters, and CI tools into file:line findings so validator failures become actionable gate evidence — not just a binary exit code.

## Requirements
- Parse four common output formats: JUnit XML, TAP (Test Anything Protocol), GitHub Actions problem matcher (`::error file=...,line=...::`), and generic JSON (`{ errors: [{ file, line, message }] }`).
- Each parsed failure maps to a `{ severity, text }` finding in the form `file:line — message`, matching the emoji-finding format used by reviewers (`🔴` for critical, `🟡` for warning).
- Findings from parsed output are injected into the task's `handshake.json` and written to `artifacts/validator-findings.json`.
- The verdict pipeline treats parsed critical findings the same as reviewer findings — any critical → FAIL.
- Auto-detection: after the gate command runs, `gate.mjs` checks stdout and known output file locations (e.g. `junit.xml`, `test-results.xml`, `test-report.json`) for a recognizable format and dispatches the appropriate parser.
- Optional explicit config via `.team/validators.json` to declare parser and output file, overriding auto-detection.
- Parsing failures (malformed XML, unknown format) are non-fatal: gate falls back to exit-code-only verdict and logs a warning artifact.
- Works with both inline `gate.mjs` execution (`runGateInline`) and subprocess gate invocations.

## Acceptance Criteria
- [ ] `JUnit XML` with one `<failure>` element produces one critical finding with `file:line — classname: message` text.
- [ ] `TAP` output with one `not ok` line produces one critical finding.
- [ ] `GitHub Actions problem matcher` output (`::error file=src/foo.js,line=5::message`) produces one critical finding.
- [ ] Generic JSON `{ errors: [{ file, line, message }] }` produces one critical finding per error.
- [ ] All-passing inputs (exit 0, no failures in output) produce zero parsed findings and PASS verdict.
- [ ] Parsed findings appear in `handshake.findings.critical` count and in `artifacts/validator-findings.json`.
- [ ] Malformed parser input (truncated XML, invalid JSON) logs a warning to `artifacts/gate-stderr.txt` and does not crash the gate — verdict falls back to exit code.
- [ ] `.team/validators.json` with `{ "gate": { "parser": "junit", "outputFile": "test-results.xml" } }` forces that parser and file, bypassing auto-detection.
- [ ] Unit tests for each parser cover: passing, single failure, multiple failures, and malformed input.
- [ ] Integration test: `npm test` with a Jest JUnit reporter producing a failing `test-results.xml` → gate emits FAIL verdict with `src/foo.test.js:12 — describe > test name: error` finding.

## Technical Approach

### New file: `bin/lib/validator-parsers.mjs`
Exports one function per format and a dispatch entry point:

```js
// Returns: [{ severity: 'critical'|'warning', text: 'file:line — message' }]
export function parseJunit(xmlString)     // parse <testsuite>/<testcase>/<failure> elements
export function parseTap(tapString)       // parse "not ok N - description" lines
export function parseGhaMatcher(output)  // parse "::error file=...,line=N::msg" lines
export function parseGenericJson(json)   // parse { errors: [{ file, line, message }] }
export function detectAndParse(stdout, artifactDir, config)
  // 1. If config.parser specified, use it + config.outputFile
  // 2. Try GHA matcher on stdout (fastest, regex only)
  // 3. Check stdout for TAP markers ("TAP version", "ok 1 -")
  // 4. Check stdout/artifactDir for JUnit XML ("<testsuite")
  // 5. Check stdout/artifactDir for generic JSON
  // Returns: { findings, formatDetected } or { findings: [], formatDetected: null }
```

### Modified: `bin/lib/gate.mjs`
After capturing stdout/stderr and before writing the handshake, call `detectAndParse(stdout, artifactsDir, validatorConfig)`. Merge returned findings into `handshake.findings.critical` count and write `artifacts/validator-findings.json` if findings are non-empty.

### Config: `.team/validators.json` (optional)
```json
{
  "gate": {
    "parser": "junit",
    "outputFile": "test-results.xml"
  }
}
```
Loaded once in `cmdGate` from the feature dir. Falls back to auto-detection if absent.

### Findings flow into verdict pipeline
The existing `handshake.findings.critical` count is already consumed by `synthesize.mjs` and the outer loop. No changes needed there — incrementing the critical count is sufficient for the verdict to propagate as FAIL.

### No changes needed to
- `compound-gate.mjs` — targets review text quality, not test output
- `synthesize.mjs` — already treats critical count as FAIL signal
- `handshake.mjs` — `findings.critical` already exists in schema
- Extension system — `executeRun` / `verdictAppend` hooks remain the higher-level extension points; this feature operates one layer below them in `gate.mjs`

## Testing Strategy
- **Unit tests** (`test/validator-parsers.test.mjs`): one `describe` block per format with fixture strings for passing, single failure, multiple failures, and malformed input. Assert on returned `findings` array shape, `severity`, and `text` pattern.
- **Fixture files** (`test/fixtures/`): `junit-pass.xml`, `junit-fail.xml`, `tap-pass.txt`, `tap-fail.txt`, `gha-fail.txt`, `generic-fail.json`, `malformed.xml`.
- **Integration test** (`test/gate-validator-integration.test.mjs`): write a temp `junit-fail.xml` to a temp dir, run `cmdGate` pointed at `cat junit-fail.xml` (exit 0) with parser config, assert `validator-findings.json` contains one finding and verdict is FAIL due to critical count.

## Out of Scope
- Calling external CI APIs (GitHub Actions, CircleCI) to fetch run results — requires auth and network access.
- Running pre-commit hooks as a separate step — already handled by `executeRun` in the extension system.
- SARIF format — complex, low adoption outside security scanners; defer.
- Per-task parser configuration beyond `.team/validators.json` — feature-level config is sufficient.
- Surfacing parsed findings as GitHub issue comments — can be added via `artifactEmit` extension if needed.
- Deduplication of findings already present in reviewer output — out of scope for v1.

## Done When
- [ ] `bin/lib/validator-parsers.mjs` exists with `parseJunit`, `parseTap`, `parseGhaMatcher`, `parseGenericJson`, and `detectAndParse` exports.
- [ ] `gate.mjs` calls `detectAndParse` after command execution and writes `artifacts/validator-findings.json` when findings are present.
- [ ] `handshake.findings.critical` reflects parsed failure count, causing FAIL verdict even when exit code is 0.
- [ ] Unit tests for all four parsers pass, covering pass/fail/malformed cases.
- [ ] Integration test with a JUnit XML failure produces a FAIL verdict with a `file:line — message` finding in the artifacts.
- [ ] Malformed parser input does not crash the gate — falls back to exit-code verdict with a warning in artifacts.
- [ ] `.team/validators.json` config is respected when present.
