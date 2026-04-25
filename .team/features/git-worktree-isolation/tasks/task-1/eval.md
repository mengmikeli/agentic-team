# Simplicity Review — task-1: createWorktreeIfNeeded

## Verdict: PASS

## Files Read
- `bin/lib/run.mjs` (lines 140–200, plus grep for call sites at 1013, 1520)
- `test/worktree.test.mjs` (full)
- `.team/features/git-worktree-isolation/tasks/task-1/handshake.json`

## Per-Criterion Results

### 1. Dead code — PASS
- `slugToBranch`, `createWorktreeIfNeeded`, `removeWorktree` all have real call sites in `bin/lib/run.mjs` (1013, 1520) plus tests.
- No commented-out code, no unreachable branches.

### 2. Premature abstraction — PASS
- `_execFn` injection parameter looks like DI-for-testing, but is genuinely exercised by mock-based tests in `test/worktree.test.mjs`. Two real consumers (production `execFileSync` + test mocks) — qualifies as 2 call sites.
- `slugToBranch` is extracted as its own function and used both internally and as a public test target — justified.

### 3. Unnecessary indirection — PASS
- `createWorktreeIfNeeded` is ~10 lines, no wrapper-without-transformation. It does compute, log, exec, return.
- `removeWorktree` is a 3-line try/catch around one git invocation — thin but adds the swallow-errors semantic, which is real value.

### 4. Gold-plating — PASS
- No config options, no feature flags, no speculative extensibility hooks.
- `_execFn` default arg is the only injection seam, and it's used.

## Evidence of Correctness
- Logic path verified: `existsSync(worktreePath)` → reuse; else `git worktree add <path> -B feature/<slug>` via `execFileSync`. Returns the joined path either way.
- The path is "absolute" only insofar as `mainCwd` is absolute — the function does not enforce absoluteness. Call site at 1013 passes `mainCwd` from process state; tests use `tmpdir()` which is absolute. Acceptable; not a simplicity concern.
- Test output in gate shows full suite runs under `--test-concurrency=1` and is progressing through worktree-related tests without failure (truncated mid-run, but no failures shown).

## Minor Observations (non-blocking)
- The two test cases "uses -B flag (not -b)" and "calls git worktree add with -B when directory absent but branch may exist" check substantially the same invariant. Mild duplication.
- The `slugToBranch normalization` describe block re-tests `slugToBranch` behavior already covered in the first describe, just with a `feature/` prefix concatenation. Mild duplication.

Neither rises to a 🟡 — they're test thoroughness, not production complexity.

## Findings

No findings.

---

# PM Review — task-1: createWorktreeIfNeeded

## Verdict: PASS

## Spec
> `createWorktreeIfNeeded(slug, mainCwd)` returns an absolute path under `.team/worktrees/<slug>` and creates branch `feature/<sanitized-slug>` if the path does not exist.

## Files Read
- `.team/features/git-worktree-isolation/tasks/task-1/handshake.json`
- `bin/lib/run.mjs:140-202`
- `test/worktree.test.mjs` (full)

## Per-Criterion Results

### 1. Returns path under `.team/worktrees/<slug>` — PASS
`run.mjs:163` — `join(mainCwd, ".team", "worktrees", slug)`. Asserted by `worktree.test.mjs:84-91`. Absoluteness is delegated to caller (mainCwd contract); acceptable.

### 2. Creates branch `feature/<sanitized-slug>` when path absent — PASS
`run.mjs:164,169` builds `feature/` + `slugToBranch(slug)` and runs `git worktree add … -B <branch>`. Sanitization rules (lowercase, `[\s_]+→-`, strip non-`[a-z0-9.-]`, cap 72) tested at `worktree.test.mjs:14-39`. Branch wiring tested at `:121-130` (input `my_slug` → `feature/my-slug`).

### 3. Reuses path when present — PASS
`run.mjs:165-168` short-circuits via `existsSync`. `worktree.test.mjs:70-82` confirms no git invocation on reuse — important for crash recovery.

### 4. Re-run resilience — PASS
`-B` (force-reset branch) chosen over `-b`. Explicitly defended in `worktree.test.mjs:93-102` and `:104-119`. Real failure mode addressed.

### 5. Gate / tests pass — PASS
Handshake claims 539/0. Visible gate output shows green across CLI/audit/brainstorm/run-flow tests; suite was running under `--test-concurrency=1` without any fail markers in the captured tail.

## Scope Discipline
Implementation is tightly scoped to the spec. No extra config, flags, or speculative behavior. `removeWorktree` and `dispatchToAgent`/`runGateInline` cwd-injection tests reference pre-existing code — not scope creep for this task.

## Findings

No findings.

---

# Engineer Review — task-1: createWorktreeIfNeeded

## Verdict: PASS (with backlog items)

## Files reviewed
- `bin/lib/run.mjs` (lines 152–178)
- `test/worktree.test.mjs` (full, 278 lines)
- `.team/features/git-worktree-isolation/tasks/task-1/handshake.json`

## Verification
Re-ran `node --test test/worktree.test.mjs` locally → **25 pass / 0 fail**. Matches gate output. No `artifacts/test-output.txt` was written by the builder — had to re-run to verify.

## Per-criterion

### Correctness — PASS
- `run.mjs:163` computes `join(mainCwd, ".team", "worktrees", slug)`. Absolute when `mainCwd` is absolute (the contract via `findRepoRoot()`). Verified by tests at lines 61–62, 86–90.
- Reuse path at `run.mjs:165–168`: `existsSync` short-circuits before git invocation. Test line 70 asserts zero exec calls.
- Create path at `run.mjs:169`: `git worktree add <path> -B feature/<sanitized>`. `-B` correctly handles the re-run case where the branch persists after the directory is removed. Tests 93–119 guard against `-b` regression.
- `slugToBranch` (154–160): lowercase → spaces/underscores→`-` → strip non-`[a-z0-9.-]` → cap 72. Six unit tests cover the transformations.

### Code quality — PASS
- Clear naming, single-purpose functions, ~10 LOC for the main helper.
- `_execFn` DI seam is genuinely exercised by tests.

### Error handling — PASS with caveats
- Git invocation errors propagate from `execFileSync` — appropriate, but undocumented.
- `existsSync` reuse-check does not verify the directory is a real git worktree. A stale/manually-created directory is silently treated as valid.

### Performance — PASS
- One `existsSync` + at most one git invocation. No issues.

### Edge cases checked
- Empty/all-special slug → `slugToBranch("@@@") === ""` → branch `feature/` which git rejects. Not exercised; would surface as a thrown `execFileSync` error.
- Trailing `.` in slug — git rejects refs ending in `.`. Not exercised.

## Findings

🟡 bin/lib/run.mjs:165 — `existsSync` does not verify the path is an actual git worktree; a stale or manually-created directory will be silently reused. Consider `git worktree list --porcelain` or a `.git` file check before short-circuiting. (Backlog.)
🟡 bin/lib/run.mjs:154 — `slugToBranch` can produce `""` or names with trailing `.`/`-`, which git rejects when prefixed with `feature/`. Add an empty-guard and post-trim. (Backlog.)
🔵 bin/lib/run.mjs:163 — Spec specifies "absolute path"; function relies on the caller. Consider `path.resolve(mainCwd, ...)` to make the contract self-enforcing.
🔵 .team/features/git-worktree-isolation/tasks/task-1/ — Builder did not emit `artifacts/test-output.txt`; reviewers had to re-run tests to audit.

## Summary
Correct, well-tested, matches spec. Two robustness gaps for backlog. No critical issues.

---

# Security Review — task-1: createWorktreeIfNeeded

## Verdict: PASS (with backlog items)

Contract is met. No critical security defect. One 🟡 should land in backlog for defense-in-depth.

## Files Read
- `bin/lib/run.mjs:152-178` (helpers) and `:1006-1017` (call site)
- `test/worktree.test.mjs` (full)
- `.team/features/git-worktree-isolation/tasks/task-1/handshake.json`

## Per-Criterion Results

### Command injection — SAFE
`execFileSync` is called with an argv array (`run.mjs:169`, `:176`), not a shell string. Malicious slug characters cannot inject shell metacharacters.

### Path traversal via `slug` — WARNING
`run.mjs:163` does `join(mainCwd, ".team", "worktrees", slug)` with the **raw** slug. The branch name is sanitized via `slugToBranch`, but the directory path is not. A slug containing `..` or `/` resolves through `.team/worktrees/` and creates the worktree elsewhere on disk. Current call site (`run.mjs:1013`) passes `featureName` from CLI — the user is "attacking themselves," so impact is limited, but defense-in-depth is essentially free.

### Argument-as-flag confusion — SAFE
`worktreePath` is absolute (joined with `mainCwd`), so git won't treat it as a flag. Branch always carries the `feature/` prefix.

### Branch ref edge cases — LOW
`slugToBranch` permits `..`, leading/trailing `.-`. Git refuses such refs, so this surfaces as a git error from `worktree add`. Functional but UX-rough.

### Error handling — PASS
`removeWorktree` swallows by design (already-gone path). Create-path errors bubble to `run.mjs:1015-1017` and are rewrapped. Tests `worktree.test.mjs:136-140,162-165` cover the swallow.

### Secrets / authz / external input
None handled in this code. Out of scope.

## Findings

🟡 bin/lib/run.mjs:163 — `worktreePath` uses unsanitized `slug`; a slug with `..` or `/` escapes `.team/worktrees/`. Validate slug (e.g. `/^[a-z0-9][a-z0-9._-]*$/i`) or sanitize before `join`.
🔵 bin/lib/run.mjs:154-160 — `slugToBranch` permits `..` and leading/trailing `.-` which git rejects as a ref. Trim/collapse for clearer behavior.
🔵 .team/features/git-worktree-isolation/tasks/task-1/ — Handshake cites a 539/0 test run but no `artifacts/test-output.txt` was saved. Capture it so reviewers can verify without re-running.
---

# Architect Review — task-1: createWorktreeIfNeeded

## Verdict: PASS (with backlog warnings)

## Files Read
- `bin/lib/run.mjs` (L130–180)
- `test/worktree.test.mjs` (full)
- `.team/features/git-worktree-isolation/tasks/task-1/handshake.json`

## Verification of Builder Claims
| Claim | Evidence | Result |
|---|---|---|
| Implemented at `bin/lib/run.mjs:162-172` | Confirmed | ✓ |
| Returns `.team/worktrees/<slug>` | `join(mainCwd, ".team", "worktrees", slug)` L163 | ✓ |
| Reuses existing dir | `existsSync` short-circuit L165–168 | ✓ |
| Branch `feature/<sanitized-slug>` via `-B` | L164 + L169 | ✓ |
| 539 pass / 0 fail | Re-ran `npm test`: 541 tests, 539 pass, 0 fail, 2 skipped | ✓ |

## Per-Criterion Results

**System design / boundaries — PASS.** Single-purpose helper; sibling to `removeWorktree`. `_execFn` DI seam keeps the helper unit-testable. Caller owns lifecycle.

**Dependencies — PASS.** No new packages; only stdlib (`execFileSync`, `existsSync`, `join`).

**Scalability — PASS for v1.** O(1) shell-out; no shared state.

**Patterns — PASS.** Matches existing `run.mjs` helpers (DI exec, `c.dim`/`c.green`, `stdio: "pipe"`).

## Findings

🟡 bin/lib/run.mjs:163 — Path segment uses raw `slug`; only the branch name is sanitized via `slugToBranch`. A slug containing `..` or `/` would escape `.team/worktrees/`. Reuse `slugToBranch(slug)` for the directory segment OR validate at the call boundary against `/^[a-z0-9._-]+$/`. (Independently flagged by Security review — concur.)
🟡 bin/lib/run.mjs:162 — Spec says "returns an absolute path"; result inherits absoluteness from `mainCwd`. Wrap in `path.resolve(...)` or assert `isAbsolute(mainCwd)` to make the contract self-enforcing.
🔵 bin/lib/run.mjs:166,170 — `console.log` inside the helper couples I/O with logic. Consider returning `{ path, created }` and letting the caller log.
🔵 bin/lib/run.mjs:169 — Wrap `execFileSync` in a try/catch to surface a friendlier "Failed to create worktree at X: …" message.
🔵 test/worktree.test.mjs:55 — All happy-path tests use a mock exec; one e2e against a real tmp git repo would catch regressions in the actual git invocation.

## Edge Cases Checked
- Spaces/underscores in slug → branch normalized (test L19–25). ✓
- Slug > 72 chars → capped (test L31–34). ✓
- Existing dir → no exec, returns path (test L70–82). ✓
- Re-run after dir cleared but branch retained → `-B` resets (test L93–119). ✓
- Slug containing `../` → **NOT covered**; would escape (see 🟡).
- Relative `mainCwd` → not covered; result would be relative (see 🟡).

## Recommendation
Merge. File the two 🟡 items in the backlog before this helper is wired to user-supplied feature names in production flows.
