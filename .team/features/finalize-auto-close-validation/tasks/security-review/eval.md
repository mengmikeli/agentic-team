# Security Review — finalize-auto-close-validation

**Role:** Security specialist
**Task:** Test: tasks without `issueNumber` are skipped silently and do not affect the count
**Verdict:** PASS (with backlog items)

---

## Files Opened and Read

- `.team/features/finalize-auto-close-validation/tasks/task-4/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-4/artifacts/test-output.txt`
- `.team/features/finalize-auto-close-validation/tasks/security-review/eval.md` (prior task-3 review)
- `bin/lib/finalize.mjs` (full file, 150 lines)
- `bin/lib/github.mjs` (lines 1–148)
- `bin/lib/util.mjs` (full file, 220 lines)
- `test/harness.test.mjs` (lines 1–43 setup/teardown; lines 468–506 new test)

---

## Per-Criterion Results

### 1. Gate claim verified against test output

**PASS — direct evidence.**

Gate handshake (task-4) reports exit code 0, verdict PASS. Test output line 394:
```
✔ silently skips tasks without issueNumber and does not affect count (217.125542ms)
```
518 tests pass, 0 fail.

### 2. Injection surface: `task.issueNumber` from STATE.json

**PASS — spawnSync array form prevents shell injection.**

The skip path at `finalize.mjs:118` is `if (task.issueNumber)` — tasks without issueNumber don't reach `closeIssue` at all. For tasks that do have issueNumber, `closeIssue` at `github.mjs:139–141` calls:
```js
spawnSync("gh", ["issue", "close", String(number)], ...)
```
`spawnSync` receives an explicit array, not a shell string. A crafted STATE.json with `"issueNumber": "201; rm -rf /"` would pass `String()` as a single literal argument — `gh` would reject it. No shell injection possible on either the skip or the close path.

### 3. Pre-existing: `task.issueNumber` has no integer type guard

**WARN — unresolved from task-3 security review.**

`finalize.mjs:118`: the guard is `if (task.issueNumber)` (truthy). Non-integer strings like `"abc"` pass the truthy check, pass `closeIssue`'s `if (!number) return false` guard (non-empty string is truthy), and reach `gh issue close "abc"`. The `try/catch` at line 122 silently swallows the `gh` failure.

The new test uses only `{ issueNumber: 201 }` (valid integer) and absent issueNumber. No test covers an issueNumber set to a non-integer string. Impact is limited to filesystem-write-access attackers, but the guard was flagged in the prior review and is still absent.

### 4. Pre-existing: `issuesClosed++` unconditional

**WARN — unresolved from task-3 security review.**

`finalize.mjs:128`: `issuesClosed++` fires after `closeIssue(task.issueNumber, comment)` regardless of the boolean return value. `closeIssue` returns `true` on success and `false` on `gh` failure (never throws). The return value is discarded, so `issuesClosed` measures "tasks that had an issueNumber" not "tasks whose issues were actually closed."

The new test uses a non-capturing stub that always exits 0, so the failure branch remains untested for task issue closes. Pre-existing; already in backlog.

### 5. Test stub: non-capturing, count-only verification

**PASS (partial) — count claim proven; command targeting unverified.**

The new test at `test/harness.test.mjs:470` writes a non-capturing stub:
```sh
#!/bin/sh
echo ok
exit 0
```
The assertion at lines 501–502 checks `result.finalized === true` and `result.issuesClosed === 1`. This proves the count is 1 (not 0, not 2), which verifies the skip logic is active. However, it does not verify:
- That `gh issue close 201` was the call made (versus `gh issue close` with the wrong argument)
- That `gh` was not called for the task without issueNumber at the `gh` level (only at the `finalize.mjs` level, via the count)

The count-based check is sufficient for the stated claim ("does not affect count"), but other tests in this suite use capturing stubs (lines 282, 353). The simpler stub is not wrong but does leave the command-targeting path unverified.

### 6. Test cleanup scope

**PASS — no leak.**

`featureDir` (`join(testDir, "features", "no-issue-skip-test")`) is inside `testDir`, which is cleaned globally by `after(() => rmSync(testDir, ...))` at `test/harness.test.mjs:40–42`. Only `fakeBinDir` needs per-test cleanup since it lives outside `testDir`, and it is correctly cleaned in `finally` at line 503–505.

### 7. Test PATH injection pattern

**PASS — standard and safe.**

`env: { ...process.env, PATH: \`${fakeBinDir}:${process.env.PATH}\` }` at line 497 is passed to `execFileSync("node", [...])` — not a shell invocation. `fakeBinDir` comes from `mkdtempSync` (OS-generated random suffix). PATH extension is contained to the subprocess; no effect on the test process itself.

---

## Findings

🟡 bin/lib/finalize.mjs:118 — `task.issueNumber` has no integer type guard; a crafted STATE.json with a non-integer string passes the truthy check and silently reaches `gh issue close "bad-value"` — add `Number.isInteger(task.issueNumber)` before the truthy check (pre-existing, unresolved from task-3 review)
🟡 bin/lib/finalize.mjs:128 — `issuesClosed++` fires unconditionally; `closeIssue` return value is discarded; count inflates when `gh` exits non-zero — change to `if (closeIssue(task.issueNumber, comment)) issuesClosed++;` (pre-existing, unresolved from task-3 review)
🔵 test/harness.test.mjs:470 — Non-capturing stub cannot verify `gh issue close 201` was actually invoked nor that `gh` was not called for the no-issueNumber task; consider replacing with a capturing stub (log `$@` to a file) and asserting `ghCalls.includes("issue close 201")` and `!ghCalls.includes("issue close")` for the second task

---

## Overall Verdict

**PASS**

No critical findings. No new security surface was introduced — this commit adds only a test. The production logic at `finalize.mjs:118` (`if (task.issueNumber)`) correctly skips tasks without an issue number before any GitHub API call is made, proven by the gate (518/518 pass) and confirmed by direct code inspection. The two 🟡 findings are pre-existing debt that was already flagged in the task-3 security review and should be in the backlog. The non-capturing stub (🔵) is adequate for the stated claim but leaves command-targeting unverified.
