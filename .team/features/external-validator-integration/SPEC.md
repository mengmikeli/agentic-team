# Feature: External Validator Integration

## Goal
Parse structured output from validator tools (test suites, linters, pre-commit hooks) to produce rich emoji-tagged findings that give builder agents precise, actionable failure context — not just a binary exit code.

## Requirements

- A `validators` config block is supported in `.team/validators.json` (workspace-level) and optionally overridden per-feature in SPEC.md under a `## Validators` section.
- Each validator entry specifies: `name` (string), `command` (shell string), `format` (one of `jest-json` | `pytest` | `eslint-json` | `exit-code`), and optional `timeout` (seconds, default 30).
- After the gate command runs, all configured validators execute and their results are collected.
- Each parser extracts structured findings:
  - `jest-json` — reads `--json` reporter output; extracts `numFailedTests`, `numPassedTests`, per-suite failure messages and file:line refs.
  - `pytest` — parses text output; extracts PASSED/FAILED/ERROR counts from summary line and per-failure tracebacks with file:line refs.
  - `eslint-json` — reads `--format json` output; extracts `errorCount`, `warningCount`, per-file messages with line:col refs.
  - `exit-code` — non-zero exit = one 🔴 finding with raw stdout/stderr context (matches current gate behavior, made explicit as a named format).
- Failed validator checks become 🔴 critical findings; validator warnings become 🟡 warning findings; these are appended to the task findings array before `computeVerdict()` runs.
- A validator that times out or crashes (non-parse failure) emits one 🟡 warning finding rather than a hard FAIL, so infrastructure flakiness does not block a run.
- Validator output is written to `validator-{name}.json` in the task artifacts directory alongside `test-output.txt`.
- The gate handshake schema is extended with a `validators` array field recording per-validator outcomes.
- If no validators are configured, behavior is identical to today (no regression).

## Acceptance Criteria

- [ ] `.team/validators.json` is loaded and schema-validated on startup; invalid/missing config emits a warning and skips that validator, never crashing the run.
- [ ] `jest-json` parser: given sample Jest `--json` output with ≥1 failure, produces ≥1 🔴 finding containing the test name and `file:line` reference.
- [ ] `pytest` parser: given sample pytest `-v` output with ≥1 FAILED, produces ≥1 🔴 finding containing the test ID and traceback snippet.
- [ ] `eslint-json` parser: given sample ESLint `--format json` output with ≥1 error, produces ≥1 🔴 finding containing rule name and `file:line` reference.
- [ ] `exit-code` parser: non-zero exit with stdout produces a 🔴 finding with the first 500 chars of stdout; zero exit produces no finding.
- [ ] Validator timeout (≥30s without completion) produces a 🟡 warning finding and does not block the verdict.
- [ ] Validator crash / JSON parse error produces a 🟡 warning finding with the error message.
- [ ] Validator 🔴 findings feed into `computeVerdict()` and cause FAIL when no review findings are present.
- [ ] Gate handshake `validators` array is populated with `{name, format, exitCode, findingCount, timedOut}` for each validator run.
- [ ] `validator-{name}.json` artifact is written to the task artifacts directory for each validator.
- [ ] End-to-end: a feature whose gate command passes (exit 0) but whose Jest validator finds failures → overall gate verdict is FAIL with 🔴 findings referencing the test file.
- [ ] End-to-end: no `validators.json` present → run behaves identically to today (existing tests pass unmodified).

## Technical Approach

**New module: `bin/lib/validators.mjs`**
- `loadValidators(featureDir, workspaceDir)` — reads `.team/validators.json` (workspace) and optional `## Validators` fenced block from SPEC.md (feature-level override). Returns `ValidatorConfig[]`.
- `runValidators(configs, taskArtifactsDir)` → `ValidatorResult[]` — runs each validator command with `execa` under a per-config timeout. Writes `validator-{name}.json` artifacts.
- Parser functions: `parseJestJson(stdout)`, `parsePytest(stdout)`, `parseEslintJson(stdout)`, `parseExitCode(exitCode, stdout)` — each returns `Finding[]` (emoji-prefixed strings matching the existing synthesize.mjs format).
- `toHandshakeValidators(results)` → compact array for handshake schema.

**Modified: `bin/lib/gate.mjs`**
- After executing the gate command, call `runValidators()`.
- Append `toFindings(results)` to the findings array that feeds into `computeVerdict()`.
- Add `validators` field to gate handshake output.

**Modified: `bin/lib/handshake.mjs`**
- Extend gate handshake schema: optional `validators: ValidatorHandshakeEntry[]`.
- `ValidatorHandshakeEntry`: `{ name, format, exitCode, findingCount, timedOut }`.

**Config schema (`.team/validators.json`):**
```json
{
  "validators": [
    { "name": "jest", "command": "npm test -- --json", "format": "jest-json" },
    { "name": "eslint", "command": "npx eslint src --format json", "format": "eslint-json", "timeout": 60 }
  ]
}
```

No new CLI commands required. Validators run automatically whenever `gate.mjs` is invoked if config is present.

## Testing Strategy

- **Unit tests** (`test/validators.test.mjs`):
  - Fixture files: `test/fixtures/jest-output.json`, `test/fixtures/pytest-output.txt`, `test/fixtures/eslint-output.json` — real-world samples with failures.
  - One test per parser: passing output → empty findings; failing output → correct 🔴 findings with file:line refs.
  - Timeout simulation: mock `execa` to hang → confirm 🟡 warning produced within timeout window.
  - Crash simulation: command exits with ENOENT → confirm 🟡 warning finding, no throw.
  - Config loading: missing file → empty array; invalid JSON → warning logged, empty array; valid config → correct ValidatorConfig[].
- **Integration test** (`test/external-validator-integration.test.mjs`):
  - Stub a feature with gate exit 0 but a failing Jest validator → assert final gate verdict is FAIL.
  - Assert `validator-jest.json` artifact written to task artifacts dir.
  - Assert no-config path produces identical behavior to current gate tests.
- **Existing tests must pass unmodified** — zero regressions.

## Out of Scope

- Polling remote CI systems (GitHub Actions, CircleCI, Jenkins) — async network calls, separate feature.
- Auto-installing or configuring pre-commit hooks — user manages their own git hook setup.
- Custom parser plugins via extension system — the `executeRun` extension hook already covers arbitrary validators; this feature targets the four most common formats natively.
- Validator result caching or deduplication across retry attempts.
- Per-task validator overrides (workspace and feature level is sufficient for v1).
- Streaming validator output to the dashboard in real time.

## Done When

- [ ] `bin/lib/validators.mjs` exists with `loadValidators`, `runValidators`, and all four parsers.
- [ ] `bin/lib/gate.mjs` calls validators and appends their findings to the verdict computation.
- [ ] `bin/lib/handshake.mjs` schema extended with optional `validators` array.
- [ ] Unit tests for all four parsers pass with fixture files covering pass and fail cases.
- [ ] Integration test confirms: gate exit 0 + jest failures → overall FAIL with 🔴 findings.
- [ ] Integration test confirms: no `validators.json` → existing behavior unchanged.
- [ ] `test/fixtures/` contains at least one fixture per supported format.
