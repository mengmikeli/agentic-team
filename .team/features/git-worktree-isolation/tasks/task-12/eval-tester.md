# Eval — task-12 (run_2): Tester Review

**Verdict: PASS**
**Reviewer role: Test Strategist**
**Date: 2026-04-25**

---

## Files Actually Read

| File | Purpose |
|------|---------|
| `.team/features/git-worktree-isolation/tasks/task-12/handshake.json` | Builder claims and artifacts |
| `PLAYBOOK.md` lines 182–244 | Delivered documentation section |
| `test/worktree.test.mjs` lines 579–682 | New PLAYBOOK contract tests and grep-audit tests |
| `.team/features/git-worktree-isolation/tasks/task-12/eval.md` | Prior evaluations that raised findings this run was asked to fix |

---

## What Was Claimed

Builder (run_2): "Fixed two factual errors in PLAYBOOK.md: corrected the slug description to accurately state dots are retained (not stripped), and corrected the branch description to state -B is used only on initial creation and re-runs reuse the existing worktree. Added five new tests to test/worktree.test.mjs that verify PLAYBOOK.md contains the Git Worktrees section and key accurate claims. All 565 tests pass."

Artifacts:
- `{ "type": "docs", "path": "PLAYBOOK.md" }`
- `{ "type": "code", "path": "test/worktree.test.mjs" }`

---

## Per-Criterion Results

### 1. Prior inaccuracy #1 fixed: slug description

**PASS** — `PLAYBOOK.md:199` now reads:
> "only alphanumeric, hyphens, and dots retained (all other characters stripped), capped at 72 characters."

Previous eval flagged "non-alphanumeric characters stripped" as false (dots survive `slugToBranch`). Fixed. Test at `worktree.test.mjs:609–614` confirms this claim against a regex that matches `dots? retained`.

### 2. Prior inaccuracy #2 fixed: -B re-run behavior

**PASS** — `PLAYBOOK.md:200` now reads:
> "branch is created on first run with `git worktree add -B`; re-runs reuse the existing worktree and preserve all commits"

Previous eval flagged "re-running resets the branch to HEAD" as false (`existsSync` returns early before git is called). Fixed. Test at `worktree.test.mjs:615–621` confirms via regex `/re-runs? reuse/i`.

### 3. Five documentation contract tests added

**PASS** — `test/worktree.test.mjs:581–622` adds the `"PLAYBOOK.md documentation contract"` describe block with exactly five tests as claimed:

1. `contains ## Git Worktrees section` — checks heading
2. `documents git worktree list command` — checks `git worktree list`
3. `documents manual cleanup with git worktree remove` — checks `git worktree (remove|prune)`
4. `slug description accurately describes dot preservation` — checks dot-retention claim
5. `branch description accurately states re-runs reuse the existing worktree` — checks reuse claim

All five address gaps identified in the prior two tester/engineer reviews.

### 4. Test count claim

**UNVERIFIABLE (same as prior)** — No `test-output.txt` artifact. Gate output in context is truncated and shows 565 tests passing for other suites. Cannot independently verify from artifact. Prior reviewer flagged this; it remains unresolved.

---

## Coverage Gaps (remaining after this fix)

### Gap A — Test 3 uses OR instead of AND

`worktree.test.mjs:601–607` checks `git worktree (remove|prune)`. Both `git worktree remove --force` (line 225) and `git worktree prune` (line 243) are present in PLAYBOOK.md, but the test passes if *either* one is deleted. Removing the primary cleanup command (`remove --force`) would not be caught as long as `prune` remains.

### Gap B — Inspect commands have no regression protection

The task requirement states documentation should cover "how to inspect/clean up worktrees manually." The inspect commands at PLAYBOOK.md:213–215 (`git -C ... log --oneline -10`, `git -C ... status`) are present but have no corresponding test. Deleting or moving those lines would not be caught.

### Gap C — Lifetime semantics and layout diagram untested

The "preserved on failure" lifetime claim and the `.team/worktrees/<slug>` layout diagram are underpinned only by the section-header test. If the body content regresses, only the presence of `## Git Worktrees` is verified.

---

## Findings

🟡 test/worktree.test.mjs:601 — Cleanup test matches `git worktree (remove|prune)` (OR). Removing `git worktree remove --force` docs while keeping `prune` still passes; split into two separate assertions to protect both independently.

🟡 test/worktree.test.mjs:579 — No test for the `### Inspect` subsection commands (`git -C .team/worktrees/<slug> log`, `git -C .team/worktrees/<slug> status`). The task requirement explicitly includes "inspect"; half the requirement has no regression guard.

🔵 `.team/features/git-worktree-isolation/tasks/task-12/` — `test-output.txt` artifact still not produced. The "565 tests pass" claim remains unverifiable to future reviewers. Add gate output capture even for doc tasks.

---

## Summary

The two blocking inaccuracies from prior reviews are both fixed with direct evidence (correct PLAYBOOK.md text at lines 199–200, and matching tests that would fail if the fixes were reverted). The five documentation contract tests are all present and address the exact gaps raised previously. Two new warnings are flagged for the backlog: the OR-vs-AND cleanup assertion and the missing inspect command tests. Neither blocks the current merge.

**Overall: PASS**
