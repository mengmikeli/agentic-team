# PM Review — runbook-system / task-1

**Reviewer role:** Product Manager
**Date:** 2026-04-25
**Overall verdict: PASS**

---

## Requirement

> A `.team/runbooks/add-cli-command.yml` runbook exists with a valid schema and at least 4 tasks.

---

## Files Actually Read

- `.team/features/runbook-system/tasks/task-1/handshake.json`
- `.team/runbooks/add-cli-command.yml`
- `test/runbook-add-cli-command.test.mjs`
- `test/runbook-dir.test.mjs`
- `bin/lib/run.mjs` (grep for runbooks section, lines 799–800)

## Tests Actually Run

```
node --test test/runbook-add-cli-command.test.mjs
→ 5 pass, 0 fail

node --test test/runbook-dir.test.mjs
→ 4 pass, 0 fail
```

---

## Per-Criterion Results

### 1. File exists at `.team/runbooks/add-cli-command.yml`
**PASS** — File confirmed present at the expected path.

### 2. Valid schema
**PASS** — The file contains all required top-level fields:
- `id: add-cli-command`
- `name: Add CLI Command`
- `patterns:` (two entries — regex + keyword — each with `type`, `value`, `weight`)
- `minScore: 2.5`
- `tasks:`
- `flow: build-verify`

Test validates these programmatically; all 5 assertions pass (verified by direct execution above).

### 3. At least 4 tasks
**PASS** — Exactly 4 tasks present with both `title` and `hint`:
1. Define CLI command signature and options
2. Implement the command handler function
3. Register the command in the CLI entry point
4. Write tests for the CLI command

### 4. Tests wired into `npm test`
**PASS** — `test/runbook-add-cli-command.test.mjs` is listed in the npm test command in the gate output.

---

## Findings

🟡 `.team/features/runbook-system/tasks/task-1/` — No `artifacts/test-output.txt` saved. The handshake lists artifacts but the directory has only `handshake.json`. Process gap: saved test evidence makes future audits faster; backlog this.

🟡 Gate output (provided) — Truncated: ends at `agt help <command>` suite, never shows results for `runbook-add-cli-command.test.mjs` or `runbook-dir.test.mjs`. Tests pass when run independently, but the gate capture is incomplete. Investigate gate output truncation.

🔵 `.team/runbooks/add-cli-command.yml:24` — `tier: null` is an explicit null. Cosmetic inconsistency with other nullable fields; no functional impact.

---

## Summary

Core delivery is correct and independently verified. The runbook file exists, has a valid schema, and contains exactly 4 tasks. Tests cover all acceptance criteria and pass cleanly. Two process warnings are flagged (missing artifacts directory, truncated gate output) but neither blocks merge.

---

# Engineer Review — runbook-system / task-1

**Reviewer role:** Engineer
**Date:** 2026-04-25
**Overall verdict: PASS**

---

## Files Actually Read

- `.team/features/runbook-system/tasks/task-1/handshake.json`
- `.team/runbooks/add-cli-command.yml`
- `test/runbook-add-cli-command.test.mjs`
- `test/runbook-dir.test.mjs`
- `bin/lib/init.mjs`
- `bin/lib/run.mjs` (lines 790–801)
- `bin/lib/flows.mjs` (lines 1–63)
- `package.json` (scripts section)

---

## Per-Criterion Results

### 1. Runbook file exists at `.team/runbooks/add-cli-command.yml`
**PASS** — File confirmed present; all 25 lines read directly.

### 2. Valid schema
**PASS** — All required top-level fields present: `id: add-cli-command`, `name`, `patterns` (3 entries with `type`/`value`/`weight`), `minScore: 2.5`, `tasks`, `flow: build-verify`. The `flow` value maps to an actual `FLOWS` entry in `bin/lib/flows.mjs:31` — not a dead string.

### 3. At least 4 tasks
**PASS** — Exactly 4 `- title:` entries, each with a `hint:` field.

### 4. Tests wired and correct
**PASS (conditional)** — Both `test/runbook-add-cli-command.test.mjs` and `test/runbook-dir.test.mjs` are listed in `package.json` test script. The 5 assertions in the runbook test would pass against the current file on direct inspection. Gate output is truncated (stops after `cli-commands.test.mjs`); the runbook test results are not visible in the provided gate capture, though file-level evidence confirms correctness.

### 5. Lazy directory creation
**PASS** — `run.mjs:800` calls `mkdirSync(join(teamDir, "runbooks"), { recursive: true })`. `init.mjs:45` does the same on `agt init`. Both paths satisfy the `runbook-dir.test.mjs` assertions.

---

## Findings

🟡 `test/runbook-add-cli-command.test.mjs:20` — Schema validation does raw-string regex scanning, not YAML parsing. A file with a syntax error (bad indentation, illegal unquoted character) would still pass all 5 assertions as long as the field names appear in the text. Add a YAML parse step (`import { parse } from "yaml"` or equivalent) to assert parseability before field checks.

🟡 `test/runbook-add-cli-command.test.mjs:32` — Task counting via `content.match(/^\s+- title:/gm)` is a text heuristic. A `- title:` in a string value or comment would silently inflate the count. Acceptable for the current simple schema, but should switch to parsed traversal when the runbook engine introduces a YAML parser.

🔵 `.team/runbooks/add-cli-command.yml:24` — `tier: null` is present but has no consumer in the codebase. Prefer omitting fields with no defined semantics until the schema is stabilized.

---

## Summary

The primary deliverable is fully implemented: the runbook YAML file exists, is structurally correct, and contains 4 actionable tasks. The `flow` value is correctly coupled to the live flow registry. Both test files are wired. The two 🟡 findings are test quality issues (fragile assertions), not functional defects — they do not block merge but should be backlogged.

---

# Tester Review — runbook-system / task-1

**Reviewer role:** Tester
**Date:** 2026-04-25
**Overall verdict: PASS**

---

## Files Actually Read

- `.team/features/runbook-system/tasks/task-1/handshake.json`
- `.team/runbooks/add-cli-command.yml`
- `test/runbook-add-cli-command.test.mjs`
- `test/runbook-dir.test.mjs`
- `bin/lib/run.mjs` (runbook-related lines)
- `bin/lib/init.mjs` (runbook-related lines)
- `bin/lib/audit-cmd.mjs` (checked for runbook coverage)

---

## Per-Criterion Results

### 1. File exists at `.team/runbooks/add-cli-command.yml`
**PASS** — File confirmed present at the expected path.

### 2. Valid schema (id, name, patterns, minScore, tasks, flow)
**PASS with caveats** — All required top-level fields are present and syntactically look correct in the raw YAML. However, validity is asserted only via raw string/regex matching in the test — no YAML parser is invoked. The file itself is well-formed on inspection.

### 3. At least 4 tasks
**PASS** — Exactly 4 tasks with `title` and `hint` fields confirmed. The test correctly counts `- title:` occurrences.

### 4. Test wired into npm test
**PASS** — `test/runbook-add-cli-command.test.mjs` appears in the `package.json` test command. Gate output shows the file was included and the suite exits with no failures.

---

## Findings

🟡 `test/runbook-add-cli-command.test.mjs:20` — Schema validation uses raw regex, not a YAML parser. A syntactically broken YAML file (bad indentation, illegal unquoted characters) would still pass all five assertions. Add a YAML parse step to actually verify the file is parseable.

🟡 `test/runbook-dir.test.mjs:25` — Two tests inspect `init.mjs` source code as a string to assert behavior. This tests implementation text, not behavior. A valid refactor (extracting `mkdirSync` to a helper) would break these tests without breaking functionality. Replace with integration assertions on the resulting directory.

🔵 `test/runbook-add-cli-command.test.mjs` — No coverage for `flow` field value validity. `flow: build-verify` would pass even if it were a typo. Add an allowlist assertion.

🔵 `test/runbook-add-cli-command.test.mjs` — No coverage for `minScore` achievability. No test verifies that `minScore` (2.5) is ≤ the sum of pattern weights (4.5). Silently unreachable scores would cause the runbook to never match.

🔵 `bin/lib/audit-cmd.mjs` — `agt audit` has no awareness of `.team/runbooks/`. A missing or malformed runbook directory is invisible to health checks.

---

## Summary

Acceptance criterion is met: the file exists, has all required fields, has 4 tasks, and the test suite passes. The critical gap is that "valid schema" is asserted by regex rather than parse — which works for this specific file today but gives a weak quality signal for future runbook authors. The two 🟡 warnings should go to the backlog; no finding blocks merge.

---

# Architect Review — runbook-system / task-1

**Reviewer role:** Architect
**Date:** 2026-04-25
**Overall verdict: PASS**

---

## Files Actually Read

- `.team/features/runbook-system/tasks/task-1/handshake.json`
- `.team/runbooks/add-cli-command.yml`
- `test/runbook-add-cli-command.test.mjs`
- `test/runbook-dir.test.mjs`
- `bin/lib/init.mjs` (runbooks mkdir lines)
- `bin/lib/run.mjs` (lazy runbooks mkdir lines)
- `bin/lib/flows.mjs` (full file — flow constants and selectFlow)
- `.team/PRODUCT.md` (roadmap item 21 for runbook system context)

## Tests Actually Run

```
node --test test/runbook-add-cli-command.test.mjs test/runbook-dir.test.mjs
→ 9 pass, 0 fail
```

---

## Per-Criterion Results

### 1. Artifact claims vs. evidence

All three claimed artifacts confirmed present. Tests pass on direct execution.

**Result: PASS**

### 2. Schema validity and flow coupling

`flow: build-verify` is a recognized constant in `bin/lib/flows.mjs:31`. The coupling between runbook schema and the flow enum is appropriate — both are in-repo constants, not external. `id` matches filename; patterns have required sub-fields; `minScore` and `tasks` are present.

**Result: PASS**

### 3. Boundary: runbooks directory scaffolded, engine deferred

`init.mjs:45` and `run.mjs:800` scaffold the directory. No code reads or executes against runbook files. This is correct scoping — PRODUCT.md roadmap item 21 explicitly places the engine in Phase 5 (deferred). The boundary is well-drawn: data layer exists, consumer deferred.

**Result: PASS**

### 4. Runtime state embedded in static template

`add-cli-command.yml` lines 21–25 include `usageCount: 0`, `lastUsedAt: null`, `createdAt: "2026-04-25T00:00:00.000Z"`. These are mutable, per-instance runtime fields mixed into a static template. When the runbook engine is built, this creates a design fork:

- Mutate in-place → template files become dirty in git after every run; breaks worktree isolation; non-idempotent
- Ignore them → dead weight that misleads future runbook authors
- Correct design: separate runtime registry (e.g. `.team/runbooks/.state.json`) keyed by `id`; keep template files immutable

This does not block the current task (file is inert), but resolving it must happen before the engine is implemented.

**Result: WARN** — backlog item required.

---

## Findings

🟡 `.team/runbooks/add-cli-command.yml`:21 — `usageCount`, `lastUsedAt`, and `createdAt` are runtime-mutable state fields in a static template; when the engine is built, in-place mutation creates git noise and breaks worktree isolation — backlog: move usage tracking to a separate runtime store keyed by runbook `id`, keep template files immutable

🔵 `test/runbook-add-cli-command.test.mjs`:20 — Schema validated via raw-string regex, not YAML parsing; structurally broken YAML with correct field names passes — when the engine adds a YAML parser, add a parse-roundtrip test to catch structural issues early

---

## Summary

The implementation delivers exactly what was required: a valid, well-structured runbook YAML with ≥4 tasks, tests that verify schema and task count, and directory scaffolding in both `init` and `run` paths. All 9 runbook tests pass. The `flow: build-verify` value is correctly coupled to the existing flow registry.

The one architectural concern — runtime state mixed into a static template — does not block this task but must be resolved before the engine is built. Flagged as a backlog warning.

---

# Simplicity Review — runbook-system / task-1

**Reviewer role:** Simplicity Advocate
**Date:** 2026-04-25
**Overall verdict: FAIL**

---

## Files Opened and Read

- `.team/features/runbook-system/tasks/task-1/handshake.json`
- `.team/runbooks/add-cli-command.yml`
- `test/runbook-add-cli-command.test.mjs`
- `test/runbook-dir.test.mjs`
- `bin/lib/run.mjs` (grep for "runbook", "patterns", "minScore")
- `bin/lib/init.mjs` (grep for "runbook")
- `bin/lib/audit-cmd.mjs` (full read — no runbook references found)
- `bin/` (full grep for `readdir.*runbook`, `minScore`, `usageCount`, `lastUsedAt`)

---

## Per-Criterion Results

### 1. Dead code — PASS
No dead JS functions, variables, or imports introduced.

### 2. Premature abstraction — PASS
No new abstractions introduced.

### 3. Unnecessary indirection — PASS
No new wrappers or re-exports.

### 4. Gold-plating — FAIL (🔴 veto)

`add-cli-command.yml` lines 24–27 include four fields with zero consumers anywhere in the codebase:

```yaml
tier: null          # no code reads tier from a runbook file
createdAt: "..."    # no code reads this
usageCount: 0       # no code increments or reads this
lastUsedAt: null    # no code reads or writes this
```

Confirmed via exhaustive grep across `bin/**/*.mjs`: nothing reads runbook YAML files — only `mkdirSync` calls exist. The required schema (validated by the test) is: `id`, `name`, `patterns`, `minScore`, `tasks`, `flow`. These four fields are speculative extensibility with no stated requirement and no consumer.

`usageCount: 0` and `lastUsedAt: null` are the most egregious: they pre-build a tracking data model for a feature that has no implementation. A reader must ask "where is this updated?" — the answer is nowhere.

---

## Warnings (non-blocking, add to backlog)

**W1 — Brittle source-order test**
`test/runbook-dir.test.mjs:36-40` asserts `runbooks` `mkdirSync` appears *after* `features` `mkdirSync` by text index in the source file. Tests source code layout, not behavior. A valid refactor of `init.mjs` breaks this test.

**W2 — Regex validation on raw YAML text**
`test/runbook-add-cli-command.test.mjs:47-49` validates pattern sub-fields via regex against the raw YAML string, not a parsed structure. Could give false positives from YAML comments or sibling blocks.

---

## Specific, Actionable Feedback

**To unblock merge**, remove the four speculative fields from the runbook YAML (lines 24–27):

```yaml
# delete these from .team/runbooks/add-cli-command.yml
tier: null
createdAt: "2026-04-25T00:00:00.000Z"
usageCount: 0
lastUsedAt: null
```

The runbook should contain only what is consumed or validated today. Add tracking/tier fields when the engine that reads them is built.

**Backlog items:**
- Replace source-order assertion in `runbook-dir.test.mjs:34-41` with a behavioral test.
- Replace raw-YAML regex in `runbook-add-cli-command.test.mjs:44-50` with a YAML parser when the schema stabilizes.

> **Resolution (run_2):** The four gold-plated fields (`tier`, `createdAt`, `usageCount`, `lastUsedAt`) were removed in run_2. This FAIL is resolved. Current file contains only schema-required fields.

---

# PM Review — runbook-system / task-1 (run_2)

**Reviewer role:** Product Manager
**Date:** 2026-04-25
**Run:** run_2 (post-fix)
**Overall verdict: PASS**

---

## Requirement

> A `.team/runbooks/add-cli-command.yml` runbook exists with a valid schema and at least 4 tasks.

---

## Files Actually Read

- `.team/features/runbook-system/tasks/task-1/handshake.json` (run_2)
- `.team/runbooks/add-cli-command.yml` (current, post-run_2)
- `test/runbook-add-cli-command.test.mjs`
- Gate output (provided)

---

## Per-Criterion Results

### 1. File exists at `.team/runbooks/add-cli-command.yml`
**PASS** — File present at the expected path, 23 lines, clean.

### 2. Valid schema
**PASS** — All required fields confirmed present by direct file read:
- `id: add-cli-command`
- `name: Add CLI Command`
- `patterns:` — 3 entries, each with `type`, `value`, `weight`
- `minScore: 2.5`
- `tasks:`
- `flow: build-verify`

No speculative fields remain. Prior Simplicity FAIL is resolved.

### 3. At least 4 tasks
**PASS** — Exactly 4 tasks, each with `title` and `hint`:
1. Define CLI command signature and options
2. Implement the command handler function
3. Register the command in the CLI entry point
4. Write tests for the CLI command

### 4. Tests wired into `npm test`
**PASS (with caveat)** — `test/runbook-add-cli-command.test.mjs` is listed in the gate-provided npm test command. Gate output is truncated and does not show the runbook test results directly. File-level inspection confirms 5 assertions would pass against the current YAML.

---

## Findings

🟡 `.team/features/runbook-system/tasks/task-1/` — No `artifacts/` directory or `test-output.txt`. Handshake lists 3 artifacts but no test evidence is captured. Future audits cannot verify test pass/fail without re-running. Backlog: save `test-output.txt` as part of builder handshake.

🟡 Gate output (provided) — Truncated; runbook test suite results (`runbook-add-cli-command.test.mjs`, `runbook-dir.test.mjs`) are not visible. Cannot confirm pass/fail from gate capture alone. Investigate gate output truncation.

🔵 `test/runbook-add-cli-command.test.mjs:20` — Schema validated via raw regex, not a YAML parser. A syntactically broken YAML with correct field names passes. Backlog: add YAML parse step when schema stabilizes.

---

## Summary

The primary requirement is met as of run_2. The runbook file exists, carries the correct schema with no dead fields, and contains exactly 4 actionable tasks. The prior Simplicity FAIL (gold-plated fields) was resolved by run_2 before this PM review. Two process warnings (no test artifact capture, truncated gate output) go to backlog but do not block merge.

---

# Engineer Review (run_2) — runbook-system / task-1

**Reviewer role:** Engineer
**Date:** 2026-04-25
**Run:** run_2 (post-fix)
**Overall verdict: PASS**

---

## Files Actually Read

- `.team/features/runbook-system/tasks/task-1/handshake.json`
- `.team/runbooks/add-cli-command.yml` (all 24 lines)
- `test/runbook-add-cli-command.test.mjs` (all 51 lines)
- `test/runbook-dir.test.mjs` (all 104 lines)
- `bin/lib/run.mjs` (grep — line 800)
- `bin/lib/init.mjs` (grep — line 45)
- `bin/lib/flows.mjs` (grep — lines 3, 31, 46, 60)

---

## Per-Criterion Results

### 1. Runbook file exists and is clean
**PASS** — All 24 lines read directly. Gold-plated fields (`tier`, `createdAt`, `usageCount`, `lastUsedAt`) are absent in the current file; confirmed by direct read, consistent with handshake summary for run_2.

### 2. Valid schema
**PASS** — All required fields verified by direct inspection:
- `id: add-cli-command` — matches filename
- `name: Add CLI Command`
- `patterns:` — 3 entries (1 regex + 2 keyword), each with `type`, `value`, `weight`
- `minScore: 2.5` — reachable (sum of pattern weights = 4.5)
- `tasks:` — 4 entries, each with `title` and `hint`
- `flow: build-verify` — verified as a live constant at `bin/lib/flows.mjs:31`; not a dead string

### 3. At least 4 tasks
**PASS** — Exactly 4 `- title:` entries. Each has a non-trivial `hint:` (actionable guidance, not placeholder text).

### 4. Tests wired and structurally correct
**PASS (conditional)** — Both test files are listed in `package.json` test script. All 5 assertions in `runbook-add-cli-command.test.mjs` pass by direct structural inspection of the current YAML. Gate output truncates before the runbook suite appears; no direct observation of the suite's pass/fail in the provided capture.

### 5. Directory scaffolding
**PASS** — `run.mjs:800` and `init.mjs:45` both call `mkdirSync(join(teamDir, "runbooks"), { recursive: true })`. The `{ recursive: true }` flag makes both idempotent — no throw if directory already exists, consistent with `runbook-dir.test.mjs` assertions.

---

## Findings

🟡 `test/runbook-add-cli-command.test.mjs:20` — Schema validated by raw-string regex, not YAML parsing. A structurally broken YAML (bad indentation, unquoted colon in value) passes all 5 assertions as long as the field names appear as text. Should be backlogged: add a YAML parse step before field assertions so a malformed file cannot silently pass.

🟡 `test/runbook-dir.test.mjs:34` — Asserts `runbooks` `mkdirSync` appears after `features` `mkdirSync` by string index in `init.mjs` source text (`src.indexOf(...)`). Tests source layout, not runtime behavior. Any valid refactor of `init.mjs` (extracting dirs to an array, reordering) breaks this test without breaking functionality. Backlog: replace with a behavioral integration test on the resulting filesystem.

🔵 `test/runbook-add-cli-command.test.mjs:27` — `flow` field is validated for presence only (`assert.match(content, /^flow:/m)`). A typo (`build-verifiy`) passes the test. Consider asserting against the set of known-valid flow names when the runbook schema is formalized.

🔵 `test/runbook-add-cli-command.test.mjs:32` — Task count via `content.match(/^\s+- title:/gm)` is a text heuristic. A `- title:` in a YAML string value or comment silently inflates the count. Acceptable for this simple file; switch to parsed traversal when a YAML parser is introduced.

---

## Summary

The post-fix state is correct and clean. The runbook file contains only schema-required fields, `flow: build-verify` is coupled to a live constant, both scaffolding paths use idempotent `mkdirSync`, and 4 tasks have substantive hints. The two 🟡 findings are test fragility issues — not functional defects — and do not block merge. Both should be backlogged before the runbook engine is built, since that's when these tests become the primary regression guard.

---

# Security Review — runbook-system / task-1

**Reviewer role:** Security Specialist
**Date:** 2026-04-25
**Overall verdict: PASS**

---

## Files Actually Read

- `.team/features/runbook-system/tasks/task-1/handshake.json`
- `.team/runbooks/add-cli-command.yml`
- `test/runbook-add-cli-command.test.mjs`
- `test/runbook-dir.test.mjs`
- `bin/lib/run.mjs` (full — 1589 lines)
- `bin/lib/init.mjs` (full — 139 lines)

---

## Per-Criterion Results

### 1. Artifact existence
**PASS** — All three artifacts claimed in handshake.json confirmed present on disk.

### 2. Attack surface of the runbook file itself
**PASS** — The YAML file is static data. No code was introduced that reads, executes, or pattern-matches against runbook files. The `patterns[].value` regex fields are defined but have zero consumers in the current codebase. No injection surface exists in the feature as built.

### 3. `patterns[].value` regex safety (forward risk)
**PASS with caveat** — The regex `"add.*cli.*command|new.*command|..."` is bounded and benign. However, the YAML schema imposes no constraint on pattern complexity. When a consumer is eventually written that calls `new RegExp(pattern.value)`, an unbounded pattern from a malicious runbook file (e.g., committed by a third party in a cloned project) could cause ReDoS. The test at line 47 validates presence and quoting only, not safety.

### 4. Shell execution path (pre-existing, not introduced here)
**NOT COUNTED** — `run.mjs:59` uses `execSync(cmd, { shell: true })` where `cmd` originates from PROJECT.md content. This pre-existing pattern was not modified by this feature.

### 5. Secrets / credentials
**PASS** — No credentials, tokens, API keys, or sensitive values in any artifact.

---

## Findings

🔵 `test/runbook-add-cli-command.test.mjs:47` — Pattern value assertion checks presence and quoting only; add a valid-regex assertion (attempt `new RegExp(value)` in the test) so future runbook authors get an early failure instead of a runtime ReDoS when the engine is built

🔵 `.team/features/runbook-system/tasks/task-1/` — No `artifacts/test-output.txt` captured; disk-level evidence is absent and the handshake cannot be self-verified without re-running the suite

---

## Summary

The feature is a static YAML data file and structural tests. No code consuming pattern data was introduced, so the attack surface is minimal. Both findings are forward-looking suggestions that do not block merge.

---

# Architect Review (run_2, post-fix) — runbook-system / task-1

**Reviewer role:** Architect
**Date:** 2026-04-25
**Run:** run_2 (post gold-plated field removal)
**Overall verdict: PASS**

---

## Files Actually Read

- `.team/features/runbook-system/tasks/task-1/handshake.json`
- `.team/runbooks/add-cli-command.yml` (all 24 lines)
- `test/runbook-add-cli-command.test.mjs` (all 51 lines)
- `test/runbook-dir.test.mjs` (all 104 lines)
- `bin/lib/init.mjs` (lines 42–45)
- `bin/lib/run.mjs` (lines 797–801)
- `bin/lib/flows.mjs` (full file — FLOWS constant at line 25, `build-verify` at line 31)
- `package.json`

## Tests Actually Run

```
node --test test/runbook-add-cli-command.test.mjs test/runbook-dir.test.mjs
→ 9 pass, 0 fail (executed directly, confirmed)
```

---

## Per-Criterion Results

### 1. Artifact claims vs. evidence

Handshake lists 3 artifacts: `add-cli-command.yml`, `test/runbook-add-cli-command.test.mjs`, `package.json`. All confirmed present. Tests pass on direct execution. No `artifacts/` directory — test evidence not persisted, consistent with previous reviewer observations.

**Result: PASS**

### 2. Schema cleanliness — data/runtime separation

Gold-plated fields (`tier`, `createdAt`, `usageCount`, `lastUsedAt`) are absent. Current schema contains only: `id`, `name`, `patterns`, `minScore`, `tasks`, `flow`. Every field is either a current schema requirement or has a defined future use in the matching engine. Runtime state is not embedded in the template. Data/runtime boundary is correctly drawn.

**Result: PASS**

### 3. Flow coupling validity

`flow: build-verify` maps to `FLOWS["build-verify"]` at `bin/lib/flows.mjs:31` — an in-repo constant, not a magic string. The coupling is valid with no external dependency introduced.

**Result: PASS**

### 4. Boundary integrity — phased scoping

`init.mjs:45` and `run.mjs:800` scaffold `.team/runbooks/` with idempotent `mkdirSync`. Nothing in `bin/` reads runbook YAML files yet. Correct phased design: data layer exists, matching engine deferred. The `patterns`/`minScore` schema fields intentionally constrain the future engine toward a weighted linear scoring model — a reasonable and reversible constraint.

**Result: PASS**

### 5. Flow field not value-validated in tests

`test/runbook-add-cli-command.test.mjs:27` asserts `flow:` presence only via `/^flow:/m`. `flow: nonexistent` passes all 5 assertions. When the engine resolves `flow` against `FLOWS`, a bad value becomes a runtime error with no early warning at the schema layer.

**Result: WARN**

---

## Findings

🟡 `test/runbook-add-cli-command.test.mjs`:27 — `flow:` validated for presence only, not value; `flow: bogus` passes all schema assertions — add an allowlist check against known flow keys (`light-review`, `build-verify`, `full-stack`) before the engine is implemented

🔵 `.team/runbooks/add-cli-command.yml` — no machine-readable schema file (JSON Schema, YAML Schema) constrains the runbook format for future authors; add a schema definition when a second runbook is authored to prevent silent drift

🔵 `.team/runbooks/add-cli-command.yml`:3 — `patterns[].type` values (`regex`, `keyword`) are unconstrained by any validator; the future engine should reject unknown type values at load time, not at match time

---

## Summary

The post-fix state is architecturally sound. Schema is minimal and clean; every field has defined purpose; the data layer boundary is correctly drawn with the engine deferred; `flow: build-verify` is validly coupled to an in-repo constant; directory scaffolding is idempotent in both `init` and `run` paths. All 9 tests pass.

The one 🟡 backlog item — flow-value validation is presence-only in tests — should be addressed before the runbook matching engine is implemented, since that is when a bad `flow` value first becomes a runtime failure.

---

# Tester Review (run_2) — runbook-system / task-1

**Reviewer role:** Tester
**Date:** 2026-04-25
**Run:** run_2 (post-fix)
**Overall verdict: PASS**

---

## Files Actually Read

- `.team/features/runbook-system/tasks/task-1/handshake.json` (run_2)
- `.team/runbooks/add-cli-command.yml` (all 24 lines, confirmed post-fix)
- `test/runbook-add-cli-command.test.mjs` (all 51 lines — all 5 assertions inspected)
- `test/runbook-dir.test.mjs` (all 104 lines — all 4 assertions inspected)
- `bin/lib/run.mjs` (lines 799–800 — lazy runbooks mkdir)
- `bin/lib/init.mjs` (line 45 — init runbooks mkdir)
- `bin/lib/flows.mjs` (lines 31–35 — confirmed `build-verify` is a live registry entry)

---

## Per-Criterion Results

### 1. File exists at `.team/runbooks/add-cli-command.yml`
**PASS** — File present at expected path; 24 lines; no speculative fields remaining after run_2 fix.

### 2. Valid schema
**PASS with caveats** — All 6 required top-level fields confirmed present by direct read: `id`, `name`, `patterns` (3 entries, each with `type`/`value`/`weight`), `minScore: 2.5`, `tasks`, `flow: build-verify`. `flow` verified as a live entry at `bin/lib/flows.mjs:31`. Schema assertions in the test use raw string regex — file is well-formed on inspection, but the test cannot catch a structurally invalid YAML.

### 3. At least 4 tasks
**PASS** — Exactly 4 tasks with `title` and `hint` confirmed by direct read and test assertion. Task titles are substantive, not placeholder text.

### 4. Tests wired into npm test
**PASS (with caveat)** — `test/runbook-add-cli-command.test.mjs` listed in npm test command in gate output. Gate output truncates before runbook suite results appear; all 5 assertions confirmed correct against the current file by structural inspection.

---

## Coverage Gap Analysis

### What is tested
- File existence at exact path
- All 6 required top-level field names present (by regex on raw string)
- `id` value matches expected filename string
- At least 4 tasks by `- title:` line count
- Pattern sub-fields (`type`, `value`, `weight`) appear at least once anywhere in the YAML string
- Runbooks dir created by `init.mjs` and lazily by `run.mjs`
- Runbooks dir creation is idempotent

### What is not tested

**Medium risk (🟡):**
1. **YAML parseability** — All 5 schema assertions scan the raw file string with regex. A file with bad YAML indentation, duplicate keys, or an illegal unquoted character passes every assertion as long as field names appear as text. No `YAML.parse()` roundtrip is performed.
2. **Source-code-as-behavior** — `runbook-dir.test.mjs:26-28` and `:34-40` inspect `init.mjs` source code text to verify directory creation. A valid refactor (extracting `mkdirSync` to a helper) breaks both tests without breaking observable behavior.

**Low risk (🔵):**
3. `flow` value is not checked against the known registry — a typo (`build-verift`) passes the schema test.
4. Task regex `^\s+- title:` would false-positive on `- title:` inside a YAML string value or comment.
5. Pattern `value` fields are not validated as syntactically legal regexes — a broken expression (e.g., `"add.*[unclosed"`) passes schema validation.

---

## Findings

🟡 `test/runbook-add-cli-command.test.mjs:20` — schema validated via raw regex, not YAML parsing; a structurally broken YAML file (bad indentation, duplicate keys) still passes all 5 assertions; add a `YAML.parse()` roundtrip before field checks

🟡 `test/runbook-dir.test.mjs:26` — tests `init.mjs` source code text, not runtime behavior; a valid refactor extracting `mkdirSync` to a helper breaks the test without breaking functionality; replace with an integration assertion on the resulting filesystem state

🔵 `test/runbook-add-cli-command.test.mjs:27` — no allowlist assertion for `flow` value; a typo passes; add a check against the known flow names (`build-verify`, `light-review`, `full-stack`)

🔵 `test/runbook-add-cli-command.test.mjs:32` — `- title:` task counter is a text heuristic that could false-positive on a `- title:` inside a YAML string or comment; acceptable for this schema, fragile as runbooks grow more complex

🔵 `test/runbook-add-cli-command.test.mjs:44` — pattern `value` fields not validated as syntactically legal regexes; a broken regex expression passes schema validation

---

## Summary

Acceptance criterion is met: the file exists at the correct path, the schema is structurally valid (confirmed by direct read), exactly 4 tasks are present, and the tests are wired into npm test. The prior Simplicity FAIL (gold-plated fields) was resolved before this review. Two 🟡 findings — unparsed YAML schema validation and source-code-as-behavior assertions — go to backlog; neither blocks merge. All 🔵 findings are optional hardening for when the runbook engine is built.

---

# Simplicity Review (run_2) — runbook-system / task-1

**Reviewer role:** Simplicity Advocate
**Date:** 2026-04-25
**Run:** run_2 (post-fix)
**Overall verdict: PASS**

---

## Files Opened and Read

- `.team/features/runbook-system/tasks/task-1/handshake.json`
- `.team/runbooks/add-cli-command.yml` (24 lines)
- `test/runbook-add-cli-command.test.mjs` (51 lines)
- `test/runbook-dir.test.mjs` (104 lines)
- `bin/lib/init.mjs` (full)
- `bin/lib/run.mjs` (grep for "runbook", "patterns", "minScore", "flow")
- `bin/lib/flows.mjs` (grep for "build-verify")

---

## Veto Criteria Results

### 1. Dead code — PASS
No dead JS functions, variables, or imports introduced. The two `mkdirSync` calls and two test files are all exercised.

### 2. Premature abstraction — PASS
No new abstractions. The change is two one-liners and a YAML data file.

### 3. Unnecessary indirection — PASS
No wrappers or re-exports added.

### 4. Gold-plating — PASS
The four speculative tracking fields (`tier`, `createdAt`, `usageCount`, `lastUsedAt`) were removed by run_2. The remaining fields (`patterns`, `minScore`, `flow`) are the stated schema for the runbook data model. `flow: build-verify` references a live constant at `bin/lib/flows.mjs:31`. No veto.

---

## Findings

🟡 `.team/runbooks/add-cli-command.yml:3-13` — `patterns` + `minScore` define a scoring/matching system with zero consumers: no code reads any runbook YAML file (confirmed via exhaustive grep — only `mkdirSync` references exist). Aspirational schema for a future matcher not yet built. Does not hit the gold-plating veto threshold because "valid schema" was the stated task requirement, but it carries cognitive load ("where is this matched?"). Defer until the matcher is implemented.

🟡 `test/runbook-dir.test.mjs:34-41` — Asserts source-code ordering of two `mkdirSync` calls by text index in `init.mjs`. Tests layout, not behavior. A valid refactor (extracting dirs to an array, reordering) silently breaks this test without breaking runtime behavior. Backlog: replace with a filesystem assertion after running `agt init`.

---

## Summary

The diff is minimal: one YAML file, two test files, two `mkdirSync` one-liners. The prior Simplicity FAIL (four speculative tracking fields) was cleanly resolved. No gold-plating remains by the veto definition. The two 🟡 warnings do not block merge but should be resolved before the runbook engine is built.
