# Security Review — self-simplification-pass

**Reviewer:** Security specialist (threat modeling, input validation, secrets management)
**Verdict:** PASS
**Date:** 2026-04-27

## Files Actually Opened and Read

1. `bin/lib/simplify-pass.mjs` (full, 213 lines — new module)
2. `bin/lib/run.mjs` (full, 1594 lines — integration site)
3. `test/simplify-pass.test.mjs` (full, 378 lines)
4. `roles/simplicity.md` (full, 32 lines — role prompt)
5. `.team/features/self-simplification-pass/SPEC.md` (full, 78 lines)
6. `.team/features/self-simplification-pass/tasks/task-{1,2,3,4}/handshake.json` (all 4)
7. `.team/features/self-simplification-pass/tasks/task-2/artifacts/test-output.txt` (full — 888 lines)
8. `bin/agt.mjs` (diff only — CLI flag addition)
9. Git diff of all changed files on this branch

## Handshake Verification

| Task | Handshake Claim | Evidence | Match |
|------|----------------|----------|-------|
| task-1 | Review: FAIL (1 critical, 18 warning, 12 suggestion) | eval.md contains structured findings, 0 critical remaining | Claim reflects prior round state |
| task-2 | Gate: PASS, exit code 0 | test-output.txt: 601 tests, 599 pass, 0 fail, 2 skipped | **Confirmed** |
| task-3 | Review: FAIL (2 critical, 21 warning, 16 suggestion) | eval.md present with findings | Claim matches eval content |
| task-4 | Review: FAIL (5 critical, 7 warning, 7 suggestion) | eval.md present with findings | Earlier round, superseded |

## Gate Verification

```
npm test: 601 tests, 599 pass, 0 fail, 2 skipped
```

Test output in `task-2/artifacts/test-output.txt` confirms all simplify-pass tests pass:
- `getFeatureDiff` — 3 tests pass (merge-base against main, failure, empty diff)
- `buildSimplifyBrief` — 2 tests pass (includes role+diff, truncation+notice)
- `buildFixBrief` — 1 test pass (only criticals in fix prompt)
- `runSimplifyPass` — 13 tests pass (empty diff skip, clean pass, warnings, fix loop exhaustion, fix resolves in round 1, mixed severity, STATE.json shape, fail-open on throw, fail-open on ok=false, eval.md written, progress.md appended, role file missing, --no-simplify flag, fix dispatch failure)

## Security Criterion Assessment

### 1. Command Injection

**PASS** — `getFeatureDiff()` at `simplify-pass.mjs:24-36` uses `execFileSync` (not `execSync` with `shell: true`). Arguments are passed as an array, not interpolated into a shell string. The `mergeBase` value from `git merge-base` is trimmed and used as `${mergeBase}..HEAD` — a single argument to `git diff`, not parsed by a shell. No injection vector exists.

Edge cases checked:
- `mergeBase` containing spaces/special chars: passed as single array element to `execFileSync`, not shell-expanded
- `cwd` parameter: comes from `createWorktreeIfNeeded()` in `run.mjs:1014` which constructs the path via `join()` on slugified names

### 2. Prompt Injection via Diff Content

**PASS with note** — At `simplify-pass.mjs:44-66`, `buildSimplifyBrief()` embeds the raw `git diff` output verbatim into the LLM prompt within a markdown code fence. A malicious diff could contain text that attempts to override the prompt instructions.

Realistic threat model assessment:
- The diff comes from the user's own feature branch commits
- The simplify agent already runs with `bypassPermissions` (same as all other agents in this system)
- This is the identical pattern used by all other review dispatches in `run.mjs` (e.g., `buildReviewBrief` at `flows.mjs`)
- No new attack surface is introduced by this change

### 3. File Path Traversal

**PASS** — All file writes are to well-defined paths:
- `simplify-eval.md` written at `simplify-pass.mjs:177`: `join(featureDir, "simplify-eval.md")` — `featureDir` is constructed by the caller as `join(teamDir, "features", featureName)` where `featureName` is slugified at `run.mjs:812-814` stripping special characters
- `STATE.json` write at `simplify-pass.mjs:186-198`: uses `readState`/`writeState` which operate on a fixed filename within `featureDir`
- `progress.md` append at `simplify-pass.mjs:203`: uses `appendProgress` utility

### 4. State File Integrity (TOCTOU)

**PASS** — The read-modify-write at `simplify-pass.mjs:186-198` does not use `lockFile`. However:
- The simplification pass runs sequentially within a single-process execution flow (`_runSingleFeature` in `run.mjs`)
- No concurrent process writes to STATE.json during this window
- This is consistent with other STATE.json writes throughout `run.mjs` (e.g., line 1511)
- The `lockFile` pattern is only used in `runGateInline` which can be called from external contexts

### 5. Fail-Open Design

**PASS with warnings (see findings below)** — Multiple error paths return `{ verdict: "PASS" }`:
- Dispatch throws: `simplify-pass.mjs:126-129`
- Dispatch returns `ok: false`: `simplify-pass.mjs:121-124`
- Role file missing: `simplify-pass.mjs:112-115`
- Empty diff: `simplify-pass.mjs:102-105`

This is intentional and tested (`test lines 243-267`). It prioritizes availability over gatekeeping: infrastructure failures don't block feature execution. The security trade-off is that a persistent agent failure silently bypasses the quality gate.

### 6. Diff Truncation

**PASS** — `DIFF_CAP = 12000` at `simplify-pass.mjs:15`. Large diffs are truncated with a visible notice appended to the prompt. The truncation uses `diff.slice(0, DIFF_CAP)` which may split mid-line. Issues past the truncation boundary are invisible to the reviewer. This is a cost-control trade-off, not a security vulnerability — and applies equally to all diff-based review patterns in the system.

### 7. Secrets in Diff Output

**PASS** — The diff is from the user's own feature branch and is only passed to the LLM agent (which already has `bypassPermissions` and full file access). No diff content is written to external services, APIs, or network endpoints. The diff content is persisted only in `simplify-eval.md` (agent's findings text, not the raw diff itself).

### 8. Error Message Leakage

**PASS** — Error messages at `simplify-pass.mjs:113,123,128,145,149` contain `err.message` strings that are printed to the console (`console.log`). These are local CLI outputs, not exposed to any external API or web surface. No secrets or credentials flow through these error paths.

## Findings

🟡 bin/lib/simplify-pass.mjs:121 — Fail-open on dispatch error writes no persistent audit trail; `simplify-eval.md` is not created, so post-hoc analysis cannot distinguish "clean pass" from "gate bypassed due to infrastructure failure". Write a `simplify-eval.md` with a "SKIPPED: dispatch failed" notice on these paths.

🟡 bin/lib/simplify-pass.mjs:181 — Empty `catch {}` silently discards `writeFileSync` errors for eval file. If the feature directory is read-only or full, the eval artifact is silently lost with no indication. Log `err.message` before swallowing.

🟡 bin/lib/simplify-pass.mjs:198 — Empty `catch {}` silently discards STATE.json write errors. Same concern as above — state persistence failure is invisible.

🟡 bin/lib/simplify-pass.mjs:26 — `getFeatureDiff` hardcodes `"main"` as the merge-base target. Repos using `master` as default branch will return empty diff (caught by try/catch), causing the entire pass to silently skip. This is a functional gap flagged by prior reviewers.

🔵 bin/lib/simplify-pass.mjs:64 — Git diff content is embedded verbatim into LLM prompt. As defense-in-depth, consider stripping ANSI escape codes or control characters from the diff before embedding. Low risk since `git diff` with `stdio: "pipe"` shouldn't produce ANSI, but hardens against edge cases.

🔵 bin/lib/simplify-pass.mjs:166 — Silent `catch { break; }` on re-verify dispatch failure has no diagnostic logging, unlike the fix dispatch failure at line 149 which logs. Asymmetric error handling in the same loop — add a `console.log` for consistency.

🔵 bin/lib/run.mjs:1507 — `args.includes("--no-simplify")` is a raw string match against the args array, not a formal CLI flag parsed by a flag parser. Functions correctly but fragile if `--no-simplify=false` or similar variations are ever passed.

🔵 bin/lib/simplify-pass.mjs:47 — `diff.slice(0, DIFF_CAP)` may truncate mid-line, producing a malformed diff hunk at the boundary. `diff.lastIndexOf('\n', DIFF_CAP)` would produce cleaner truncation.

## Summary

| Criterion | Verdict | Evidence |
|-----------|---------|----------|
| Command injection | PASS | `execFileSync` with array args, no shell interpolation |
| Prompt injection | PASS | Same pattern as existing review dispatches; no new surface |
| Path traversal | PASS | All paths constructed via `join()` on slugified names |
| State integrity | PASS | Sequential single-process writes; consistent with codebase |
| Fail-open design | PASS (flagged) | Intentional and tested, but no audit trail on bypass |
| Secrets exposure | PASS | Diff stays local; only findings text persisted |
| Error handling | PASS (flagged) | Silent catch blocks lose diagnostic info |

**Overall:** PASS — 0 critical, 4 warning, 4 suggestion. No security vulnerabilities that block merge. The fail-open pattern is a deliberate availability-over-gatekeeping trade-off, appropriate for a local CLI dev tool. The warnings about silent error swallowing should go to backlog — they don't create vulnerabilities but make post-incident analysis harder.
