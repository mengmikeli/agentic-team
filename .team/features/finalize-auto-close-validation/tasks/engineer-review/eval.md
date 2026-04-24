# Engineer Review — finalize-auto-close-validation
## Task: silently skips tasks without `issueNumber` and does not affect count

**Verdict: PASS**

---

## Files Read

- `.team/features/finalize-auto-close-validation/tasks/task-4/handshake.json` — gate handshake, exit 0
- `.team/features/finalize-auto-close-validation/tasks/task-4/artifacts/test-output.txt` — 518 tests, 0 failures; target test at line 394 passes in 217ms
- `test/harness.test.mjs:468–506` — the new test case added by this commit
- `bin/lib/finalize.mjs:114–139` — the implementation under test
- `bin/lib/github.mjs:137–142` — `closeIssue` implementation
- `bin/lib/util.mjs:44–50` — nonce generation format

---

## Criteria

### 1. Correctness — PASS

**Evidence:** The commit only touches `test/harness.test.mjs` (confirmed via `git show e74a1af --stat`). No changes to `bin/lib/finalize.mjs`. The behavior being tested was already in place via the `if (task.issueNumber)` guard at `finalize.mjs:118`.

Logic path traced:
```
for (const task of freshState.tasks || []) {     // line 117
  if (task.issueNumber) {                        // line 118 — falsy for t2 (no field)
    ...
    issuesClosed++;                              // never reached for t2
  }
}
```

For `t2 = { id: "t2", status: "passed" }` (no `issueNumber` field), `task.issueNumber` is `undefined` → falsy → entire block skipped. `closeIssue` is never called and `issuesClosed` is never incremented.

The test asserts `issuesClosed === 1` and `finalized === true`, which exactly covers the specified behavior.

### 2. Test design — PASS

The test:
- Constructs a valid two-task STATE.json (t1 with `issueNumber: 201`, t2 without)
- Injects a fake `gh` binary (exits 0) via PATH override
- Runs the real harness binary via `execFileSync`
- Parses JSON output and asserts count

The count assertion `issuesClosed === 1` is a sufficient proxy for "gh not called for t2" because `issuesClosed++` only executes inside the `if (task.issueNumber)` block. A false positive is structurally impossible: if t2 were incorrectly processed, the count would be 2, not 1.

### 3. Error handling — PASS

`closeIssue` at `github.mjs:138` has a defense-in-depth guard (`if (!number) return false`), matching the outer guard in `finalize.mjs:118`. The `try/catch` at `finalize.mjs:122` ensures a failing `gh` call doesn't crash finalize. All failure paths are handled.

### 4. Pre-existing dead code — flagged

`finalize.mjs:125–126` contains dead code from a prior commit:
```js
const projMatch = String(tracking.statusFieldId || "").match(/\d+/);
// Best-effort: move to done on project board
```
`projMatch` is assigned but never used. Not introduced by this commit, but it's a quality issue worth tracking.

---

## Findings

🟡 bin/lib/finalize.mjs:125 — `projMatch` assigned but never read; dead code implying unfinished board status update; remove assignment or implement the intended operation

---

## Summary

Single test-only commit. Implementation was pre-existing and correct. Test is well-constructed: correct state setup, subprocess isolation, and a count assertion that cannot produce a false positive. One pre-existing warning (dead code) flagged to backlog.
