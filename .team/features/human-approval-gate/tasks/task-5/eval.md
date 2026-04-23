## Parallel Review Findings

### [security]
---

## Verdict: ITERATE

Files read: `bin/lib/outer-loop.mjs`, `bin/lib/util.mjs`, `bin/lib/flows.mjs`, `test/approval-gate.test.mjs`, `task-5/handshake.json`

---

🔴 `bin/lib/util.mjs:10` — `WRITER_SIG = "at-harness"` is a static, publicly-readable string; any agent with filesystem access can read it and forge `approval.json` with `_written_by: "at-harness", status: "approved"` to bypass the gate entirely — replace with a runtime HMAC secret generated at harness startup and stored outside the

### [architect]
---

**Verdict: ITERATE** — 2 critical blockers remain unaddressed (one introduced by a previous fix).

---

**Findings:**

🔴 `bin/lib/outer-loop.mjs:651` — Fresh-feature race: `readState ?? {}` writes a minimal STATE.json (only `approvalStatus` + metadata) before EXECUTE runs. `run.mjs:796` then sees STATE.json exists and **skips `harness-init`**, leaving `tasks`, `gates`, `version`, etc. absent. First `at-harness transition` call crashes on `state.tasks.find(...)`. Tests mask this by pre-crea

### [devil's-advocate]
---

**Findings:**

🟡 `bin/lib/outer-loop.mjs:139` — `status === "Ready"` is case-sensitive; if the GitHub Projects API returns `"ready"` or adds whitespace, polling loops forever with no timeout; normalize before comparing

🟡 `test/outer-loop.test.mjs` — The "already approved on re-entry" branch (`outer-loop.mjs:615-621`) has no integration test; existing re-entry test uses `status: "pending"` which takes the resume-polling path, not the already-approved path

🟡 `test/outer-loop.test.mjs:679