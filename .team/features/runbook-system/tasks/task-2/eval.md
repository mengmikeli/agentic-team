# Eval: task-2 — add-github-integration.yml runbook

## Overall Verdict: FAIL (simplicity veto — dead code)

---

## Criterion 1: `.team/runbooks/add-github-integration.yml` exists with a valid schema

**Result: PASS**

Evidence: File confirmed at `.team/runbooks/add-github-integration.yml`. Contains all required top-level fields: `id`, `name`, `patterns`, `minScore`, `tasks`, `flow`. The `id` value (`add-github-integration`) matches the filename. The `flow` value is `build-verify`, which is a valid flow name.

---

## Criterion 2: Runbook has at least 4 tasks

**Result: PASS**

Evidence: File contains 5 tasks with `title` and `hint` fields:
1. Configure GitHub API credentials and authentication
2. Implement GitHub API client wrapper
3. Add core GitHub integration endpoints or handlers
4. Handle GitHub webhook events
5. Write tests for GitHub integration

---

## Criterion 3: A test file exists and validates the runbook

**Result: PASS (warning on registration)**

Evidence: `test/runbook-add-github-integration.test.mjs` was created and contains valid assertions (file existence, schema fields, task count, id match, pattern structure). However, it was **never added to the `npm test` script** in `package.json:22`.

The `npm test` command explicitly enumerates test files. `test/runbook-add-cli-command.test.mjs` IS in the list (verifiable at package.json:22), but `test/runbook-add-github-integration.test.mjs` is absent. The gate output confirms this: the test command shown in both the gate output and `tasks/task-1/artifacts/test-output.txt` does not include the new file.

The handshake summary claims "All 544 tests pass" — but this is the same count from task-1. The 5 tests in the new file were never executed. No test-output artifact exists for task-2 (the `artifacts/` directory is absent entirely).

The gate criterion only requires the file to exist with valid schema and ≥4 tasks — not that its test file be registered. Criterion is met; the unregistered test is a backlog issue.

---

## Actionable Feedback

1. Add `test/runbook-add-github-integration.test.mjs` to the `"test"` script in `package.json:22`.
2. Re-run `npm test` and capture output as `artifacts/test-output.txt`.
3. Verify the 5 new tests appear in the output as passing before updating the handshake.

---

## Architectural Notes

Schema consistency is good: `add-github-integration.yml` and `add-cli-command.yml` use identical top-level structure, same pattern schema, same `flow: build-verify`. Any generic runbook loader handles both uniformly.

The systemic risk is that `scripts.test` uses explicit file enumeration — newly added test files are silently excluded unless manually registered. The `test:full` glob would catch this, but the gate uses the default `npm test`. This is a project-wide process issue, not specific to this task.

---

## Simplicity Review Findings

🔴 `package.json:22` — `test/runbook-add-github-integration.test.mjs` is not registered in the test script; the test file exists on disk but never executes in `npm test` — dead code — add it to the explicit file list alongside `runbook-add-cli-command.test.mjs`

🟡 `test/runbook-add-github-integration.test.mjs:1` — Near-exact copy of `runbook-add-cli-command.test.mjs`; only path and id differ across 50 lines — extract a `validateRunbook(path, expectedId)` helper shared by both test files

---

## Files Reviewed
- `.team/runbooks/add-github-integration.yml`
- `test/runbook-add-github-integration.test.mjs`
- `test/runbook-add-cli-command.test.mjs`
- `.team/features/runbook-system/tasks/task-2/handshake.json`
- `.team/features/runbook-system/tasks/task-1/artifacts/test-output.txt`
- `package.json` (lines 21–25)

---

# Security Review — runbook-system / task-2

**Reviewer role:** Security Specialist
**Date:** 2026-04-25
**Overall verdict: PASS**

---

## Files Actually Read

- `.team/features/runbook-system/tasks/task-2/handshake.json`
- `.team/runbooks/add-github-integration.yml` (all 29 lines)
- `test/runbook-add-github-integration.test.mjs` (all 51 lines)
- `package.json` (lines 21–25)
- `bin/lib/run.mjs` (lines 53–66, 282–334, 799–800)
- `bin/lib/init.mjs` (line 45)

---

## Per-Criterion Results

### 1. Attack surface of the YAML file

**PASS** — `add-github-integration.yml` is static data. Confirmed via grep across `bin/**/*.mjs`: the only references to `runbooks/` are two `mkdirSync` calls. No code reads, parses, or executes runbook content. Current injection surface: zero.

### 2. `patterns[].value` regex safety

**PASS with caveat** — The regex `"add.*github.*integrat|github.*integrat|connect.*github|integrat.*github"` uses simple alternation with `.*` — no nested quantifiers, no catastrophic backtracking potential. Safe against any realistic feature-description string.

Forward risk: `test/runbook-add-github-integration.test.mjs:46` validates that `type:`, `value:`, and `weight:` each appear *somewhere* in the full YAML text — it does NOT attempt `new RegExp(value)`. A syntactically broken regex passes schema validation and throws `SyntaxError` at engine runtime instead.

### 3. Credential hint in task 1

**FLAGGED** — Task 1 hint reads: "Set up personal access token or GitHub App credentials, add to env config". When the runbook engine executes this via `claude --permission-mode bypassPermissions`, the agent will follow this hint verbatim. "Add to env config" is ambiguous: it does not specify that the credential file must be gitignored, must not be hardcoded in source, or should use a secrets manager. An agent could create a `.env` file without verifying it is excluded from version control, or hardcode the token in a config file.

This is a prompt-safety risk specific to AI-orchestrated execution — not a code vulnerability today, but an active risk when the runbook engine ships.

### 4. Webhook signature hint specificity

**PASS** — Task 4 hint includes "verify signatures" — correctly identifies the security requirement for GitHub webhooks. The hint is directionally correct. Specificity (HMAC-SHA256, `X-Hub-Signature-256` header) is absent but acceptable for a task hint.

### 5. Test claims are unverified

**FLAGGED** (corroborates prior finding) — `test/runbook-add-github-integration.test.mjs` is absent from `package.json:22`. The 5 new tests were never run by the gate. No `artifacts/test-output.txt` for task-2. The handshake's "544 tests pass" claim is unverified for the new test file.

### 6. Secrets and credentials in artifacts

**PASS** — No credentials, tokens, API keys, or sensitive values in any artifact.

---

## Security Findings

🟡 `.team/runbooks/add-github-integration.yml:19` — Task 1 hint "add to env config" is ambiguous for AI agent execution; an agent with `bypassPermissions` following this hint could create unsecured credential files or hardcode secrets — strengthen to "add to `.env` (ensure `.env` is in `.gitignore`); never hardcode in source files"

🟡 `package.json:22` — test file unregistered (corroborates prior 🔴 finding); the 5 new security-relevant tests for the github runbook were never executed against the gate; all handshake test-pass claims for task-2 are unverified

🔵 `test/runbook-add-github-integration.test.mjs:46` — Pattern `value` fields validated for presence and double-quoting only; no `try { new RegExp(value) } catch { assert.fail() }` check; an invalid regex passes schema validation and throws at engine runtime — add regex validity check before the matching engine is built

🔵 `test/runbook-add-github-integration.test.mjs:46` — Pattern field validation is global across the full YAML text, not per-pattern; a pattern entry missing `weight` passes as long as any other pattern supplies the field

---

## Summary

The YAML file is static data — current attack surface is zero. The credential hint in task 1 is the primary forward-looking security concern: when the runbook engine executes this task via an AI agent with `bypassPermissions`, "add to env config" is ambiguous enough to cause unsecured credential handling. The missing test registration (prior 🔴 finding) also means the new tests for this security-relevant runbook have not been run. Neither blocks merge of the static YAML, but the credential hint must be addressed before the runbook engine ships.
