# Architect Review — task-12

## Overall Verdict: PASS (flagged)

---

## What Was Reviewed

This task added documentation-only content: a "Git Worktrees" section to `PLAYBOOK.md` (lines 182–243). No code was introduced or changed.

**Files actually opened and read:**
- `.team/features/git-worktree-isolation/tasks/task-12/handshake.json`
- `PLAYBOOK.md` lines 182–243
- `bin/lib/run.mjs` lines 153–176, 1009–1534
- `test/worktree.test.mjs` (slug and worktree tests)

---

## Per-Criterion Results

### 1. Claims vs. Evidence

| Claim (handshake) | Verified? | Evidence |
|---|---|---|
| Section added to PLAYBOOK.md | ✅ | Lines 182–243 present |
| Layout: `.team/worktrees/<slug>` with `feature/<slug>` branch | ✅ | `run.mjs:167–168` |
| Branch uses `-B` (reset on re-run) | ✅ | `run.mjs:173` |
| Preserved on failure, removed on success | ✅ | `run.mjs:1525–1534` |
| Re-run reuses existing worktree | ✅ | `run.mjs:169–172` |
| Inspection commands correct (`git worktree list`, `git -C ... status`) | ✅ | Standard git; consistent with code |
| Cleanup commands correct (`git worktree remove --force`) | ✅ | Matches `run.mjs:180` |
| `git worktree prune` for stale registrations | ✅ | Correct advice for abnormal-exit scenario |
| Slug: "non-alphanumeric characters stripped, capped at 72 chars" | ⚠️ | **Incomplete** — see finding below |

### 2. Documentation Accuracy

One factual inaccuracy found: the slug description omits dot preservation.

- **Code** (`run.mjs:159`): `.replace(/[^a-z0-9\-\.]/g, "")` — keeps alphanumeric, hyphens, **and dots**
- **Test** (`worktree.test.mjs:37–38`): explicit "allows dots" test: `slugToBranch("v1.0") === "v1.0"`
- **Docs** (`PLAYBOOK.md:199`): "non-alphanumeric characters stripped" — omits dots, which are in fact preserved

This creates a documentation gap: a user with a feature name like "v1.0" or "fix.edge.case" would expect dots stripped but they're kept, producing `feature/v1.0` instead of `feature/v10`.

### 3. Structural / Architectural Quality

The section is well-structured with four logical sub-sections (Layout, Inspect, Manual cleanup, Prune stale). Prose is accurate on the macro behavior. Commands are correct and safe (`-d` before `-D` for branch deletion is the right ordering). The tip about reuse vs. clean-slate is helpful and accurate.

No new modules, services, or system boundaries were introduced. Architecture is not affected.

---

## Findings

🟡 PLAYBOOK.md:199 — Slug description says "non-alphanumeric characters stripped" but code (`run.mjs:159`) and tests (`worktree.test.mjs:37`) confirm dots are preserved; change to "only alphanumeric characters, hyphens, and dots are kept, all other characters stripped, capped at 72 characters"

---

## Actionable Feedback

Fix `PLAYBOOK.md` line 199 to accurately reflect the slug regex. The corrected sentence:

> **Slug** — derived from the feature name: lowercased, spaces/underscores → `-`, only alphanumeric, hyphens, and dots retained (all other characters stripped), capped at 72 characters.

No other changes needed for this task.
