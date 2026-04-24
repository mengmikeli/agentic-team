## Parallel Review Findings

### [security]
---

## Findings

🟡 `bin/lib/run.mjs:1094` — `attempt` resets to 1 on each `_runSingleFeature` invocation; crash-resume causes duplicate `{iteration:1}` entries in persisted history; Set deduplication collapses them to one distinct iteration, delaying escalation by one extra WARN attempt. Fix: use `(task.gateWarningHistory?.length ?? 0) + 1` as the iteration key.

🟡 `bin/lib/iteration-escalation.mjs:34` — No null-entry guard on individual `gateWarningHistory` entries; a `null` entry throws Typ

### [architect]
---

**Verdict: PASS** (3 warnings → backlog, 2 suggestions)

Files I actually read and verified: `iteration-escalation.mjs`, `run.mjs` (full), `iteration-escalation.test.mjs`, `test-output.txt` (task-1 and task-2), `SPEC.md`, `progress.md`, both `handshake.json` files, and `task-1/eval.md`.

**Test evidence**: 508/508 pass, 0 fail. The core feature is correctly implemented and wired.

---

**Findings:**

🟡 bin/lib/run.mjs:1088 — WARN+escalation logic copy-pasted between `review` and `multi-rev

### [devil's-advocate]
Here are the findings from this devil's-advocate review:

---

**Verdict: PASS** (1 new warning → backlog)

## Findings

🟡 `test/iteration-escalation.test.mjs:157-191` — The integration test simulates an unconditional-retry loop, but real `run.mjs` **passes** a task when compound gate WARNs and there are no real critical findings (`reviewFailed=false → break`). The escalation code path at `run.mjs:1094-1112` and `1205-1212` is only reachable when WARN co-occurs with a real reviewer-generated cr