# Simplicity Review — task-12 (run_2)

**Reviewer role:** Simplicity (unnecessary complexity, over-engineering, cognitive load, deletability)
**Verdict:** PASS
**Date:** 2026-04-25

---

## Files actually read

- `.team/features/git-worktree-isolation/tasks/task-12/handshake.json`
- `PLAYBOOK.md` lines 182–244 (Git Worktrees section)
- `test/worktree.test.mjs` lines 579–622 (new PLAYBOOK.md documentation contract tests)
- `eval-simplicity.md` (prior run_1 review, to verify claimed fixes)

---

## Builder claims verified

| Claim | Evidence | Result |
|---|---|---|
| Slug description says dots are retained | PLAYBOOK.md:199 "only alphanumeric, hyphens, and dots retained (all other characters stripped)" | ✓ fixed |
| Branch description says re-runs reuse the existing worktree | PLAYBOOK.md:200 "re-runs reuse the existing worktree and preserve all commits" | ✓ fixed |
| Five new tests added | test/worktree.test.mjs:579–622 — `describe("PLAYBOOK.md documentation contract")` with 5 `it(...)` blocks | ✓ present |

The two 🟡 factual-error findings from the prior simplicity review (run_1) and the "zero documentation tests" gap identified by the Tester review are both addressed.

---

## Veto-category checks (🔴 = blocks merge)

| Category | Finding |
|---|---|
| Dead code | None — no code added; 5 new tests are all used |
| Premature abstraction | None — `beforeEach` reading `playbookSrc` is used in all 5 tests (≥2 call sites) |
| Unnecessary indirection | None — tests assert directly on file content via regex; no wrapper layers |
| Gold-plating | None — every subsection (Layout, Inspect, Cleanup, Prune) and every test case corresponds to a real, observable behaviour |

No 🔴 findings.

---

## Findings

🔵 test/worktree.test.mjs:583 — `beforeEach` reads `PLAYBOOK.md` once per test (5 reads total); a module-scoped `const playbookSrc = readFileSync(...)` above the `describe` block would be simpler and read the file once.

---

## Per-criterion evaluation

### Cognitive load
PASS. The four-subsection layout (Layout, Inspect, Manual cleanup, Prune) is clear and non-overlapping. Five test cases each assert exactly one factual claim. Nothing requires holding multiple abstractions in mind simultaneously.

### Deletability
PASS. The Git Worktrees section (PLAYBOOK.md:182–244) has no filler. The five new tests each guard a distinct factual claim; none duplicates assertions elsewhere in the file.

### Accuracy of key claims (spot-checked against code)

| Claim | Code reference | Status |
|---|---|---|
| Worktree at `.team/worktrees/<slug>` | run.mjs:167 `join(mainCwd, ".team", "worktrees", safeSlug)` | ✓ |
| Branch `feature/<slug>` | run.mjs:173 `["worktree", "add", …, "-B", branchName]` | ✓ |
| `-B` used only on initial creation | run.mjs:169-172 `existsSync` guard returns before `git` call on re-run | ✓ |
| Re-runs reuse existing worktree | run.mjs:169-172 early-return | ✓ |
| Preserved on failure | run.mjs:1529–1533 catch block skips `removeWorktree` | ✓ |
| Removed on clean completion | run.mjs:1534 `removeWorktree` called after try block | ✓ |
| Dots retained in slug | run.mjs:159 `/[^a-z0-9\-\.]/g` — `.` not stripped | ✓ |

---

## Summary

Both factual errors flagged by the prior simplicity review and the tester review are corrected. The five new documentation-contract tests provide regression protection for the key factual claims. No structural simplicity issues; no veto-category violations. One 🔵 suggestion: consolidate 5 `beforeEach` file reads into a single module-scoped read.
