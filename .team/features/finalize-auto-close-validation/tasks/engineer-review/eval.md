# Engineer Review — finalize-auto-close-validation
## Task: calling `finalize` on an already-completed feature does not re-close issues

**Verdict: PASS**

---

## Files Read

- `.team/features/finalize-auto-close-validation/tasks/task-5/handshake.json` — gate handshake, exit code 0
- `.team/features/finalize-auto-close-validation/tasks/task-5/artifacts/test-output.txt` — 519 tests, 0 failures; target test at line 395 passes in ~51ms
- `test/harness.test.mjs:508–554` — the new test case
- `bin/lib/finalize.mjs:1–150` — full implementation reviewed

---

## Criteria

### 1. Correctness — PASS

**Evidence:** Early-return guard at `finalize.mjs:26–33` exits before any GitHub calls when `state.status === "completed"`:

```js
if (state.status === "completed") {          // line 26
  console.log(JSON.stringify({               // line 27
    finalized: true,
    feature: state.feature,
    note: "already finalized",
  }));
  return;                                    // line 33 — no gh calls follow
}
```

Execution path for the already-completed case:
1. `readState(dir)` at line 15 → `state.status === "completed"` → true
2. Lines 26–33: early return before `lockFile()`, `readTrackingConfig()`, `closeIssue()`, or any GitHub I/O
3. `closeIssue(601, ...)` and `closeIssue(700, ...)` (task + approval issue) are never reached

A second guard at lines 82–89 (post-lock double-check) also catches the concurrent race condition. Both guards return without touching GitHub. The `finally { lock.release() }` at line 147 ensures the lock is always freed regardless of which return path is taken — including the post-lock guard's `return` at line 88.

### 2. Test design — PASS

The test:
- Constructs a STATE.json with `status: "completed"`, one task with `issueNumber: 601`, and `approvalIssueNumber: 700`
- Injects a fake `gh` binary (records all arguments to `ghLogFile`) via PATH override
- Runs the real harness binary via `execFileSync` against the real implementation
- Asserts `result.finalized === true` and `result.note === "already finalized"`
- Asserts no `gh` invocations via `noGhCalls` log check (line 549–550)

The `gh` stub records calls before `exit 0`, so any `closeIssue` invocation would produce a non-empty log file. The assertion correctly catches both task-issue and approval-issue close attempts.

### 3. Error handling — PASS

The already-completed path has no error-prone operations: it reads state and returns. No lock, no network calls, no file writes. The `try/catch` blocks at lines 122–130 and 134–139 only wrap the normal (not-yet-completed) path.

### 4. Pre-existing dead code — flagged

`finalize.mjs:125–126` contains dead code predating this commit:
```js
const projMatch = String(tracking.statusFieldId || "").match(/\d+/);
// Best-effort: move to done on project board
```
`projMatch` is assigned but never read. Misleads readers into thinking project board updates are implemented.

---

## Findings

🟡 bin/lib/finalize.mjs:125 — `projMatch` assigned but never used; dead code implies unfinished board-status update; remove assignment or implement the intended call
🔵 test/harness.test.mjs:546 — test does not assert `result.issuesClosed === undefined`; a future regression adding `issuesClosed: 0` to the already-finalized response would go undetected; add an explicit assertion

---

## Summary

Test-only commit. The idempotency guard was pre-existing in `finalize.mjs:26–33` and is correct. The test verifies it end-to-end using a real gh stub with call logging — the strongest possible evidence short of actually hitting GitHub. One pre-existing warning (dead code) carried forward; one suggestion to harden the test assertion against future response-shape regressions.
