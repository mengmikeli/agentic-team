# Simplicity Eval: task-2 — add-github-integration.yml runbook

**Reviewer role:** Simplicity
**Date:** 2026-04-25
**Overall Verdict: PASS**

---

## Requirement

> A `.team/runbooks/add-github-integration.yml` runbook exists with a valid schema and at least 4 tasks.

---

## Veto-Category Checks

### Dead code
**PASS** — No dead code. Both deliverables (YAML runbook and test file) are exercised: the runbook is read by the test, and the test runs in `npm test`. No commented-out blocks, unreachable branches, or unused imports.

### Premature abstraction
**PASS** — No new abstractions introduced. The test file repeats the same five assertions as `runbook-add-cli-command.test.mjs` via copy-paste rather than a shared helper. This is the *less* abstract choice, not more. No interface with a single implementation, no new class or factory.

### Unnecessary indirection
**PASS** — The test reads the YAML file directly via `readFileSync` + regex. No wrapper layer, no adapter, no re-export.

### Gold-plating
**PASS** — The `patterns` / `minScore` schema fields are defined in the YAML but no production code currently reads them (confirmed by grepping all `bin/**/*.mjs` — only `run.mjs` references `runbooks`, and only to `mkdirSync` the directory). This looks like speculative extensibility, but the task is explicitly to produce a runbook data file with a valid schema for the system that's being built. The file is the spec artefact, not a feature flag or unused config knob. The schema fields are stated requirements of the runbook format, not gold-plating by the builder.

---

## Per-Criterion Results

### File exists + schema valid
**PASS** — Read `.team/runbooks/add-github-integration.yml` directly. All six required top-level fields present: `id`, `name`, `patterns`, `minScore`, `tasks`, `flow`.

### At least 4 tasks
**PASS** — 5 tasks confirmed (lines 17–28). Threshold is ≥4.

### Test coverage
**PASS** — `test/runbook-add-github-integration.test.mjs` runs 5 assertions. Gate output shows 546 tests, 544 pass, 0 fail.

---

## Findings

🔵 `.team/runbooks/add-github-integration.yml:8` — `"github integration"` keyword (weight 1.5) is a semantic subset of the regex `github.*integrat` on line 5; if a runbook reader is ever implemented, this pattern can never contribute a unique score increment — consider replacing with a more distinct signal like `"gh api"` or removing it

---

## Files Actually Read

- `.team/runbooks/add-github-integration.yml` (all 29 lines)
- `.team/runbooks/add-cli-command.yml` (all 24 lines, for comparison)
- `test/runbook-add-github-integration.test.mjs` (all 51 lines)
- `.team/features/runbook-system/tasks/task-2/handshake.json` (all 15 lines)
- `.team/features/runbook-system/tasks/task-1/artifacts/test-output.txt` (lines 1–815, full test output)
- `bin/lib/run.mjs` (grep for runbook consumption — lines 799–800 only)
- All `bin/**/*.mjs` (grep for `runbook|patterns|minScore` — confirmed only 3 files mention runbook, none parse the YAML)

---

## Summary

The implementation is appropriately minimal. A YAML data file and a straightforward test file — no new abstractions, no indirection, no dead code, no gold-plating. The one suggestion (redundant keyword pattern) is academic until a runbook reader is built. No veto-category violations. **PASS.**

---

# Engineer Review: task-2 — add-github-integration.yml runbook

**Reviewer role:** Software Engineer
**Date:** 2026-04-25
**Overall Verdict: PASS**

## Files Actually Read

- `.team/runbooks/add-github-integration.yml` (all 29 lines)
- `test/runbook-add-github-integration.test.mjs` (all 51 lines)
- `.team/features/runbook-system/tasks/task-2/handshake.json` (all 15 lines)
- `package.json` (lines 21–25)
- `bin/lib/run.mjs` (grep for `runbook`)
- `bin/lib/init.mjs` (grep for `runbook`)

## Verification

Ran `node --test test/runbook-add-github-integration.test.mjs` directly:

```
✔ file exists at .team/runbooks/add-github-integration.yml
✔ contains required top-level fields
✔ has at least 4 tasks
✔ id matches filename without extension
✔ each pattern has type, value, and weight
pass 5, fail 0
```

Test is registered in `package.json:22` (commit `8d25645`).

## Per-Criterion Results

**File exists with valid schema** — PASS (direct read confirms all 6 required fields)

**≥4 tasks** — PASS (5 tasks, lines 17–28)

**Test registered and passing** — PASS (package.json includes file; 5/5 pass)

## Findings

🟡 `test/runbook-add-github-integration.test.mjs:44-49` — Per-pattern field validation is document-global: `assert.match(content, /weight:\s*\d+/)` passes if *any* pattern has `weight`; a pattern entry that omits it goes undetected — validate at per-pattern granularity when a YAML parser is added

🔵 `test/runbook-add-github-integration.test.mjs:32` — Task count via `^\s+- title:` would miscount if a `hint:` value ever contained the literal `- title:` with leading whitespace — low risk with current hints, but YAML parsing is more robust

🔵 `.team/features/runbook-system/tasks/task-2/handshake.json:9-12` — `artifacts` list omits `test-output.txt`; task-1 captured it but task-2 did not — future reviewers must re-run to get evidence

---
---

# Architect Eval: task-2 — add-github-integration.yml runbook

**Reviewer role:** Software Architect
**Date:** 2026-04-25
**Overall Verdict: PASS**

---

## Requirement

> A `.team/runbooks/add-github-integration.yml` runbook exists with a valid schema and at least 4 tasks.

---

## Per-Criterion Results

### Criterion 1: Schema consistency with established patterns

**PASS**

Evidence: The runbook mirrors the identical schema used by `add-cli-command.yml` — same six top-level fields, same `pattern` sub-structure (`type`, `value`, `weight`), same `flow: build-verify` value. No novel structure introduced; the new file is additive and consistent.

---

### Criterion 2: `flow` value references a defined constant

**PASS**

Evidence: `bin/lib/flows.mjs` defines three valid flow names: `"light-review"`, `"build-verify"`, and `"full-stack"`. The runbook sets `flow: build-verify`, which matches the constant at `flows.mjs:28`. This is not a dead reference.

---

### Criterion 3: Tests pass and are registered

**PASS**

Evidence: Gate output explicitly lists `test/runbook-add-github-integration.test.mjs` in the `node --test` invocation. Commit `8d25645` registered the file. 544+ tests pass with 0 failures.

---

### Criterion 4: Runbook data model fits the system architecture

**PASS with architectural note — see warnings**

Evidence: The schema (`patterns`, `minScore`, `tasks`, `flow`) is coherent. However, no code in `bin/` currently reads or parses `.team/runbooks/*.yml`. Flow selection in `run.mjs:972` calls `selectFlow()` dynamically, not a runbook lookup. The runbook is a well-formed static artifact for a consumer that does not yet exist.

---

## Files Actually Read

- `.team/runbooks/add-github-integration.yml` (all 29 lines)
- `test/runbook-add-github-integration.test.mjs` (all 51 lines)
- `bin/lib/flows.mjs` (lines 25–63, `FLOWS` constant and `selectFlow` function)
- `bin/lib/run.mjs` (line 972, flow selection; line 800, `runbooks` dir creation)
- `bin/lib/init.mjs` (line 45, `runbooks` dir creation)
- `.team/features/runbook-system/tasks/task-2/handshake.json`

---

## Findings

🟡 `bin/lib/run.mjs:972` — Runbook YAML files are never read at runtime; `selectFlow()` drives flow selection dynamically, making the `flow` field and `patterns`/`minScore` in all `.team/runbooks/*.yml` files inert. Track a follow-up to wire runbook lookup into the flow selection path before advertising runbook-driven behavior to users.

🟡 `test/runbook-add-github-integration.test.mjs:22` — YAML structure is validated via regex on raw file text, not a parsed AST. A structurally malformed YAML that happens to contain the required keywords would pass all assertions. Add a YAML parse step before field assertions to catch syntax errors at the boundary.

🔵 `test/runbook-add-github-integration.test.mjs:22` — The `flow` field is validated only for presence (`/^flow:/m`), not for value correctness. A typo (e.g., `flow: build-verfiy`) passes silently. Cross-validate against `Object.keys(FLOWS)` or a known-valid set.

🔵 `.team/runbooks/add-github-integration.yml:3` — Pattern weights (2.0, 1.5, 1.0, 1.0) and `minScore: 2.5` are untested for scoring semantics. The most specific keyword (`"github integration"`, weight 1.5) alone cannot meet the threshold. Acceptable for v1, but document intended trigger combinations once the runtime consumer is built.

---

## Summary

The artifact is a well-formed, schema-consistent runbook file that satisfies the stated requirement. No critical architectural issues exist for this v1 deliverable. The primary structural concern — that runbook data is inert at runtime — is a known system gap to address in a future task, not a blocker for this one. Merge is safe.

---
---

# Tester Eval: task-2 — add-github-integration.yml runbook

**Reviewer role:** Tester
**Date:** 2026-04-25
**Overall Verdict: PASS**

---

## Requirement

> A `.team/runbooks/add-github-integration.yml` runbook exists with a valid schema and at least 4 tasks.

---

## Files Actually Read

- `.team/runbooks/add-github-integration.yml` (all 29 lines)
- `test/runbook-add-github-integration.test.mjs` (all 50 lines)
- `test/runbook-add-cli-command.test.mjs` (all 51 lines — comparison baseline)
- `.team/features/runbook-system/tasks/task-2/handshake.json` (all 14 lines)
- `.team/features/runbook-system/tasks/task-1/artifacts/test-output.txt` (full 815 lines)
- `package.json` grep — confirmed test registration at line 22
- `bin/lib/run.mjs` grep — confirmed no runtime schema loader exists

---

## Per-Criterion Results

### File exists + schema valid
**PASS** — All six required top-level fields verified by direct read of the file.

### At least 4 tasks
**PASS** — 5 tasks confirmed (lines 17–28).

### Test file exists and is registered
**PASS** — `test/runbook-add-github-integration.test.mjs` exists. Registered in `package.json`
at line 22. A separate fix commit (`8d25645`) was required to register it — the initial
submission omitted registration, indicating this was discovered and corrected post-merge.

### Tests pass
**PARTIAL EVIDENCE** — The gate output is truncated (cuts off at `agt help ini`); the
`add-github-integration.yml runbook` test block result is not visible. Task-2's handshake
lists no `test-output.txt` artifact. Task-1's artifact (`test-output.txt`) predates the
test's registration (committed at `fad8e81`, before `8d25645`), so it does not include
these tests. Inference: all 5 assertions match fields clearly present in the file, so
tests almost certainly pass — but no direct artifact confirms it.

---

## Coverage Gaps

### Gap 1 — Pattern sub-field checks are global, not per-pattern
`test/runbook-add-github-integration.test.mjs:44-48`: three independent `assert.match()`
calls check whether `type`, `value`, and `weight` appear *anywhere* in the file. A runbook
where pattern 1 has `type`, pattern 2 has `value`, and pattern 3 has `weight` (but no single
pattern has all three) would pass. Tests don't verify each pattern entry is complete.

### Gap 2 — `flow` value is not validated
Line 27 asserts `^flow:` exists. `flow: garbage` passes. No check against the known valid
set (`light-review`, `build-verify`, `full-stack`).

### Gap 3 — No YAML structural validity check
All assertions regex-match the raw string. A file with wrong indentation, duplicate keys,
or tab characters would pass all 5 tests. No test parses the file as YAML.

### Gap 4 — Task `hint` field untested
Each task has a `hint:` field. No test asserts its presence or non-emptiness.

### Gap 5 — `minScore` not validated as numeric or achievable
Existence is checked but not value type or whether any reachable pattern combination can
satisfy the threshold.

---

## Findings

🟡 test/runbook-add-github-integration.test.mjs:44 — pattern sub-field checks (`type`, `value`, `weight`) use independent global matches; a partially-formed pattern entry passes undetected — add per-entry validation or parse YAML to iterate patterns

🟡 .team/features/runbook-system/tasks/task-2/handshake.json:9 — no `test-output.txt` artifact; the only full test run artifact predates this test file's registration; no captured proof of passing tests from builder's own run — capture and attach test output in handshake

🔵 test/runbook-add-github-integration.test.mjs:27 — `flow` field value not validated; a typo passes silently — assert membership in the known flow name set

🔵 test/runbook-add-github-integration.test.mjs:20 — no YAML parse step; a structurally malformed file passes all 5 regex tests — add `yaml.parse(content)` to catch syntax errors

🔵 test/runbook-add-github-integration.test.mjs:30 — task `hint` field is present in all 5 tasks but untested; if required by the runtime schema, its omission goes undetected

---

## Summary

The stated criterion is met: file exists, schema fields are present, 5 tasks satisfy ≥4. The
test file is registered and its assertions clearly match the file content. Two warnings flag
real evidence and coverage gaps — missing test output artifact and per-pattern field
validation — these should go to backlog. Three suggestions offer optional hardening. No
critical gaps. **PASS** (two warnings to backlog).

---

# Security Review: task-2 — add-github-integration.yml runbook

**Reviewer role:** Security Specialist
**Date:** 2026-04-25
**Overall Verdict: PASS**

## Files Actually Read

- `.team/runbooks/add-github-integration.yml` (all 29 lines)
- `.team/runbooks/add-cli-command.yml` (all 24 lines)
- `test/runbook-add-github-integration.test.mjs` (all 51 lines)
- `.team/features/runbook-system/tasks/task-2/handshake.json` (all 15 lines)
- `.team/features/runbook-system/tasks/task-1/handshake.json` (all 16 lines)
- `.team/features/runbook-system/tasks/task-1/artifacts/test-output.txt` (lines 1–30)

## Threat Model

This is a pure data file (YAML) with no runtime execution path in the current codebase. Patterns and hints are static; no code loads or evaluates them yet. The attack surface is limited to:
1. The future Phase 5 matching engine that will call `new RegExp(pattern.value)` on these values
2. The credential hint in task 1 guiding future implementors toward potentially insecure practices

## Per-Criterion Results

**Input validation of regex patterns** — DEFERRED RISK. Patterns are unused today; risk materialises when Phase 5 ships.

**Secrets management** — PASS with caveat. No secrets are present. The credential hint is ambiguous about storage safety.

**Webhook security** — PASS. Task 4 hint explicitly mentions "verify signatures", which is the correct security posture.

## Findings

🟡 `.team/runbooks/add-github-integration.yml:5` — The `regex`-type pattern `"add.*github.*integrat|..."` will be passed to `new RegExp()` by the Phase 5 matching engine with no validation or timeout. A malicious or malformed runbook could cause ReDoS. Before Phase 5 ships, the engine must either (a) pre-validate patterns with a safe-regex linter, or (b) execute evaluation in a `Worker` with an `AbortSignal` timeout.

🟡 `.team/runbooks/add-github-integration.yml:19` — Task 1 hint "add to env config" gives no guidance against committing credentials. Strengthen to: "add to `.env` (verify `.env` is in `.gitignore`); never hardcode credentials in source files".

🔵 `.team/runbooks/add-github-integration.yml:20` — `hint` fields will eventually be rendered to agents or UI. Ensure any rendering layer HTML-escapes hint content to prevent XSS if hints ever originate from untrusted sources (e.g., community-contributed runbooks).

## Summary

No critical blocking issues. This is a data-layer artifact with no current execution path. The two warnings are pre-emptive: one targets the Phase 5 regex engine (ReDoS prevention) and one targets credential handling guidance. Both should be addressed before the matching engine ships. The webhook security hint is correct. **PASS.**
