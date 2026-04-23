## Parallel Review Findings

### [security]
---

## Security Review: Wire `getOrCreateApprovalSigningKey` into approval read/write flow

**Verdict: PASS** — no criticals, all 418 tests pass. Four warnings must go to backlog.

---

### Files Read
- `bin/lib/outer-loop.mjs` (full)
- `test/approval-gate.test.mjs` (full)
- `test/outer-loop.test.mjs` (approval sections)
- `bin/lib/github.mjs`, `bin/lib/util.mjs` (targeted greps)
- `tasks/task-5-s1/handshake.json`, `artifacts/test-output.txt`, `SPEC.md`
- Ran `agt run --help` live to verify ini

### [architect]
---

**Verdict: PASS** (2 backlog items flagged)

**Files actually read:** `outer-loop.mjs` (lines 1–705), `util.mjs` (1–30), `test/approval-gate.test.mjs` (1–499), `.gitignore`, `handshake.json`, `test-output.txt`

---

**Findings:**

🟡 `bin/lib/outer-loop.mjs:46` — `readApprovalState` defaults `signingKey = WRITER_SIG` (`"at-harness"`). Any future caller omitting the argument silently validates against the well-known static string, defeating the per-project key guarantee. Production path (L64

### [devil's-advocate]
Now here are the structured findings:

---

**Verdict: PASS** — All 418 tests pass, no critical bugs found. Key is correctly wired throughout `outerLoop`. Four items must go to backlog.

---

🟡 `bin/lib/outer-loop.mjs:74` — `readApprovalState` returns `parsed` (includes `_integrity` and `_last_modified`); if caller ever passes this directly to `writeApprovalState`, old `_integrity` poisons the HMAC payload and the file becomes permanently unreadable. Fix: `return { ...dataFields };`

🟡 `test/o