## Parallel Review Findings

### [security]
## Findings

🔴 `bin/lib/outer-loop.mjs:26` — `readApprovalState` returns any valid JSON verbatim with no integrity check; add `_written_by`/nonce validation (like STATE.json tamper detection) so a misbehaving agent cannot write `{"status":"approved"}` to bypass the human gate

🟡 `bin/lib/outer-loop.mjs:72` — SPEC.md read without size cap before passing to `gh issue create --body`; truncate to ≤60KB to stay within GitHub API body limit and avoid silent failure

🟡 `bin/lib/outer-loop.mjs:639` —

### [architect]
---

**Verdict: ITERATE**

## Findings

🔴 `bin/lib/outer-loop.mjs:639` — `readState(featureDir)` returns `null` for fresh features; STATE.json is created by EXECUTE (`runSingleFeature`), which runs *after* the approval gate. The `if (stateOnApproval)` guard silently drops the `approvalStatus: "approved"` write. Tests pass only because they manually pre-create STATE.json before calling `outerLoop` — this does not reflect the production execution order. Fix: write STATE.json unconditionally at ap

### [devil's-advocate]
**Verdict: PASS** (with backlog items)

---

**Findings:**

🔴 `bin/lib/outer-loop.mjs:26` — `readApprovalState` returns any valid JSON with no integrity check; a misbehaving brainstorm agent can write `{"status":"approved","issueNumber":1}` to `featureDir/approval.json` during the brainstorm phase and bypass the human gate entirely — add `_written_by`/nonce validation matching STATE.json tamper detection

🟡 `bin/lib/outer-loop.mjs:608` — "Already approved" re-entry branch logs but never writes