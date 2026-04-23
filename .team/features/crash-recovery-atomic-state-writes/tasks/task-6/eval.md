## Parallel Review Findings

### [security]
---

**Findings:**

🟡 `bin/lib/util.mjs:98` — `lockFile()` behavioral contract has no direct unit tests; exclusive-create, stale-PID eviction, and 5s-timeout are only covered implicitly. Add unit tests simulating each path.

🟡 `bin/lib/gate.mjs:27` — Placeholder gate denylist only blocks `echo gate-recorded`; `true`, `exit 0`, `: `, and `echo ok` all bypass it. Broaden the denylist or require an allowlisted command.

🔵 `bin/lib/util.mjs:55` — `atomicWriteSync()` leaks the temp file if `rename

### [architect]
---

## Findings

**Verdict: PASS**

All SPEC criteria are met. The critical lock-scope bug from attempt 1 (`gate.mjs` holding the lock across the entire `execSync`) is confirmed fixed — the lock is now acquired in the `finally` block after the gate command completes (`gate.mjs:82`).

**Files actually read:** `util.mjs`, `gate.mjs`, `transition.mjs`, `finalize.mjs`, `harness-init.mjs`, `run.mjs`, `test/crash-recovery.test.mjs`, `SPEC.md`, all 6 handshake.json files, task-6 eval.md, test-output.t

### [devil's-advocate]
Here are the findings:

---

🔴 `bin/lib/run.mjs:119` — `runGateInline` calls `readState` → `writeState` (line 132) with no lock. This is the primary execution path for every `agt run` quality gate. All 4 harness subcommands (`gate.mjs`, `transition.mjs`, `finalize.mjs`, `stop.mjs`) correctly acquire `lockFile` before writing STATE.json, but `runGateInline` — the inline equivalent — does not. Any concurrent `agt-harness transition` or `finalize` (which do lock) races with this unlocked write and