## Parallel Review Findings

### [security]
---

**Verdict: PASS**

Findings (copy-paste format):

🟡 `bin/lib/outer-loop.mjs:591` — Corrupt approval.json guard is broken: `approvalState?.issueNumber` is `undefined` when `readApprovalState` returns `{ corrupt: true }`, so `approvalIssueNumber` falls to `null` and a **new duplicate issue is created** — directly contradicting the warning comment "will not re-create issue"; fix by adding an explicit `if (approvalState?.corrupt) continue;` guard before the issue-number extraction

🔵 `bin/lib

### [architect]
**Verdict: PASS**

---

**Findings:**

🟡 `test/approval-gate.test.mjs:208` — 4 of 6 `waitForApproval` tests omit `getIssueUrl` dep, so they fall back to real `ghGetIssueUrl` (live shell call to `gh issue view`); in CI without `gh` auth this silently returns null but introduces an external dependency; add `getIssueUrl: () => null` to tests at lines 208, 221, 236, 254

🔵 `bin/lib/outer-loop.mjs:104` — `featureDir` parameter documented as "unused currently, kept for future STATE writes"; YAGNI: d

### [devil's-advocate]
---

**Findings:**

🟡 `test/approval-gate.test.mjs:156` — URL presence test doesn't verify ordering; `combined.includes(url)` passes even if the URL were printed inside the poll loop; the spec says "before pausing" but no test asserts `indexOf(urlLine) < indexOf(waitingLine)`; a refactor that moves the print into the loop keeps this green while breaking the user-visible contract

🟡 `test/approval-gate.test.mjs:208` — 4 existing `waitForApproval` tests (also :221, :236, :254) don't inject `getI