## Parallel Review Findings

### [security]
Eval written. Here are the findings:

---

**Verdict: ITERATE**

Commit `6470dd4` introduced `getOrCreateApprovalSigningKey` and claimed to fix both critical blockers — but neither fix was wired into the execution path.

---

🔴 `bin/lib/util.mjs:10` — `WRITER_SIG = "at-harness"` is a static, publicly-readable string used to sign `approval.json`; any process with filesystem access can write `{ "status": "approved", "_written_by": "at-harness" }` and bypass the gate — replace with the runtime sec

### [architect]
---

**Verdict: ITERATE**

## Findings

🔴 `bin/lib/outer-loop.mjs:672` — `readState(featureDir) ?? {}` on a fresh feature writes a structurally incomplete STATE.json (only `approvalStatus` + harness metadata); `run.mjs:796` skips `harness init` because the file now exists; the inner harness operates with `tasks === undefined`, `version === undefined`, `gates === undefined`; fix by deferring the `approvalStatus` write until after `runSingleFeature` has initialized the feature, or guard with stru

### [devil's-advocate]
## Findings

**Verdict: FAIL** — 2 critical issues, tests mask both.

---

🔴 `bin/lib/outer-loop.mjs:672` — `readState(featureDir) ?? {}` on a fresh feature writes a minimal STATE.json (only `approvalStatus` + metadata) before EXECUTE runs; `run.mjs:796` then skips `harness init` because STATE.json now exists; `tasks`/`gates`/`version`/`status` are absent, crashing the inner harness on any `state.tasks.find(...)` call — guard with a presence check before writing, or guarantee harness-init runs 