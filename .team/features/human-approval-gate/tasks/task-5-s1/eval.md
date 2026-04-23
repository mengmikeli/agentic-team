## Parallel Review Findings

### [security]
**Verdict: FAIL**

Two critical security issues block this merge:

---

🔴 `.gitignore`:1 — `.team/.approval-secret` not excluded; `git add .team/` commits the signing key permanently; add `.team/.approval-secret` to `.gitignore`

🔴 `bin/lib/outer-loop.mjs`:66 — `_written_by: signingKey` stores the raw secret verbatim in `approval.json`; the supervised AI agent reads this file after `createApprovalIssue` and can forge any future approval — attack requires only filesystem read, not access to `.a

### [architect]
**Verdict: PASS** (2 backlog items)

---

Findings:

🟡 `bin/lib/outer-loop.mjs:41` — `.team/.approval-secret` is not in `.gitignore`; if accidentally committed, the signing key is exposed in git history, undermining the integrity protection this feature provides. Add `.team/.approval-secret` to `.gitignore`.

🟡 `bin/lib/outer-loop.mjs:623` — Backward-compat break: any project with a pre-existing `approval.json` signed with `_written_by: "at-harness"` (written before this feature was wired in) 

### [devil's-advocate]
---

**Files read:** `outer-loop.mjs`, `util.mjs` (grep), `github.mjs` (grep), `approval-gate.test.mjs`, `outer-loop.test.mjs` (partial), `test-output.txt`, `handshake.json`, existing `eval.md`, `.gitignore`.

**Verdict: PASS** (no blocking criticals — 3 backlog items)

---

🟡 test/outer-loop.test.mjs:718-723 — Test verifies `issueNumber` and `status` in written `approval.json` but never asserts `_written_by !== "at-harness"`; a regression dropping `signingKey` from `writeApprovalState` at oute