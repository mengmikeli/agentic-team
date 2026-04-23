## Parallel Review Findings

### [security]
**Verdict: PASS** (2 warnings flagged to backlog)

---

🟡 `bin/lib/outer-loop.mjs:60` — `readApprovalState` defaults to `signingKey = WRITER_SIG` ("at-harness"), a public constant; any caller omitting the key accepts attacker-crafted `approval.json` files — require explicit key or throw if key equals WRITER_SIG in production context

🟡 `bin/lib/outer-loop.mjs:668` — Re-entry fallback reads `approvalIssueNumber` from STATE.json, which has no HMAC protection; tampered STATE.json could redirect a

### [architect]
---

**PASS**

All 4 claimed behaviors verified against both test evidence and implementation code.

---

**Findings:**

🟡 `bin/lib/outer-loop.mjs:162` — `featureDir` parameter in `waitForApproval` is never read in the function body (acknowledged in JSDoc as "unused currently"). Dead API parameter inflates every test callsite and obscures the actual interface. Either give it a real purpose or remove it.

🔵 `bin/lib/outer-loop.mjs:113` — JSDoc on `createApprovalIssue` says "record it in STATE.j

### [devil's-advocate]
**Verdict: PASS** (4 warnings, 2 suggestions)

---

**Findings:**

🟡 `test/approval-gate.test.mjs:253` — 4 `waitForApproval` tests omit `getIssueUrl` mock; real `spawnSync("gh", ...)` fires per test. Confirmed by 734ms/647ms/669ms durations on fully-mocked logic. Add `getIssueUrl: () => null` to deps at lines 253, 282, 299, 414.

🟡 `test/outer-loop.test.mjs:1159` — SIGINT test checks STATE.json is parseable but never asserts `stateData.approvalIssueNumber === 42`. The primary re-entry invarian