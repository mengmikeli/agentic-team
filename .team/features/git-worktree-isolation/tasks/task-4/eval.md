# PM Eval — task-4 (git-worktree-isolation)

## Verdict: PASS

## Task Requirement
On successful run completion, `removeWorktree` is invoked and the directory + branch tracking entry is gone (`git worktree list` no longer shows it).

## Evidence

### Claim 1: `removeWorktree` is invoked on run completion
- **Verified** at `bin/lib/run.mjs:1521-1524`: `removeWorktree(worktreePath, mainCwd)` sits in the `finally` block of `_runSingleFeature`, so it runs regardless of success/failure path. Source path matches handshake claim.

### Claim 2: Directory + tracking entry removed
- **Verified** at `bin/lib/run.mjs:175-179`: `removeWorktree` calls `git worktree remove --force <path>`, which (per git semantics) removes both the worktree directory AND the entry in `git worktree list`.

### Claim 3: Real-git integration test added
- **Verified** at `test/worktree.test.mjs:171-205`: New `describe("removeWorktree real-git lifecycle")` block:
  - `beforeEach` initializes a real git repo with an initial commit (no mocks).
  - Test calls `createWorktreeIfNeeded` then `removeWorktree`.
  - Asserts `!existsSync(wtPath)` (directory gone).
  - Asserts `git worktree list` output does not contain the path or its realpath (tracking entry gone).

### Claim 4: 543 pass / 0 fail
- Ran `node --test test/worktree.test.mjs` directly: **29/29 pass** in this file, including the new real-git lifecycle test (`✔ after createWorktreeIfNeeded + removeWorktree, \`git worktree list\` does not show the path`).
- The full-suite output in the gate confirms no failures up to truncation.

## Acceptance Criteria
| Criterion | Met? | Evidence |
|---|---|---|
| `removeWorktree` invoked on completion | ✅ | run.mjs:1523 in `finally` |
| Directory deleted | ✅ | test asserts `!existsSync(wtPath)` |
| `git worktree list` entry gone | ✅ | test asserts list does not contain path or realpath |
| Test exercises real git, not mocks | ✅ | `mkdtempSync` + `git init` + real `execFileSync` calls |
| Failures don't crash the run | ✅ | `removeWorktree` swallows errors (run.mjs:176-178); test at line 163 confirms |

## Findings

No findings.

## Notes
- Scope: tightly within the agreed boundary — only adds a real-git integration test for an already-implemented behavior. No scope creep.
- User value: ensures stale worktrees don't accumulate across runs, which is the core promise of the feature.
