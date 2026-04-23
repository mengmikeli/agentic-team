## Parallel Review Findings

### [security]
---

**Security Review — `crash-recovery-atomic-state-writes`**

**Verdict: PASS** (3 warnings to backlog, 2 suggestions)

---

**Findings:**

🟡 `bin/lib/harness-init.mjs:21` — `--feature` value is used directly in `path.join` without validation; `--feature ../../../tmp/evil` constructs paths outside `.team/features/`; add a `/^[a-z0-9][a-z0-9_-]*$/i` guard before building `featureDir`

🟡 `bin/lib/util.mjs:93` — `isPidAlive` catches all exceptions including EPERM; on Unix, EPERM means the proc

### [architect]
---

**Verdict: PASS** (4 backlog items)

All 7 SPEC criteria are met with direct evidence. 376 tests pass, 0 failures. The implementation is structurally clean — `writeState()` is the sole write path for STATE.json and consistently routes through `atomicWriteSync`.

Findings:

🟡 `bin/lib/gate.mjs:40` — TOCTOU: tamper check runs pre-lock; `freshState._written_by` not re-verified post-lock at line 89. A concurrent STATE.json swap between lines 40–53 bypasses the guard; re-check after lock acquis

### [devil's-advocate]
---

**Overall verdict: PASS** (with 3 backlog items)

Files I actually read: `util.mjs`, `harness-init.mjs`, `run.mjs` (three regions), `transition.mjs` (oscillation section), `crash-recovery.test.mjs`, `test-output.txt`, `handshake.json`, `SPEC.md`.

---

🟡 `test/crash-recovery.test.mjs` — `lockFile()` has zero test coverage; SPEC criterion 6 is verified by code reading only. Add tests for: lock acquired/released, stale PID eviction, and `{ acquired: false }` on timeout.

🟡 `bin/lib/run.mjs: