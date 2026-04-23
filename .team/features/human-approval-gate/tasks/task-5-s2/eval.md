## Parallel Review Findings

### [security]
## Verdict: PASS

**427 tests pass, 0 fail.** The `isStructurallyComplete` guard is correctly wired at all three `approvalStatus` write sites. Eval written to `.team/features/human-approval-gate/tasks/task-5-s2/eval.md`.

---

### Findings

🟡 `bin/lib/outer-loop.mjs:128` — `createApprovalIssue` defaults `signingKey = WRITER_SIG` (`"at-harness"`), a static constant trivially discoverable from source. Any future caller omitting `signingKey` from `deps` produces a forgeable approval file. The curr

### [architect]
---

**Verdict: PASS** (4 warnings → backlog, 2 suggestions optional)

## Findings

🟡 `bin/lib/outer-loop.mjs:88` — `readApprovalState` returns full `parsed` object (includes `_integrity`, `_last_modified`); if any future caller passes this to `writeApprovalState`, HMAC is computed over stale metadata and the file becomes permanently unreadable. Fix: return `{ ...dataFields }` instead of `parsed`.

🟡 `bin/lib/outer-loop.mjs:55` — `getOrCreateApprovalSigningKey` writes `.approval-secret` with p

### [devil's-advocate]
---

**Verdict: PASS** — no criticals, all 427 tests pass. Eval written to `.team/features/human-approval-gate/tasks/task-5-s2/eval.md`.

---

## Structured Findings

🟡 `test/outer-loop.test.mjs` — No integration test for guard's negative path: re-entry where `approvalState.status === "approved"` but STATE.json is absent. Unit test covers `isStructurallyComplete(null)` in isolation; the outerLoop code path is untested end-to-end. Add a test: pre-seed approval.json as "approved" with valid HMAC,