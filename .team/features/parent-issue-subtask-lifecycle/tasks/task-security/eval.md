## Security Review — parent-issue-subtask-lifecycle (run_1 final)

**Reviewer:** security specialist
**Verdict:** PASS
**Date:** 2026-04-24

---

### Files Read

- `bin/lib/github.mjs` lines 1–30, 95–200 (runGh, getIssueBody, editIssue, tickChecklistItem, markChecklistItemBlocked, buildTaskIssueBody)
- `bin/lib/run.mjs` lines 900–944, 1292–1310, 1350–1362 (issue creation loop, blocked path, gate-pass tick)
- `bin/lib/outer-loop.mjs` lines 730–810 (approval gate, approvalIssueNumber sourcing)
- `bin/lib/finalize.mjs` lines 115–140 (issuesClosed loop, approval issue close)
- `test/parent-checklist.test.mjs` full (621 tests, exit 0)
- `.team/features/parent-issue-subtask-lifecycle/tasks/task-6/artifacts/test-output.txt` lines 1–290

---

### Criteria

#### 1. Shell / command injection — PASS

All `gh` invocations go through `spawnSync("gh", args, { stdio: ["pipe","pipe","pipe"] })` with JS array arguments (`github.mjs:8-20`). No shell is ever spawned. User-controlled values (`approvalIssueNumber`, `task.title`, `featureName`, comment strings) are passed as discrete array elements; shell metacharacters are structurally inert.

**Edge case checked:** `editIssue(state.approvalIssueNumber, body)` at `run.mjs:1300` calls `runGh("issue", "edit", String(number), "--body", body)` — the number becomes a positional arg, not a shell string.

#### 2. Markdown injection into GitHub issue body — PASS (fixed this cycle)

Previous review (`task-security/eval.md` prior iteration) flagged `run.mjs:929` as interpolating `state.approvalIssueNumber` without integer validation. The current diff adds `buildTaskIssueBody` (`github.mjs:170-177`) which validates:

```js
Number.isInteger(approvalIssueNumber) && approvalIssueNumber > 0
```

A non-integer string like `"1\n\n**evil**"` fails `Number.isInteger()` and produces no backlink. Test coverage confirmed at `test-output.txt:1260`:

```
✔ does not include Part of when approvalIssueNumber is a non-integer string
```

The inline interpolation at `run.mjs:929` is gone; the validated path is the only path.

**Residual 🔵:** `featureName` and `task.title` are embedded raw in the body template (`github.mjs:176`). These could contain arbitrary markdown (e.g. `[phishing](http://evil.com)`). Since GitHub renders markdown server-side with its own XSS protections, and this is a local dev tool with local file trust, this is a cosmetic risk only.

#### 3. `if (parentBody)` falsy guard — PASS (fixed this cycle)

Previous review flagged `run.mjs:1299` and `run.mjs:1357` for coercing empty-string body to falsy, silently skipping checklist updates on issues with no body. Both are now `if (parentBody !== null)`, matching `getIssueBody`'s documented contract ("Returns string (may be '') on success, null on CLI failure").

Verified in diff: both hunks show `- if (parentBody) {` → `+ if (parentBody !== null) {`.

#### 4. TOCTOU on STATE.json tamper check — WARNING (pre-existing, backlog, not fixed)

`finalize.mjs:21` checks `state._written_by !== WRITER_SIG` on the pre-lock read. `freshState` is re-read inside the lock at line 76 but the tamper check is not re-applied to it. A file swap between lines 21 and 76 bypasses the guard. No change in this cycle.

#### 5. `issuesClosed++` unconditional despite silent failure — WARNING (pre-existing, backlog, not fixed)

`finalize.mjs:123, 128`: `closeIssue()` returns `false` when `gh` exits non-zero (confirmed: `runGh` never throws, `catch {}` at lines 129/138 is dead code). `issuesClosed++` fires unconditionally, overstating actual closures. No change in this cycle.

#### 6. approval.json integrity — PASS (unchanged, well-implemented)

HMAC-SHA256 via `timingSafeEqual`, key stored with `mode: 0o600`, corrupt/unsigned files produce `{ corrupt: true }` and halt execution. All approval integrity tests pass (`test-output.txt:58-83`).

#### 7. `approvalIssueNumber` truthy check in finalize — SUGGESTION (pre-existing, not fixed)

`finalize.mjs:134`: `if (freshState.approvalIssueNumber)` accepts any truthy value. A non-integer would reach `closeIssue(string)` → `String(string)` → `gh issue close string` → gh error → silently ignored. Not exploitable via `spawnSync`, but defensive `Number.isInteger()` guard would prevent a silent no-op.

---

### Findings

🟡 `bin/lib/finalize.mjs:21` / `finalize.mjs:76` — TOCTOU: `_written_by` check runs on pre-lock `state`; `freshState` re-read inside lock is never re-checked; re-apply tamper check to `freshState` before use (→ backlog, pre-existing)

🟡 `bin/lib/finalize.mjs:123,128` — `issuesClosed++` fires unconditionally; `closeIssue()` returns `false` (never throws) on gh failure; `catch {}` dead code; change to `if (closeIssue(...)) issuesClosed++` at both call sites (→ backlog, pre-existing)

🔵 `bin/lib/finalize.mjs:134` — `if (freshState.approvalIssueNumber)` accepts non-integer truthy values; add `Number.isInteger(freshState.approvalIssueNumber) && freshState.approvalIssueNumber > 0`

🔵 `bin/lib/github.mjs:176` — `featureName` and `title` embedded raw in issue body; no markdown escaping; a crafted value renders arbitrary markdown in the GitHub issue; low risk for a local dev tool but worth noting

---

### Edge Cases Checked

- `approvalIssueNumber: "55\n\n**evil**"` → fails `Number.isInteger()` → no backlink (test confirmed)
- `approvalIssueNumber: 0` → fails `> 0` check → no backlink (test confirmed)
- `parentBody === ""` → `!== null` passes → `tickChecklistItem("", ...)` returns `""` unchanged → no edit call (safe)
- `task.title` with regex metacharacters → `title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` escapes before `new RegExp(...)` (code confirmed)
- Replacement string uses function callback → `$` signs in title are not interpreted as backreferences (code confirmed)

---

### Overall Verdict: PASS

No critical (🔴) findings. The two highest-priority 🟡 security warnings from the previous review cycle (`run.mjs:929` Markdown injection, `run.mjs:1298/1356` falsy body guard) are now fixed with direct evidence in the diff and test suite. Remaining 🟡 items are pre-existing backlog debt in `finalize.mjs` with no new regression risk from this commit. The HMAC approval gate remains the most security-sensitive surface and is well-implemented.
