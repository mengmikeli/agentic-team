# Security Review — finalize-auto-close-validation

**Role:** Security reviewer
**Gate task:** task-7 (All existing finalize tests continue to pass)
**Date:** 2026-04-24
**Verdict:** PASS

---

## Files Actually Read

- `bin/lib/finalize.mjs` — full file (150 lines)
- `bin/lib/github.mjs` — full file (197 lines)
- `test/harness.test.mjs` — lines 239–555 (finalize describe block)
- `.team/features/finalize-auto-close-validation/SPEC.md`
- `.team/features/finalize-auto-close-validation/tasks/task-7/handshake.json`
- `.team/features/finalize-auto-close-validation/tasks/task-7/artifacts/test-output.txt`
- `.team/features/finalize-auto-close-validation/tasks/task-7/eval.md` (Simplicity reviewer)
- All task-{1..6}/handshake.json

---

## Per-Criterion Results

### CR-1: Shell injection / command injection

**PASS**

`closeIssue` (github.mjs:139) uses `spawnSync` with an array of arguments, not `exec` with a shell string.
`issueNumber` and `approvalIssueNumber` are passed through `String(number)` as discrete arguments — no shell interpolation is possible regardless of value.

Direct evidence: github.mjs:10 `spawnSync("gh", args, {...})` — shell is never involved.

### CR-2: Tamper protection on STATE.json

**PASS**

Two independent guards:
1. `_written_by !== WRITER_SIG` check (finalize.mjs:21) — rejects externally written state files
2. `_write_nonce` presence check (finalize.mjs:58) — rejects files missing the harness write stamp

Both guards fire before any GitHub calls are made.
Direct evidence: test output line 401 — `✔ rejects manually edited STATE.json (47.532667ms)`

### CR-3: TOCTOU race on STATE.json

**PASS**

The code acquires a lock (finalize.mjs:69), then re-reads STATE.json fresh (finalize.mjs:76-89) and checks `status === "completed"` a second time before mutating. The double-check closes the window between pre-lock validation and the locked write.

### CR-4: Idempotency (no duplicate closes on re-run)

**PASS**

Early return at lines 26-33 and again at lines 82-88 (inside the lock) both short-circuit before any GitHub calls are made when `state.status === "completed"`.

Direct evidence:
- test harness.test.mjs:549 — `noGhCalls` assertion: gh-calls.log must be absent or empty
- test output line 395: `✔ does not re-close issues when feature is already completed (idempotent)`

### CR-5: issuesClosed counter accuracy

**FAIL (reporting only — not a security vulnerability)**

`closeIssue()` returns a boolean (`true` on success, `false` on gh CLI failure) but `finalize.mjs` ignores the return value.

```js
// finalize.mjs:122-130
try {
  closeIssue(task.issueNumber, comment);   // ← return value discarded
  ...
  issuesClosed++;                          // ← always increments inside try
} catch { /* best-effort */ }
```

All tests inject a fake gh that exits 0, so no test exercises the failure path. If `gh` times out or returns non-zero, the output will still report `issuesClosed: N` as if closes succeeded.

This is a reporting inaccuracy, not a security vulnerability, but it means callers cannot trust `issuesClosed` as a success indicator.

### CR-6: Input validation on issue numbers from STATE.json

**PASS with suggestion**

`closeIssue` guards with `if (!number) return false` (falsy check) before `String(number)`. This rejects `null`, `undefined`, `0`, and empty string. Given that `spawnSync` is used (no shell), a non-integer string like `"123abc"` would be passed as a single arg to `gh`, which rejects it cleanly — no injection possible.

The tamper-detection at CR-2 makes injection via STATE.json already hard. No positive-integer validation is strictly necessary for security here, but it would improve defense-in-depth.

### CR-7: Dead code / incomplete tracking block

**PASS (suggestion to delete)**

```js
// finalize.mjs:116, 124-127
const tracking = readTrackingConfig();
for (...) {
  ...
  if (tracking) {
    const projMatch = String(tracking.statusFieldId || "").match(/\d+/);
    // Best-effort: move to done on project board
  }
  ...
}
```

`projMatch` is computed but never used. `readTrackingConfig()` reads `.team/PROJECT.md` from `process.cwd()` on every call — in a repo with a large PROJECT.md or read errors this is wasted I/O. No attack surface, but dead code adds noise and maintenance burden. Already flagged by Simplicity reviewer.

---

## Threat Model Assessment

| Threat | Mitigated? | How |
|---|---|---|
| Shell injection via issueNumber | Yes | spawnSync, not exec |
| STATE.json tampering | Yes | _written_by + _write_nonce guards |
| TOCTOU race on finalize | Yes | lock + re-read after lock |
| Double-close on retry | Yes | idempotency via status check before and after lock |
| Env var injection (APPROVAL_POLL_INTERVAL) | Yes | validated against [1000,3600000]; test output line 28 shows correct fallback |
| Misleading issuesClosed count | Partial | best-effort semantics are declared but not visible in output |

---

## Findings

🟡 bin/lib/finalize.mjs:123 — `closeIssue()` return value discarded; `issuesClosed` always increments inside `try` even on gh failure; check return: `if (closeIssue(...)) issuesClosed++`

🔵 bin/lib/finalize.mjs:134 — `approvalIssueNumber` not validated as a positive integer; add `Number.isInteger(n) && n > 0` guard before `closeIssue` for defense-in-depth

🔵 bin/lib/finalize.mjs:116 — `readTrackingConfig()` result only enters dead code (lines 124-127); delete the call and the dead block (already flagged by Simplicity reviewer)
