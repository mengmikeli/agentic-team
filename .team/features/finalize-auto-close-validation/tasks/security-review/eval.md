# Security Review — finalize-auto-close-validation

**Role:** Security specialist
**Task:** Test: `finalize` also closes `state.approvalIssueNumber` when present, and `issuesClosed` reflects it
**Verdict:** PASS (with backlog items)

---

## Files Opened and Read

- `.team/features/finalize-auto-close-validation/tasks/task-1/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-2/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-3/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-3/artifacts/test-output.txt`
- `.team/features/finalize-auto-close-validation/tasks/task-1/eval.md`
- `.team/features/finalize-auto-close-validation/tasks/task-2/eval.md`
- `.team/features/finalize-auto-close-validation/tasks/pm-review/eval.md`
- `bin/lib/finalize.mjs` (full file, 150 lines)
- `bin/lib/github.mjs` (full file, 197 lines)
- `test/harness.test.mjs` (lines 265–426)

---

## Per-Criterion Results

### 1. Gate claim verified against test output

**PASS — direct evidence.**

Test output line 392:
```
✔ closes approvalIssueNumber when present and counts it in issuesClosed (285.479625ms)
```
All 517 tests pass (exit code 0, confirmed by task-3 gate handshake).

### 2. Injection via `approvalIssueNumber`

**PASS — spawnSync array form prevents shell injection.**

New code at `finalize.mjs:134–139` passes `freshState.approvalIssueNumber` to `closeIssue()`, which calls:
```js
spawnSync("gh", ["issue", "close", String(number)], ...)
```
(`github.mjs:139–141`). `spawnSync` receives an explicit argument array, not a shell string. Even if `approvalIssueNumber` were set to `"500; rm -rf /"`, it would be passed as a single literal argument — `gh` would fail to parse the issue number and return non-zero. No shell injection possible.

### 3. Type validation on `approvalIssueNumber`

**WARN — no integer type guard before use.**

At `finalize.mjs:134`, the only guard is `if (freshState.approvalIssueNumber)` (truthy check). `closeIssue` adds `if (!number) return false` (`github.mjs:138`), rejecting null/0/undefined/empty string, but passes a non-numeric string like `"abc"` through to `gh issue close "abc"`. The `try/catch` at line 138 silently swallows the gh failure. The `issuesClosed++` at line 137 fires unconditionally regardless (see finding 4).

Real-world impact is limited: reaching this branch requires a writable STATE.json, and gh would reject non-integer issue numbers at the CLI level. Pre-existing pattern from `task.issueNumber`.

### 4. `issuesClosed++` unconditional on approval issue close — new instance

**WARN — new code introduces same counter bug that already exists at line 128.**

`finalize.mjs:137`: `issuesClosed++` fires after `closeIssue(freshState.approvalIssueNumber, ...)` regardless of the return value (`closeIssue` returns `true`/`false`; github.mjs:141). The return value is discarded.

This is **new code** introduced by this feature at lines 133–139, repeating the pattern already flagged pre-existing at line 128. Tests use a stub that always exits 0, so the failure path is untested for the approval issue as well.

### 5. STATE.json tamper detection (pre-existing, assessed for context)

**WARN — `_write_nonce` is presence-only; not a MAC.**

`finalize.mjs:21–24` checks `state._written_by !== "at-harness"` and `finalize.mjs:58` checks `!state._write_nonce`. Both guards can be defeated by any attacker with filesystem write access who knows the string constants (visible in source). The nonce provides no cryptographic proof that the harness wrote the file.

Impact for the new code: an attacker with filesystem write access can inject any `approvalIssueNumber` (or forge task `issueNumber` values) to force the harness to close arbitrary GitHub issues — requires GitHub authentication in the current user's context. For a local CLI developer tool, this is an acceptable threat model.

Pre-existing finding — already in task-2 backlog (`🟡 [security] bin/lib/finalize.mjs:58`).

### 6. Test coverage of the approval-close comment

**PASS (partial) — issue number asserted, comment text not.**

`test/harness.test.mjs:419` asserts `ghCalls.includes("500")`, which proves the issue number reached `gh`. It does not assert:
- The subcommand is `issue close` (not `issue comment`)
- The comment text `"Feature finalized — all tasks complete."` appears

The task's stated requirement is only that the issue is closed and counted, which the test satisfies. The missing assertions are hardening.

### 7. Shell heredoc with path in test stub (pre-existing)

`test/harness.test.mjs:282`:
```js
`#!/bin/sh\necho "$@" >> "${ghLogFile}"\necho ok\nexit 0\n`
```
`ghLogFile` comes from `mkdtempSync(join(tmpdir(), "fake-gh-"))`. On macOS, `tmpdir()` returns `/var/folders/...` — no shell metacharacters expected. Already flagged as 🔵 in task-2 eval. Test-only code; no production impact.

---

## Findings

🟡 bin/lib/finalize.mjs:137 — `issuesClosed++` fires unconditionally after `closeIssue(freshState.approvalIssueNumber)` regardless of return value; change to `if (closeIssue(freshState.approvalIssueNumber, "Feature finalized — all tasks complete.")) issuesClosed++;` — new code at this line repeating pre-existing pattern from line 128
🟡 bin/lib/finalize.mjs:134 — `approvalIssueNumber` has no integer type guard before reaching `closeIssue`; add `Number.isInteger(freshState.approvalIssueNumber)` guard to prevent silent failure path and match the documented contract
🔵 test/harness.test.mjs:419 — Assert subcommand and comment text, not just issue number: `assert.ok(ghCalls.includes("issue close 500"))` and `assert.ok(ghCalls.includes("Feature finalized"))` to guard against argument-order regressions
🔵 test/harness.test.mjs:282 — `ghLogFile` path is interpolated into a shell heredoc without quoting; fragile if tmpdir ever includes `"` or `$` — pass log path via env var instead (test-only, macOS path is safe in practice)

---

## Overall Verdict

**PASS**

No critical findings. The new code at `finalize.mjs:133–139` is functionally correct and the target test passes. The primary injection surface (`spawnSync` with array args) is safe. The two 🟡 findings are maintenance-debt: one is a new instance of the pre-existing unconditional-counter bug, the other is a missing type guard with no practical exploit path for this tool's threat model. Both go to backlog.
