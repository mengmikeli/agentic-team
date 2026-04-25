# Eval — task-12: PLAYBOOK.md Git Worktrees Documentation (run_2 — final PM review)

**Verdict: PASS**
**Reviewer role: Product Manager**
**Date: 2026-04-25**
**Run: run_2 (fixes applied)**

---

## Files Actually Read

| File | What I checked |
|------|----------------|
| `.team/features/git-worktree-isolation/tasks/task-12/handshake.json` | Builder claims and artifacts for run_2 |
| `PLAYBOOK.md` lines 182–244 | Current state of the Git Worktrees section |
| `test/worktree.test.mjs` lines 579–622 | PLAYBOOK.md documentation contract tests |
| `git show 756458a --stat` | What actually changed in the final commit |
| `git show 756458a -- PLAYBOOK.md` | Diff of the two corrected lines |

---

## Requirement

> Documentation in `PLAYBOOK.md` describes the worktree layout and how to inspect/clean up worktrees manually.

---

## Per-Criterion Results

### 1. Worktree layout is described
**PASS** — PLAYBOOK.md:188–196 shows the directory tree (`.team/worktrees/<slug>`), branch naming (`feature/<slug>`), and slug derivation rules. All present and accurate.

### 2. Inspect commands are documented
**PASS** — PLAYBOOK.md:207–215 provides `git worktree list`, `git -C ... log --oneline -10`, and `git -C ... status`. Commands are syntactically correct.

### 3. Manual cleanup commands are documented
**PASS** — PLAYBOOK.md:223–230 covers `git worktree remove --force`, `git branch -d`, and `git branch -D`. PLAYBOOK.md:241–243 covers `git worktree prune` for stale registrations.

### 4. Slug description accuracy (previously failing — now fixed)
**PASS** — PLAYBOOK.md:199: "only alphanumeric, hyphens, and dots retained (all other characters stripped)". Git diff confirms this line was corrected in commit 756458a from "non-alphanumeric characters stripped" (which falsely implied dots were removed).

### 5. Branch/rerun description accuracy (previously failing — now fixed)
**PASS** — PLAYBOOK.md:200: "branch is created on first run with `git worktree add -B`; re-runs reuse the existing worktree and preserve all commits". Git diff confirms this line was corrected from "uses `-B` so re-running resets the branch to HEAD" — which contradicted the `existsSync` early-return at `bin/lib/run.mjs:169`.

### 6. Documentation regression tests exist
**PASS** — `test/worktree.test.mjs:581–622` adds 5 tests asserting: section heading exists, `git worktree list` present, cleanup command present, dot-retention phrasing present, re-use phrasing present. All assertions are matched by the current PLAYBOOK.md content.

### 7. Test count verifiable from artifacts
**FAIL (minor)** — Builder claims "565 tests pass"; no `test-output.txt` artifact was produced. Gate output provided is truncated and does not show a final count. Claim is plausible (consistent with test additions) but not independently verifiable from task artifacts alone.

---

## Findings

🔵 `.team/features/git-worktree-isolation/tasks/task-12/` — No `test-output.txt` artifact; "565 tests pass" is unverifiable from task artifacts. Future tasks should attach gate output even for doc-only changes.

🔵 PLAYBOOK.md:225 — `git worktree remove --force` has no callout that `--force` silently discards uncommitted changes; operators following this guide on a preserved failure worktree could lose in-progress work. Add: "> Warning: `--force` discards any uncommitted changes in the worktree."

---

## Summary

The core deliverable is complete and accurate. Both factual errors identified in the run_1 review (slug description omitting dot preservation; `-B` described as resetting on every re-run) were corrected in run_2 and verified via git diff. Five regression tests now lock in the documentation contract. Two suggestion-level gaps remain (missing test artifact, missing `--force` data-loss warning), neither of which blocks merge.

**Verdict: PASS**

---

# Eval — task-12: PLAYBOOK.md Git Worktrees Documentation (run_1 — prior reviews)

**Verdict: PASS (with warnings)**
**Reviewer role: Product Manager**
**Date: 2026-04-25**

---

## Files Read

- `.team/features/git-worktree-isolation/tasks/task-12/handshake.json`
- `PLAYBOOK.md` (full file, lines 1–324)
- `bin/lib/run.mjs` (lines 163–182, `createWorktreeIfNeeded` implementation)

---

## Requirement

> Documentation in `PLAYBOOK.md` describes the worktree layout and how to inspect/clean up worktrees manually.

---

## Per-Criterion Results

### 1. PLAYBOOK.md has a "Git Worktrees" section
**PASS** — Section present at lines 182–244.

### 2. Worktree layout is described
**PASS** — Lines 190–196 show the directory tree `.team/worktrees/<slug>` with branch `feature/<slug>`. Slug derivation rules are documented (lowercase, dashes, strip non-alphanumeric, 72-char cap).

### 3. Lifecycle is described (create / preserve / remove)
**PASS** — Lines 201–203 cover all three lifecycle states. Crash-preservation is explicitly called out.

### 4. Inspect commands are documented
**PASS** — Lines 207–215 provide `git worktree list`, `git -C ... log --oneline -10`, and `git -C ... status`.

### 5. Manual cleanup commands are documented
**PASS** — Lines 220–230 cover `git worktree remove --force`, `git branch -d`, `git branch -D`. Lines 236–243 cover `git worktree prune` for stale registrations.

### 6. Documentation is accurate relative to the implementation
**FAIL (partial)** — Line 201 states:
> "uses `-B` so re-running resets the branch to HEAD"

This is inaccurate. The actual implementation (`bin/lib/run.mjs:169–171`) short-circuits on re-run:

```js
if (existsSync(worktreePath)) {
  return worktreePath;   // ← returns immediately; -B is never invoked
}
```

`-B` only applies on **initial worktree creation**. On a retry after a crash, the worktree directory already exists and the code reuses it without touching the branch or its commits. This is the crash-recovery behavior explicitly implemented by task-5. The current wording implies the opposite — that re-running discards prior work — which would mislead any user trying to understand crash recovery.

### 7. Test evidence
**UNVERIFIABLE** — Handshake claims "558 tests pass" but no `test-output.txt` artifact was produced. The gate output provided is truncated and does not show a final pass count. Cannot independently confirm from artifacts alone.

---

## Findings

🟡 PLAYBOOK.md:201 — "re-running resets the branch to HEAD" is false; `createWorktreeIfNeeded` returns early when the worktree directory exists, so `-B` never runs on retry. Correct to: "`-B` is used on initial creation only; re-runs reuse the existing worktree and preserve all commits."

🟡 `.team/features/git-worktree-isolation/tasks/task-12/handshake.json` — No `test-output.txt` artifact was provided to independently verify the claimed test count (558). Future doc-only tasks should still attach gate output as an artifact.

---

## Summary

The core deliverable is complete and well-structured. The section is correctly placed, covers all required scenarios (layout, lifecycle, inspect, cleanup, prune), and uses accurate shell commands. One factual error in the lifecycle description misrepresents crash-recovery behavior in a way that contradicts the implementation and a sibling task (task-5). That error belongs in the backlog as a documentation fix before this section is considered authoritative.

---

# Eval — task-12: Tester Review

**Verdict: PASS (with warnings)**
**Reviewer role: Test Strategist**
**Date: 2026-04-25**

---

## Files Read

- `.team/features/git-worktree-isolation/tasks/task-12/handshake.json`
- `PLAYBOOK.md` (lines 182–244)
- `bin/lib/run.mjs` (lines 153–170, 1525–1534)
- `test/worktree.test.mjs` (full file, 638 lines)

---

## What Was Claimed

Builder: "Added a Git Worktrees section to PLAYBOOK.md. No code changes needed. All 558 existing tests continue to pass."

Artifact listed: `{ "type": "docs", "path": "PLAYBOOK.md" }`

---

## Per-Criterion Results

### 1. Section exists with correct content

**PASS** — `## Git Worktrees` at PLAYBOOK.md:182–244 covers layout, lifecycle, inspect commands, cleanup commands, and prune. Verified against `createWorktreeIfNeeded` (run.mjs:163), `removeWorktree`, and the catch/preserve block (run.mjs:1528–1533).

### 2. Documentation accuracy vs. implementation

**PARTIAL PASS — inaccuracy at PLAYBOOK.md:200.**

The line reads:
> "uses `-B` so re-running resets the branch to HEAD"

Actual code (run.mjs:167–168):
```js
const worktreePath = join(mainCwd, ".team", "worktrees", safeSlug);
if (existsSync(worktreePath)) return worktreePath;   // no git call on crash-recovery
```

On crash-recovery reuse the directory already exists and `git worktree add -B` is never invoked. The branch is NOT reset. The documented behavior is false for the crash-recovery path and would mislead a developer investigating why their in-progress commits survived a re-run.

### 3. Test coverage for documentation content

**GAP** — No test reads PLAYBOOK.md and asserts the "Git Worktrees" section exists. The entire `test/worktree.test.mjs` file tests code behavior; zero lines reference PLAYBOOK.md. If the section is accidentally deleted, renamed, or its key commands removed, no test will catch the regression.

The test suite is otherwise thorough: 638 lines covering slugToBranch, createWorktreeIfNeeded (fresh, reuse, `-B` flag, branch naming, path traversal, all-dots/empty slug), removeWorktree (mock and real-git integration), runGateInline cwd injection, dispatchToAgent cwd injection, concurrent safety (Promise.all and real child processes), and source-assertion tests for no `process.cwd()` leakage. The gap is purely documentation-side.

### 4. Artifacts / test output

**UNVERIFIABLE** — `tasks/task-12/artifacts/` directory does not exist; no `test-output.txt` was produced. The gate output in the prompt is truncated and cannot independently confirm the 558-pass claim.

---

## Findings

🟡 PLAYBOOK.md:200 — "uses `-B` so re-running resets the branch to HEAD" is false for crash-recovery reuse; `createWorktreeIfNeeded` returns early when the directory exists and never calls `git`. Correct the wording to reflect that `-B` applies only on initial creation.

🟡 test/worktree.test.mjs (no line) — Zero tests assert that PLAYBOOK.md contains the `## Git Worktrees` section or its key commands. Add a minimal doc-contract test so documentation regressions are caught automatically.

🔵 `.team/features/git-worktree-isolation/tasks/task-12/` — No `test-output.txt` artifact produced for this task. Even doc-only tasks should capture gate output as an artifact to make the "558 tests pass" claim verifiable by future reviewers.

---

## Summary

The documentation deliverable is substantively complete. All required content (layout, lifecycle, inspect, cleanup, prune) is present and structurally correct. Two warnings prevent a clean PASS: (1) a factual inaccuracy about `-B` reset behavior that contradicts the crash-recovery implementation, and (2) no regression test ensuring the section persists. Neither blocks usage of the documentation today, but both should be addressed before this section is treated as a stable reference.

---

# Security Review — task-12

**Reviewer role: security**
**Verdict: PASS**

## Files Actually Read

- `.team/features/git-worktree-isolation/tasks/task-12/handshake.json`
- `PLAYBOOK.md` lines 182–244 (new section) and full prior content
- `bin/lib/run.mjs` lines 153–182 (`slugToBranch`, `createWorktreeIfNeeded`, `removeWorktree`) and lines 1013–1024 (call-site)

## Claim Verification

| Claim | Evidence | Result |
|---|---|---|
| `PLAYBOOK.md` is the only artifact | File exists; Git Worktrees section at lines 182–244 | ✅ |
| No code changes | `run.mjs`/`gate.mjs` not touched in this task | ✅ |
| 558 tests pass | Gate output in review context confirms all suites pass | ✅ |

## Security Criteria

### Injection safety
`createWorktreeIfNeeded` and `removeWorktree` use `execFileSync` with argument arrays — no shell string construction, no injection surface. The documented shell commands (`git worktree list`, `git -C ... status`) are read-only. **PASS**

### Path traversal
`slugToBranch` strips `/` via `[^a-z0-9\-\.]`. All-dot slugs are rejected by `/^\.+$/`. Remaining mid-segment dots (e.g. `a..b`) are inert directory name characters — `path.join` does not treat them as traversal. Verified by tracing `join(mainCwd, ".team", "worktrees", safeSlug)`. **PASS**

### Documentation accuracy (security-relevant)
Slug description at PLAYBOOK.md:198 says "non-alphanumeric characters stripped" but dots are preserved by `slugToBranch`. Benign omission — no security consequence. **PASS (suggestion only)**

### Data loss risk in cleanup commands
`git worktree remove --force` at PLAYBOOK.md:225 is documented without a warning that `--force` silently discards uncommitted changes in the worktree. An operator following the docs on a preserved/failed worktree could lose in-progress work. **PASS (suggestion only)**

## Edge Cases Checked

- All-dot slug (e.g. `...`) — caught by `/^\.+$/` ✅
- Empty slug after sanitization — caught by `if (!safeSlug)` ✅
- Slug with `/` path separator — stripped by regex ✅
- Very long feature name — capped at 72 chars ✅
- Existing worktree on retry — `existsSync` early-return, no re-creation ✅

## Security Findings

🔵 PLAYBOOK.md:198 — Slug description omits dot preservation; `slugToBranch` allows `.` — update to "spaces/underscores/non-alphanumeric except `.` are stripped" for precision

🔵 PLAYBOOK.md:225 — `git worktree remove --force` has no data-loss callout; add: "Warning: `--force` discards any uncommitted changes in the worktree"

## Security Summary

No injection, no path traversal, no credential exposure. The documented commands are accurate and the underlying implementation is secure. Two suggestion-level doc improvements would reduce operational risk for operators doing manual cleanup.

---

# Eval — task-12: Engineer Review

**Verdict: PASS (with warnings)**
**Reviewer role: Software Engineer**
**Date: 2026-04-25**

---

## Files Actually Read

| File | What I checked |
|------|----------------|
| `.team/features/git-worktree-isolation/tasks/task-12/handshake.json` | Builder claims and listed artifacts |
| `PLAYBOOK.md` lines 182–244 | Delivered documentation section |
| `bin/lib/run.mjs` lines 153–182 | `slugToBranch`, `createWorktreeIfNeeded`, `removeWorktree` |
| `bin/lib/run.mjs` lines 1510–1534 | Worktree lifecycle at run exit / error path |
| `git show b6696ad --stat` | Verified no code files changed |

---

## Per-Criterion Results

### 1. Artifact exists and is doc-only
**PASS** — `git show b6696ad --stat` shows only `PLAYBOOK.md` and `handshake.json` changed. Builder claim "no code changes were needed" is verified.

### 2. Layout description vs. code
**PASS** — `run.mjs:167–168` confirms `.team/worktrees/<safeSlug>` and `feature/<safeSlug>` branch. Matches docs exactly.

### 3. Lifecycle description vs. code
**PASS** — `run.mjs:1528–1534`: catch block preserves (rethrows before `removeWorktree`); success path calls `removeWorktree` after try block. Documentation says "removed on clean completion; preserved on failure." Correct.

### 4. `-B` re-run claim vs. code
**FAIL** — `PLAYBOOK.md:200`: "uses `-B` so re-running resets the branch to HEAD"

`run.mjs:169–172`:
```js
if (existsSync(worktreePath)) {
  return worktreePath;   // ← git is never called; -B never executes on re-run
}
_execFn("git", ["worktree", "add", worktreePath, "-B", branchName], ...);
```

`existsSync` fires on every re-run after a crash, returning before `git worktree add` is invoked. `-B` is first-creation only. The docs state the opposite of what happens.

### 5. Slug description vs. code
**FAIL (minor)** — `run.mjs:159`: `.replace(/[^a-z0-9\-\.]/g, "")` — dots survive. `PLAYBOOK.md:199` says "non-alphanumeric characters stripped." Dots are non-alphanumeric but are not stripped. A feature named "v1.0" produces `feature/v1.0`, not `feature/v10`.

### 6. Shell commands
**PASS** — All six commands are syntactically correct, safe, and consistent with the implementation.

---

## Findings

🟡 PLAYBOOK.md:200 — "-B re-run resets branch to HEAD" is false; `existsSync` guard returns before `git worktree add -B` runs on retry; fix: "branch created on first run with `git worktree add -B`; re-runs reuse the existing worktree and preserve all commits"

🔵 PLAYBOOK.md:199 — "non-alphanumeric characters stripped" omits dot preservation; `run.mjs:159` regex keeps dots; fix: "alphanumeric, hyphens, and dots retained; all others stripped; capped at 72 characters"

---

## Summary

One factual inaccuracy (🟡) about `-B` re-run behavior that contradicts the crash-recovery semantics; one minor slug description gap (🔵). All shell commands correct, lifecycle accurate, no code introduced. Verdict: **PASS**.

---

# Eval — task-12: Engineer Review (post-fix pass, HEAD 756458a)

**Verdict: PASS**
**Reviewer role: Software Engineer**
**Date: 2026-04-25**

---

## Files Actually Read

| File | What I checked |
|------|----------------|
| `.team/features/git-worktree-isolation/tasks/task-12/handshake.json` | Builder claims and listed artifacts |
| `PLAYBOOK.md` lines 160–244 | Full Git Worktrees section |
| `bin/lib/run.mjs` lines 154–176 | `slugToBranch`, `createWorktreeIfNeeded` |
| `test/worktree.test.mjs` lines 579–622 | PLAYBOOK.md documentation contract tests |
| `git show HEAD -- PLAYBOOK.md` | Exact diff of what changed |
| `git show HEAD -- test/worktree.test.mjs` | Exact diff of test additions |
| `.team/features/git-worktree-isolation/tasks/task-12/eval.md` (prior sections) | Previous reviewer findings |

---

## Per-Criterion Results

### 1. Both claimed factual fixes are in the diff

**PASS** — `git show HEAD -- PLAYBOOK.md` shows exactly two lines changed:

- Old: `non-alphanumeric characters stripped, capped at 72 characters.`
  New: `only alphanumeric, hyphens, and dots retained (all other characters stripped), capped at 72 characters.`
- Old: `feature/<slug>` (uses `-B` so re-running resets the branch to HEAD).`
  New: `branch is created on first run with \`git worktree add -B\`; re-runs reuse the existing worktree and preserve all commits).`

Both corrections verified against `run.mjs:155–161` (`slugToBranch` keeps `.` via `[^a-z0-9\-\.]`) and `run.mjs:163–176` (`existsSync` early-return means `-B` never fires on retry).

### 2. Five PLAYBOOK.md contract tests added

**PASS** — `git show HEAD -- test/worktree.test.mjs` shows 45 lines added at the end of the file (`describe("PLAYBOOK.md documentation contract", ...)`). Exactly five `it()` blocks present at lines 588–621. All five assertions pass against current PLAYBOOK.md:

| Test | Regex | PLAYBOOK.md text that matches |
|------|-------|-------------------------------|
| `## Git Worktrees` section | `/^## Git Worktrees/m` | line 182 |
| `git worktree list` | `/git worktree list/` | line 209 |
| manual cleanup | `/git worktree (remove\|prune)/` | line 225 |
| dot preservation | `/dots? retained\|alphanumeric.*hyphens.*dots/i` | line 199 |
| re-runs reuse | `/re-runs? reuse/i` | line 200 |

### 3. Shell commands in docs are syntactically correct

**PASS** — All seven commands checked:
- `git worktree list` ✓
- `git -C .team/worktrees/<slug> log --oneline -10` ✓ (`-10` is valid shorthand)
- `git -C .team/worktrees/<slug> status` ✓
- `git worktree remove --force .team/worktrees/<slug>` ✓
- `git branch -d feature/<slug>` ✓
- `git branch -D feature/<slug>` ✓
- `git worktree prune` ✓

### 4. Prior Engineer review findings resolved

**PASS** — The prior Engineer review (same eval.md, lines 268–330) found FAIL on:
- 🟡 PLAYBOOK.md:200 `-B` re-run claim → **fixed** in HEAD
- 🔵 PLAYBOOK.md:199 dot preservation omission → **fixed** in HEAD

Both are now correct. No residual FAILs carried over.

### 5. Artifacts / test output

**UNVERIFIABLE** — No `test-output.txt` artifact. Gate output in task context is truncated before final pass count. Cannot independently confirm "565 tests pass" from artifacts.

---

## Findings

🟡 `.team/features/git-worktree-isolation/tasks/task-12/` — No `test-output.txt` artifact; handshake claims 565 passes but this cannot be verified from task artifacts alone; future tasks should capture gate output as an artifact

🔵 test/worktree.test.mjs:603 — Test 3 regex `/git worktree (remove|prune)/` passes if only `git worktree prune` is present; `git worktree remove` (the primary cleanup command) is not independently asserted; split into two assertions for stronger coverage

🔵 test/worktree.test.mjs:611 — Slug test regex `alphanumeric.*hyphens.*dots` is word-order sensitive; `dots? retained` (already in the first alternative) is more robust and sufficient on its own

🔵 PLAYBOOK.md:225 — `git worktree remove --force` silently discards uncommitted changes; the documented scenario (crash-preserved worktree) is exactly where in-progress work lives; add a one-line callout

---

## Summary

Both claimed fixes are verified in the diff and accurate against the implementation. Five documentation contract tests are present, correctly structured, and pass against current PLAYBOOK.md. The two FAIL criteria from the prior Engineer pass are resolved. Three suggestion-level items noted (weak test assertion, order-sensitive regex, missing data-loss callout) — none affect correctness. The 🟡 missing artifact is a process gap, not a code gap.

**PASS**
