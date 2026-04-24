## Security Review — parent-issue-subtask-lifecycle

**Reviewer:** security specialist
**Verdict:** PASS (with backlog items)
**Date:** 2026-04-24

---

### Files Read

- `bin/lib/finalize.mjs` (full, 150 lines)
- `bin/lib/run.mjs` (lines 920–944, 1080–1093, 1285–1315, 1350–1362)
- `bin/lib/outer-loop.mjs` (lines 55–98, 730–742)
- `bin/lib/github.mjs` (lines 130–209)
- `bin/lib/util.mjs` (via grep; lines 187–206 confirmed)
- `test/harness.test.mjs` (via task-4/task-5 eval cross-reference; gate output confirmed exit 0)

---

### Criteria

#### 1. Shell / command injection — PASS
All `gh` calls go through `spawnSync("gh", args, {...})` with JS array arguments (`github.mjs:8-20`). No shell is invoked. User-controlled values (`approvalIssueNumber`, `task.status`, `comment`) are passed as discrete array elements — shell metacharacters are inert. `closeIssue` at `finalize.mjs:136` passes `String(number)` as a positional arg, not interpolated into a shell string.

#### 2. Markdown injection into GitHub issue body — WARNING (backlog)
`run.mjs:929` interpolates `state.approvalIssueNumber` directly into a GitHub issue body: `\n\nPart of #${state.approvalIssueNumber}`. The value comes from `readState()` which performs zero tamper checking — it is a plain `JSON.parse` (`util.mjs:190-197`). A STATE.json with `approvalIssueNumber: "1\n\n**injected markdown**"` would produce malicious content in the GitHub issue body. Not exploitable remotely (requires local file write), but the input is never validated as a positive integer before use.

#### 3. TOCTOU on STATE.json tamper check — WARNING (backlog)
`finalize.mjs:21` checks `state._written_by !== WRITER_SIG` on the pre-lock read. The lock is acquired at line 69, and `freshState` is re-read at line 76 inside the lock — but the tamper check (`_written_by`) is **not re-applied to `freshState`**. An attacker who can write STATE.json between lines 21 and 76 can pass the tamper check on `state` and have `freshState` reflect malicious content. Limited blast radius (local tool), but the guard is incomplete.

#### 4. `issuesClosed` counter overstates on silent failure — WARNING (pre-existing, backlog)
`finalize.mjs:123,128`: `closeIssue()` returns `false` when `gh` exits non-zero (confirmed in `github.mjs:189-193`). `runGh` never throws, so the `catch {}` blocks at lines 129 and 138 never fire. `issuesClosed++` executes unconditionally. Callers reading `issuesClosed === 2` in the JSON output believe both issues were closed when they may not have been. Not a security vulnerability, but misleads automated consumers of the finalize output.

#### 5. approval.json integrity — PASS
`outer-loop.mjs:60-88` verifies a file-private HMAC-SHA256 (`_integrity`) before trusting approval state. Uses `timingSafeEqual` to prevent timing attacks on the comparison. Corrupt or unsigned files are rejected with `{ corrupt: true }` and execution halts (`outer-loop.mjs:764`). The signing key is created with `mode: 0o600` (`outer-loop.mjs:55`). This is well-implemented for a local developer tool.

#### 6. approvalIssueNumber falsy vs. integer check — SUGGESTION
`finalize.mjs:134` checks `if (freshState.approvalIssueNumber)` — this passes for any truthy value including strings. A string like `"abc"` would reach `closeIssue()` which calls `String(number)` and passes it to `gh issue close abc` — `gh` would error, the catch swallows it, and no close occurs. Not a security vulnerability, but defensive `Number.isInteger()` would prevent silent no-ops.

#### 7. Regex not anchored in markChecklistItemBlocked — SUGGESTION
`github.mjs:160-163`: `markChecklistItemBlocked` uses `new RegExp(...)` without `m` flag or `^` anchor. Could match a pattern mid-line if the issue body has unusual content with embedded newlines followed by the same pattern. Low-risk, but the parallel `tickChecklistItem` at line 146 has the same issue — a shared helper with anchoring would fix both.

---

### Findings

🟡 `bin/lib/run.mjs:929` — `state.approvalIssueNumber` interpolated into GitHub issue body without integer validation; `readState()` has no tamper check; add `Number.isInteger(state.approvalIssueNumber)` guard before use (→ backlog)

🟡 `bin/lib/finalize.mjs:21` / `finalize.mjs:76` — TOCTOU: `_written_by` tamper check runs on pre-lock `state`; `freshState` re-read inside lock is never re-checked; re-apply tamper check to `freshState` before using it (→ backlog)

🟡 `bin/lib/finalize.mjs:128` — `issuesClosed++` fires unconditionally; `closeIssue()` returns `false` (never throws) on gh failure; `catch {}` dead; change to `if (closeIssue(...)) issuesClosed++` at lines 123 and 136 (→ backlog, pre-existing)

🔵 `bin/lib/finalize.mjs:134` — falsy check `if (freshState.approvalIssueNumber)` accepts non-integer truthy values; add `Number.isInteger(freshState.approvalIssueNumber) && freshState.approvalIssueNumber > 0` guard

🔵 `bin/lib/github.mjs:160` — `markChecklistItemBlocked` regex lacks `m` flag and `^` anchor; could match mid-line in edge cases; add multiline flag and `^` prefix, consistent with `tickChecklistItem`

---

### Overall Verdict: PASS

No critical (🔴) findings. Three 🟡 warnings, all appropriate for backlog. The approval gate itself (HMAC-signed `approval.json` with `timingSafeEqual`, 0o600 key file) is the highest-value security surface and is well-implemented. The primary new code paths (`Part of #N` backlink, checklist tick/block on parent issue, `agt finalize` closes approval issue) all go through `spawnSync` array args — no command or shell injection possible. The warnings above are calibrated to a local developer tool: local file write access is already a significant trust boundary.
