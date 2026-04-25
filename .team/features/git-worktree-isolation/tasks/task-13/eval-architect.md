# Architect Review — task-13 (git-worktree-isolation)

## Overall Verdict: PASS

---

## Files Actually Opened and Read

- `.team/features/git-worktree-isolation/tasks/task-{1-6,11-13}/handshake.json` — all 9
- `bin/lib/run.mjs` — lines 28–47, 50–55, 145–210, 280–390, 788–810, 1010–1040, 1505–1565
- `bin/lib/gate.mjs` — full file (190 lines)
- `test/worktree.test.mjs` — full file (~730 lines)
- `PLAYBOOK.md` — lines 182–260 (Git Worktrees section)
- `.team/features/git-worktree-isolation/tasks/task-12/test-output.txt` — verified run results

---

## Per-Criterion Results

### 1. Worktree creation and slug sanitization (tasks 1, 2, 6)

**PASS** — Direct evidence:

- `slugToBranch` at `bin/lib/run.mjs:155–160` lowercases, replaces `\s_` with `-`, strips `[^a-z0-9\-\.]`, caps at 72 chars.
- `createWorktreeIfNeeded` at `run.mjs:163–176` applies `slugToBranch` *before* `path.join`, closing the `../evil` path-traversal vector.
- Guard at `run.mjs:165–166` throws `invalid slug` for empty or all-dots results.
- Tests at `test/worktree.test.mjs:491–534` exercise `../evil`, `..`, `@@@///` — all produce correct outcomes.

### 2. Required-cwd enforcement (tasks 3, 11)

**PASS** — Direct evidence:

- `runGateInline` at `run.mjs:54` throws `"cwd is required"` when `cwd` is falsy.
- `dispatchToAgent` at `run.mjs:287` throws `"cwd is required"` when `cwd` is falsy.
- `dispatchToAgentAsync` at `run.mjs:346` throws `"cwd is required"` when `cwd` is falsy.
- Negative tests at `worktree.test.mjs:284–318` cover all three entry points, both omitted and explicitly `undefined`.

### 3. Worktree lifecycle — success path removes, error path preserves (tasks 4, 5)

**PASS** — Direct evidence:

- `_runSingleFeature` at `run.mjs:1019–1021` creates the worktree and sets `cwd = worktreePath`.
- Catch-and-rethrow at `run.mjs:1528–1533` logs "preserving worktree for retry" and rethrows — no `finally` block removes the worktree on error.
- `removeWorktree` at `run.mjs:1534` is on the fall-through path, executed only when no error propagates.
- Source-assertion test at `worktree.test.mjs:539–547` verifies `removeWorktree` is NOT in a `finally` block.
- Real-git integration test at `worktree.test.mjs:186–204` verifies `removeWorktree` deletes the directory AND removes the git tracking entry.

### 4. `gate.mjs` cwd isolation (tasks 11, 13)

**PASS** — Direct evidence:

- `gate.mjs:21` has `const cwd = getFlag(args, "cwd") || process.cwd();` inside `cmdGate` — the `|| process.cwd()` fallback is the CLI's own arg-parsing, not an agent dispatch.
- No `cwd: process.cwd()` hard-coded anywhere in `gate.mjs`.
- Grep-audit tests at `worktree.test.mjs:648–682` verify both the absence of `cwd: process.cwd()` and that any `process.cwd()` reference is bounded within `cmdGate`.

### 5. Concurrent isolation (task 6)

**PASS** — Direct evidence:

- Different-slug in-process parallel test at `worktree.test.mjs:384–408` confirms distinct paths and git tracking for different slugs.
- Real OS-level child-process race test at `worktree.test.mjs:427–464` confirms two separate Node.js processes racing on different slugs both succeed and produce non-overlapping worktrees.
- Same-slug race test at `worktree.test.mjs:466–486` accepts "at least one wins, subsequent reuse succeeds" — no corruption.

### 6. PLAYBOOK.md documentation (task 12)

**PASS** — Direct evidence in `PLAYBOOK.md:182–243`:

- `## Git Worktrees` section present.
- `git worktree list`, `git worktree remove --force`, `git worktree prune` all documented.
- `git -C .team/worktrees/<slug> log` and `git status` documented.
- Slug normalization mentions dot retention and re-run reuse.

### 7. Test suite health

**PASS** — `task-12/test-output.txt` shows `566 pass / 0 fail / 2 skipped`. Gate output in the review prompt (post task-13) confirms the suite continues to pass.

---

## Findings

🔵 `test/worktree.test.mjs:384–408` — In-process "concurrent" tests use `Promise.resolve().then(() => createWorktreeIfNeeded(...))` which serializes the synchronous `execFileSync` calls on the event loop; no actual OS-level race occurs here. The child-process test at lines 427–464 is the real concurrency test. The test descriptions ("Race them in parallel", suite name "concurrent") are misleading — add a comment clarifying this is a logical-ordering test, not a true concurrency test.

🔵 `test/worktree.test.mjs:539–556` — Source-regex assertion at line 553 will break if the `"preserving worktree"` log string or the `err` variable name changes. The invariant is real but the assertion is brittle; extracting the string to a named constant in `run.mjs` would make the contract explicit.

🔵 `bin/lib/run.mjs:38` — `harness()` uses `cwd: process.cwd()` for launching the harness subprocess. This is intentional (harness manages main-repo STATE.json via absolute `--dir` paths), but it is an undocumented exception to the worktree-isolation invariant and is outside the scope of the grep-audit tests. A comment explaining why this is safe would prevent a future engineer from "fixing" it incorrectly.

---

## Edge Cases Checked

- `../evil` slug: sanitized to `..evil`, path stays under `.team/worktrees/` ✓
- Empty and all-dots slugs: throw `invalid slug` ✓
- Re-run after error: existing directory detected by `existsSync`, `git worktree add` skipped ✓
- Re-run after success: new worktree created cleanly with `-B` flag ✓
- Gate cwd fallback: contained inside `cmdGate` CLI parsing only ✓

## Edge Cases NOT Checked

- Windows path handling (backslash in `join`, `shell: true` gate behavior)
- What happens when the `.team/worktrees/` parent directory is not writable
- Whether `git worktree remove --force` silently fails leaves an orphaned branch (documented in PLAYBOOK.md as expected)
