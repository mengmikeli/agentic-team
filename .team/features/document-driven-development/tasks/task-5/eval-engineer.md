# Engineer Review — task-5 (auto-stub removal)

## Verdict: PASS

## Evidence

### Code change verified
`bin/lib/run.mjs:925-961` — the prior auto-stub branch
(`writeFileSync(specPath, specContent)` writing a minimal spec) is gone.
The current logic is now:
- `existsSync(specPath)` → read SPEC.md, validate required sections
  (`Goal`, `Requirements`, `Acceptance Criteria`, `Technical Approach`,
  `Testing Strategy`, `Out of Scope`, `Done When`); on missing sections,
  print red error listing them and `process.exit(1)` (line 952).
- `else` branch → print red error, point user to `agt brainstorm <feature>`,
  and `process.exit(1)` (line 960).

The `else` branch contains no `writeFileSync`, no `mkdirSync`, no spec
mutation. SPEC.md is left untouched on every error path.

### Behavior is correctly enforced by tests
`test/cli-commands.test.mjs`:
- L266–286 — `agt run` with no SPEC.md exits 1, mentions
  `agt brainstorm <feature>`, and asserts SPEC.md is NOT created.
- L288–322 — partial SPEC.md exits 1, lists missing sections, asserts
  file is byte-for-byte unchanged.
- L324–350 / L352–383 — complete SPEC.md proceeds to planning/dispatch.

### Gate output
`npm test` exit code 0 (per task gate handshake summary). Test output
file referenced by the gate handshake (`artifacts/test-output.txt`) is
not on disk in the current task-5 directory, but the gate command
itself completed and the test names in the prompt match
`test/cli-commands.test.mjs`.

## Findings

🔵 bin/lib/run.mjs:931 — `requiredSections` is duplicated with the same
list in `bin/lib/spec.mjs` (`PRD_SECTIONS` per recent refactor commit
14a4ab6). Importing the shared constant would prevent drift between the
two validation sites. Optional, no merge impact.

🔵 .team/features/document-driven-development/tasks/task-5/handshake.json:9
— Gate handshake lists `artifacts/test-output.txt` but that file is not
present in the task directory (only `eval.md`, `eval-pm.md`,
`handshake.json`). Either the artifact was cleaned up post-gate or the
write was skipped. Worth confirming the gate writer path on subsequent
runs, but does not affect correctness of this task's implementation.

## Per-criterion

- **Correctness**: PASS — auto-stub branch is removed; both error
  paths exit non-zero with actionable messages; SPEC.md is never
  mutated by `agt run`.
- **Code quality**: PASS — error messages are clear, structure is
  symmetric (validate-or-exit / missing-or-exit). One minor duplication
  flagged as 🔵.
- **Error handling**: PASS — both failure modes use `console.error` and
  `process.exit(1)`, properly distinguishing missing-file from
  invalid-content.
- **Performance**: N/A — single file read, no hot path.
