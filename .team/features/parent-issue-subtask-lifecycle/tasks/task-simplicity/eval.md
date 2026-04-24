## Simplicity Review — parent-issue-subtask-lifecycle

**Reviewer:** simplicity advocate
**Verdict:** PASS (with backlog items)
**Date:** 2026-04-24

---

### Files Read

- `bin/lib/finalize.mjs` (full, 150 lines)
- `bin/lib/github.mjs` (lines 1–200)
- `bin/lib/run.mjs` (lines 880–962, 1080–1092, 1280–1400)
- `test/parent-checklist.test.mjs` (full, 167 lines)
- `.team/features/parent-issue-subtask-lifecycle/tasks/task-6/eval.md` (combined prior eval)
- `.team/features/parent-issue-subtask-lifecycle/tasks/task-6/artifacts/test-output.txt` (first 100 lines)

---

### Prior Review Claims That Are Now Stale

Two claims from prior review rounds (tasks 1–2) did not survive to the current code:

1. **`if (parentBody)` falsy guard** — Both `run.mjs:1297` and `run.mjs:1354` already use `if (parentBody !== null)`. The fix was applied before tasks 3–5 ran. These findings no longer apply.

2. **`buildTaskIssueBody` test tautology** — `test/parent-checklist.test.mjs:135–166` calls `buildTaskIssueBody()` from `github.mjs` directly. If the back-link logic is removed from `buildTaskIssueBody`, the test at line 136 fails. The function was correctly extracted to production code. These tests are not tautologies.

---

### Complexity Findings

#### Confirmed Dead Code: `finalize.mjs:116–127`

```js
const tracking = readTrackingConfig();          // L116 — reads .team/PROJECT.md
for (const task of freshState.tasks || []) {
  if (task.issueNumber) {
    try {
      closeIssue(task.issueNumber, comment);
      if (tracking) {
        const projMatch = String(tracking.statusFieldId || "").match(/\d+/);
        // Best-effort: move to done on project board     ← no code follows
      }
      issuesClosed++;                             // L128 — unconditional
    } catch { /* best-effort */ }
```

`readTrackingConfig()` is called, `tracking` is truthy-checked, `projMatch` is computed — and then the block ends. Nothing uses `projMatch`. A future reader has to trace into `readTrackingConfig`, understand the return shape, parse the regex, and then discover it's a silent no-op. This is pure cognitive tax.

The comment "Best-effort: move to done on project board" signals intent that was never implemented. The feature task description ("no extra project board columns required") confirms this code was intentionally deferred — but the dead block wasn't removed.

#### Dead Import: `finalize.mjs:9`

```js
import { closeIssue, setProjectItemStatus, readTrackingConfig } from "./github.mjs";
```

`setProjectItemStatus` is imported but never called anywhere in `finalize.mjs`. It was left over from the deferred board-sync block. Contributes to the false impression that board status is being managed here.

#### Redundant File Read in Per-Task Loop: `run.mjs:936–940`

```js
// L921–925 — projectNum already extracted here
const projMd = readFileSync(join(teamDir, "PROJECT.md"), "utf8");
const m = projMd.match(/projects\/(\d+)/);
if (m) projectNum = parseInt(m[1]);

// L936–940 — same file read again inside per-task loop
try {
  const projectMd = readFileSync(join(teamDir, "PROJECT.md"), "utf8");
  const projMatch = projectMd.match(/projects\/(\d+)/);
  if (projMatch) addToProject(issueNum, parseInt(projMatch[1]));
} catch {}
```

`projectNum` is already available from the outer scope. The inner read is a copy-paste artifact — it uses a different variable name (`projectMd`/`projMatch`) for the same data, making readers wonder if there's a reason for the second read. There isn't. Should be `if (projectNum) addToProject(issueNum, projectNum)`.

#### `issuesClosed++` Fires Even When `closeIssue()` Returns False: `finalize.mjs:123,136`

`closeIssue()` returns a boolean, never throws (`runGh` catches all errors internally). The surrounding `catch {}` is dead. `issuesClosed++` fires regardless of the return value. When `gh` is unavailable, the reported count overstates actual closures. The fix is one character: `if (closeIssue(...)) issuesClosed++`.

#### Asymmetric Checklist Updates Across Exit Paths

The parent-issue checklist is updated in some exit paths but not others:

| Exit path | Checklist updated? |
|---|---|
| Gate PASS (`run.mjs:1354–1360`) | ✅ `tickChecklistItem` |
| Review-round escalation (`run.mjs:1296–1302`) | ✅ `markChecklistItemBlocked` |
| Iteration-escalation (`run.mjs:1310–1316`) | ❌ no update |
| User-skip (`run.mjs:1085–1091`) | ❌ no update |

This inconsistency is a cognitive burden: readers have to audit every exit path to understand when the parent issue reflects reality. The iteration-escalation path and review-round escalation path are structurally adjacent (lines 1292 vs 1310), making the omission invisible at a glance.

#### Near-Duplicate Logic: `github.mjs:141–164`

`tickChecklistItem` and `markChecklistItemBlocked` share the same guard (`if (!body || !title || !issueNumber)`), the same escaping (`title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`), and a near-identical regex pattern. The only difference is the replacement string. A shared helper `replaceChecklistItem(body, title, issueNumber, replacement)` would halve this surface and ensure the two functions stay in sync.

#### Regex Not Anchored: `github.mjs:145,160`

Both `tickChecklistItem` (L145) and `markChecklistItemBlocked` (L160) use unanchored regexes without the multiline flag. A body containing `some text - [ ] My Task (#42) more text` on a single line would match mid-line. The standard checklist format always puts items at line starts, but the guard isn't enforced. Adding `^` with the `m` flag is a one-character fix that removes the ambiguity.

---

### Verdict per Criterion

| Criterion | Evidence | Result |
|---|---|---|
| No unnecessary abstractions | `buildTaskIssueBody` extraction is appropriate; `readTrackingConfig` call is unnecessary | PASS (with dead code) |
| No over-engineering | Feature task was a no-op verification; no new columns/config added; correct scope | PASS |
| Cognitive load acceptable | Dead import + dead block in finalize + redundant read in per-task loop all add noise | PASS (backlog) |
| Deletability — could this be simpler? | Three deletions would reduce code with no behavior change | PASS (backlog) |
| Gate passes | `npm test` exit 0, all suites pass | PASS |

---

### Overall Verdict: PASS

Gate passes. No critical complexity issues block merge. The dead code in `finalize.mjs` is the highest-priority backlog item — it causes three separate readers to trace a no-op code path and wonder if board sync is wired. Assign an owner and either implement or delete.

---

### Backlog Items (🟡)

- `finalize.mjs:116` — Remove `readTrackingConfig()` call and the `if (tracking) { projMatch... }` block; it's a silent no-op that misleads readers. Either implement the board-move or delete until it's needed.
- `finalize.mjs:9` — Remove `setProjectItemStatus` from the import; it's never called in this file.
- `finalize.mjs:123,136` — Change `issuesClosed++` to `if (closeIssue(...)) issuesClosed++` at both call sites; `catch {}` is dead code since `runGh` never throws.
- `run.mjs:937–940` — Replace the inner `PROJECT.md` read with `if (projectNum) addToProject(issueNum, projectNum)`; `projectNum` is already extracted at L922–924.
- `run.mjs:1310–1316` — Add `markChecklistItemBlocked` call in the `escalationFired` path to match the `shouldEscalate()` path at L1296–1302; asymmetric exit paths produce inconsistent parent-issue state.
- `run.mjs:1085–1091` — Add parent checklist update for user-skip path; SPEC requires `- [x] title (#N) *(skipped)*`.

### Suggestions (🔵)

- `github.mjs:141,156` — Extract `replaceChecklistItem(body, title, issueNumber, replacement)` to eliminate duplicate guard/escape/regex in `tickChecklistItem` and `markChecklistItemBlocked`.
- `github.mjs:145,160` — Add `m` multiline flag and `^` anchor to regex in both checklist functions; prevents mid-line matching on pathological bodies.
