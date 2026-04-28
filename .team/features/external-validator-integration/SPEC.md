# Feature: External Validator Integration

## Goal
Parse structured output from test runners, linters, and CI tools into `file:line — message` findings so gate verdicts are based on actionable evidence, not just a binary exit code.

## Requirements
- Parse four common structured output formats into the system's finding format (`{ severity, text }`):
  - **JUnit XML** — `<testsuite>/<testcase>/<failure>` elements (Jest, JUnit, pytest, etc.)
  - **TAP** — `not ok N - description` lines (Test Anything Protocol)
  - **GitHub Actions problem matchers** — `::error file=...,line=N::message` annotations
  - **Generic JSON** — `{ errors: [{ file, line, message, severity? }] }` (escape hatch for custom tools)
- Each parsed failure becomes a finding in the existing `🔴 file:line — message` format. Test failures are `critical`; warnings (JUnit `<system-err>`, GHA `::warning`, JSON `severity: "warning"`) map to `warning`.
- After the gate command executes (both `cmdGate` and `runGateInline`), the system auto-detects the output format from stdout and known artifact files, parses it, and merges findings into the handshake.
- Parsed critical findings cause FAIL verdict even when the gate command's exit code is 0. This catches tools that exit 0 but report failures in structured output.
- Optional explicit config via `.team/validators.json` overrides auto-detection with a declared parser and output file path.
- Parsing failures (malformed XML, unknown format) are non-fatal: the gate falls back to exit-code-only verdict and logs a warning to `artifacts/gate-stderr.txt`.
- Validator findings are written to `artifacts/validator-findings.json` for downstream consumption by reviewers and reports.

## Acceptance Criteria
- [ ] JUnit XML with `<failure>` elements produces critical findings with `classname.testname:line — message` text.
- [ ] TAP output with `not ok` lines produces critical findings.
- [ ] GHA problem matcher output (`::error file=...,line=N::msg`) produces critical findings with `file:line — msg` text.
- [ ] Generic JSON `{ errors: [...] }` produces findings matching the declared severity.
- [ ] All-passing structured output (exit 0, no failures) produces zero parsed findings and PASS verdict.
- [ ] Parsed findings are reflected in `handshake.findings.critical` count and written to `artifacts/validator-findings.json`.
- [ ] Malformed input (truncated XML, invalid JSON) does not crash — falls back to exit-code verdict with a logged warning.
- [ ] `.team/validators.json` config forces a specific parser and output file, bypassing auto-detection.
- [ ] Exit code 0 + structured failures in output → FAIL verdict (not a false PASS).
- [ ] Unit tests cover each parser: passing input, single failure, multiple failures, and malformed input.

## Technical Approach

### New file: `bin/lib/validator-parsers.mjs`

Exports five functions:

```js
// Each returns: [{ severity: 'critical'|'warning', text: '🔴 file:line — message' }]
export function parseJunit(xmlString)      // Parse <testsuite>/<testcase>/<failure>
export function parseTap(tapString)        // Parse "not ok N - description" lines
export function parseGhaMatcher(output)    // Parse "::error file=...,line=N::msg" lines
export function parseGenericJson(jsonStr)   // Parse { errors: [{ file, line, message }] }

// Orchestrator: auto-detect format and dispatch to the right parser
export function detectAndParse(stdout, artifactDir, config)
// Returns: { findings: [...], formatDetected: 'junit'|'tap'|'gha'|'json'|null }
```

**Auto-detection order** (in `detectAndParse`):
1. If `config.parser` is set, use it with `config.outputFile` — skip detection.
2. Try GHA matcher regex on stdout (fastest — just a regex test).
3. Check stdout for TAP markers (`TAP version`, `/^(not )?ok \d/m`).
4. Scan stdout and `artifactDir` for JUnit XML (`<testsuite` marker or `*.xml` files).
5. Scan stdout and `artifactDir` for generic JSON (`{ "errors":` marker or `*.json` files).
6. No match → return `{ findings: [], formatDetected: null }`.

Each parser is wrapped in try/catch. Parse errors → log warning, return empty findings array.

### Modified: `bin/lib/gate.mjs` — `cmdGate()`

After capturing stdout/stderr (line ~97) and before writing the handshake (line ~128):

```js
import { detectAndParse } from './validator-parsers.mjs';

// Load optional config
let validatorConfig = {};
try {
  validatorConfig = JSON.parse(readFileSync(join(dir, 'validators.json'), 'utf8')).gate || {};
} catch { /* no config file — auto-detect */ }

const { findings: validatorFindings, formatDetected } = detectAndParse(stdout, artifactsDir, validatorConfig);

// Write validator findings artifact
if (validatorFindings.length > 0) {
  writeFileSync(join(artifactsDir, 'validator-findings.json'), JSON.stringify(validatorFindings, null, 2));
}

// Merge into handshake critical count
const parsedCritical = validatorFindings.filter(f => f.severity === 'critical').length;
const parsedWarning = validatorFindings.filter(f => f.severity === 'warning').length;
```

The `findings` object passed to `createHandshake()` adds `parsedCritical` to `critical` and `parsedWarning` to `warning`. If `parsedCritical > 0`, verdict becomes FAIL regardless of exit code.

### Modified: `bin/lib/run.mjs` — `runGateInline()`

Same pattern as `cmdGate`. After line ~78 (stdout/stderr captured), before line ~94 (verdict assignment):

```js
const { findings: validatorFindings } = detectAndParse(stdout, artifactsDir, validatorConfig);
// If validator found critical failures, override verdict to FAIL
if (validatorFindings.some(f => f.severity === 'critical')) {
  verdict = 'FAIL';
}
```

Write `validator-findings.json` alongside `test-output.txt` in the artifacts dir.

### Config: `.team/validators.json` (optional)

```json
{
  "gate": {
    "parser": "junit",
    "outputFile": "test-results.xml"
  }
}
```

Loaded once per gate invocation. Absent file = auto-detection.

### What does NOT change
- `compound-gate.mjs` — operates on review text quality, not test output
- `synthesize.mjs` — already treats `handshake.findings.critical > 0` as FAIL
- `handshake.mjs` — `findings.critical` field already exists in the schema
- Extension system — operates at a higher layer; `executeRun`/`verdictAppend` remain independent extension points. External validators operate within the gate itself, one level below.

### Data flow

```
gate command executes
    ↓
stdout/stderr captured
    ↓
detectAndParse(stdout, artifactDir, config)     ← NEW
    ↓
validator-findings.json written to artifacts    ← NEW
    ↓
handshake.findings.critical += parsed criticals ← MODIFIED
verdict = (exitCode !== 0 || parsedCritical > 0) ? 'FAIL' : 'PASS'  ← MODIFIED
    ↓
handshake.json written (existing flow)
    ↓
review phase reads handshake + artifacts (existing flow)
```

## Testing Strategy

### Unit tests: `test/validator-parsers.test.mjs`

One `describe` block per parser, each with four cases:
1. **Passing input** (no failures) → empty findings array
2. **Single failure** → one critical finding with correct `file:line — message` text
3. **Multiple failures** → correct count, all findings present
4. **Malformed input** → empty findings array, no throw

Plus one `describe` for `detectAndParse`:
1. **GHA format detected from stdout** → returns `formatDetected: 'gha'`
2. **JUnit XML file in artifact dir** → returns `formatDetected: 'junit'`
3. **Config overrides auto-detection** → uses declared parser
4. **Unknown format** → returns `{ findings: [], formatDetected: null }`

### Fixture files: `test/fixtures/`

- `junit-pass.xml`, `junit-fail.xml` (single + multiple failures)
- `tap-pass.txt`, `tap-fail.txt`
- `gha-fail.txt`
- `generic-fail.json`
- `malformed.xml`

### Integration test: `test/gate-validator-integration.test.mjs`

Write a failing `junit-fail.xml` to a temp dir. Run `runGateInline` with a command that exits 0 but outputs JUnit XML to stdout. Assert:
- `validator-findings.json` exists in artifacts with correct findings
- Verdict is FAIL despite exit code 0
- `handshake.json` has `findings.critical > 0`

## Out of Scope
- Calling external CI APIs (GitHub Actions, CircleCI) to fetch run results — requires auth and network
- Running pre-commit hooks as a separate execution step — handled by `executeRun` in the extension system
- SARIF format — complex, low adoption outside security scanners; defer to a follow-up
- Per-task parser configuration — feature-level `.team/validators.json` is sufficient
- Surfacing parsed findings as GitHub issue comments — achievable via `artifactEmit` extension
- Deduplication of findings between validator output and reviewer output
- Custom parser plugins beyond the four built-in formats

## Done When
- [ ] `bin/lib/validator-parsers.mjs` exists with `parseJunit`, `parseTap`, `parseGhaMatcher`, `parseGenericJson`, and `detectAndParse` exports
- [ ] `gate.mjs:cmdGate()` calls `detectAndParse` after command execution; writes `artifacts/validator-findings.json` when findings present; merges parsed criticals into handshake findings count
- [ ] `run.mjs:runGateInline()` calls `detectAndParse` after command execution; overrides verdict to FAIL when parsed criticals exist; writes `artifacts/validator-findings.json`
- [ ] A gate command that exits 0 but outputs structured failures produces a FAIL verdict
- [ ] `.team/validators.json` config is loaded and respected when present
- [ ] Malformed parser input does not crash the gate — falls back to exit-code verdict
- [ ] Unit tests for all four parsers pass (`test/validator-parsers.test.mjs`)
- [ ] Integration test demonstrates end-to-end: JUnit XML failures → FAIL verdict with `file:line` findings in artifacts
- [ ] Existing test suite (`npm test`) passes with no regressions
