# Simplicity Review — task-12

**Reviewer role:** Simplicity (unnecessary complexity, over-engineering, cognitive load, deletability)
**Verdict:** PASS

---

## Files read

- `.team/features/git-worktree-isolation/tasks/task-12/handshake.json`
- `PLAYBOOK.md` (lines 182–244, the new Git Worktrees section)
- `bin/lib/run.mjs` (lines 153–182, `createWorktreeIfNeeded` / `removeWorktree`)

---

## Veto-category checks (🔴 = blocks merge)

| Category | Finding |
|---|---|
| Dead code | N/A — documentation only, no code added |
| Premature abstraction | N/A — no abstractions introduced |
| Unnecessary indirection | N/A — no indirection introduced |
| Gold-plating | No: every subsection (Layout, Inspect, Cleanup, Prune) describes real, observable behaviour backed by code |

No 🔴 findings.

---

## Findings

🟡 PLAYBOOK.md:200 — "uses `-B` so re-running resets the branch to HEAD" is misleading. The code (`createWorktreeIfNeeded`, run.mjs:169-172) returns early and reuses the existing worktree when the path already exists — the `-B` flag is never exercised in the crash-recovery re-run scenario described just two lines later. The `-B` only applies when creating a fresh worktree whose branch name already exists (e.g., after manual `git worktree remove` without `git branch -D`). Suggested fix: rephrase to "uses `-B` so initial creation resets an existing `feature/<slug>` branch to HEAD rather than failing" and drop the "re-running" framing which implies the preserved-worktree case gets reset.

---

## Per-criterion evaluation

### Cognitive load
PASS. The section is logically divided into four focused subsections. No unnecessary cross-references or conceptual overhead. A developer unfamiliar with `git worktree` can follow it.

### Deletability
PASS. All four subsections earn their keep:
- **Layout** — necessary to understand where files land
- **Inspect** — the three commands are distinct and non-overlapping
- **Manual cleanup** — two commands with clearly different safety profiles (`-d` vs `-D`) documented inline
- **Prune** — a distinct operation (metadata only, no `--force`) that belongs separate from file removal

### Accuracy of claims (spot-checked against code)

| Claim | Evidence | Status |
|---|---|---|
| Worktree at `.team/worktrees/<slug>` | run.mjs:167 | ✓ |
| Branch `feature/<slug>` | run.mjs:168, 173 | ✓ |
| Preserved on failure | run.mjs:1529-1530 | ✓ |
| Removed on clean completion | run.mjs:1534 | ✓ |
| Reuses existing worktree on re-invocation | run.mjs:169-172 | ✓ |
| "uses -B so re-running resets branch to HEAD" | run.mjs:169-173 — **contradicted**: `-B` path is skipped when worktree exists | 🟡 inaccurate |

---

## Summary

One warning: the `-B` note on line 200 incorrectly implies that re-running a preserved worktree resets the branch. The code does the opposite — it returns the preserved path untouched. This is a factual inaccuracy that could mislead a developer managing a crash-recovery worktree into thinking their partial work will be clobbered. Recommend a one-line copy fix before merge (or immediately after, as it does not affect runtime behaviour).

No structural simplicity issues. The section is appropriately lean.
