# PM Review: git-worktree-isolation — Gate commands receive worktree cwd

**Overall Verdict: PASS**

---

## Files Actually Read

- `bin/lib/run.mjs` lines 45–148 (`runGateInline` implementation)
- `bin/lib/run.mjs` lines 155–177 (`createWorktreeIfNeeded`, `removeWorktree`)
- `bin/lib/run.mjs` lines 378–397 (`detectGateCommand`)
- `bin/lib/run.mjs` lines 835–848 (gate command detection call site)
- `bin/lib/run.mjs` lines 930–951 (worktree creation + `cwd` reassignment)
- `bin/lib/run.mjs` lines 1138–1162 (`runGateInline` call site)
- `bin/lib/gate.mjs` lines 50–129 (legacy harness gate runner)
- `test/worktree.test.mjs` full 278 lines
- `.team/features/git-worktree-isolation/SPEC.md`
- `.team/features/git-worktree-isolation/progress.md`
- `.team/features/git-worktree-isolation/tasks/task-{1,2,3}/handshake.json`
- `.team/features/git-worktree-isolation/tasks/task-3/artifacts/test-output.txt` (lines 1–200)
- `.team/features/git-worktree-isolation/tasks/task-3/eval.md` (attempt-1 parallel review)
- `.team/features/git-worktree-isolation/tasks/task-4/eval.md` (simplicity review)

---

## Acceptance Criterion

From `SPEC.md` Done When section:
> `Gate commands (runGateInline) receive and use the worktree path as their working directory`

---

## Per-Criterion Results

### Criterion 1: `runGateInline` receives the worktree path — PASS

**Evidence:**
- `bin/lib/run.mjs:52` — `export function runGateInline(cmd, featureDir, taskId, cwd = process.cwd())` — `cwd` is the 4th parameter
- `bin/lib/run.mjs:1148` — `const gateResult = runGateInline(gateCmd, featureDir, task.id, cwd)` — 4th argument is `cwd`
- `bin/lib/run.mjs:942–948` — `worktreePath = createWorktreeIfNeeded(featureName, mainCwd)` then `cwd = worktreePath` — `cwd` holds the worktree path when the gate call runs

Direct code trace confirms the worktree path flows from creation → variable assignment → call site argument.

### Criterion 2: `runGateInline` uses the worktree path as its working directory — PASS

**Evidence:**
- `bin/lib/run.mjs:58–59` — `execSync(cmd, { cwd, encoding: "utf8", ... })` — the injected `cwd` is the working directory for the gate process

### Criterion 3: Tests verify the behavior — PASS

**Evidence:**
- `test/worktree.test.mjs:181–191` — runs `pwd` command in an actual temp directory, captures stdout, and asserts exact equality against `realpathSync(tmpDir)`. This tests real runtime behavior, not mocks.
- `test/worktree.test.mjs:223–231` — source assertion via regex that the call site at `run.mjs:1148` passes `cwd` as the 4th argument; a regression that drops `cwd` from the call would fail this test.

### Criterion 4: Gate tests pass — PASS

**Evidence:**
- `tasks/task-3/handshake.json` — nodeType: "gate", verdict: "PASS", exit code 0
- `tasks/task-3/artifacts/test-output.txt` lines 1–200 — all test suites pass including `runGateInline cwd injection` and `_runSingleFeature wiring`

---

## Attempt-1 Critical Issue: Resolved

The attempt-1 review found 🔴 block-scope declarations (`let completed`, `let blocked`, `const startTime`) inside the `try {}` block, causing `ReferenceError` on every successful run.

**Verified fixed:** These are now declared at `bin/lib/run.mjs:943–945`, before the `try {` block at line 946. The completion path is no longer unreachable.

## Attempt-1 Warning Issues: Resolved

- Weak test assertion (`includes(split("/").pop())`) → fixed to `realpathSync` + exact equality at `test/worktree.test.mjs:186–190`
- Missing wiring test → fixed; source assertion added at `test/worktree.test.mjs:223–231`

---

## Open Backlog Items (not blocking)

These were flagged in prior reviews and remain unaddressed, but none block merge for this specific criterion:

🟡 `bin/lib/run.mjs:52` — `cwd = process.cwd()` default on `runGateInline` is a silent footgun; any future call site that omits the 4th argument will silently run the gate against the main repo, not the worktree. Removing the default would force explicit passing. No existing test relies on this default.

🟡 `bin/lib/run.mjs:948` — `cwd = worktreePath` silently reuses the `cwd` variable for a semantically different purpose (it started as main-repo cwd). Any future code added between line 948 and 1148 that reassigns `cwd` would silently break gate isolation. Rename to a separate variable (e.g. `execCwd`) to make the semantic switch explicit.

🟡 `test/worktree.test.mjs:204–218` — `describe("slugToBranch normalization")` duplicates the `describe("slugToBranch")` block at line 14; both inner tests invoke `slugToBranch` directly without `createWorktreeIfNeeded`. Delete or replace with a genuine integration test.

🟡 `bin/lib/gate.mjs:59` — Legacy harness gate runner hardcodes `cwd: process.cwd()` and is not worktree-aware. `_runSingleFeature` uses `runGateInline` (not this path), so production behavior is unaffected. However, if `agt-harness.mjs` invokes this path, gate isolation is silently absent. Document the divergence or add a `cwd` parameter to `cmdGate` for consistency.

🟡 `bin/lib/run.mjs:161` — `createWorktreeIfNeeded` uses the raw `slug` value in `path.join(mainCwd, ".team", "worktrees", slug)`. `slugToBranch(slug)` sanitizes for the branch name but its output is not applied to the path. `path.join` resolves `..` segments: `createWorktreeIfNeeded("../../evil", "/repo")` produces `/repo/evil`, escaping `.team/worktrees/`. A bounds check is needed. Out of scope for this specific task but relevant to the worktree isolation feature overall.

---

## Verdict Rationale

The acceptance criterion is fully met: `runGateInline` receives the worktree path as its 4th argument, uses it in `execSync`, and tests verify both the runtime behavior and the call-site wiring. The 🔴 critical regression from attempt-1 was fixed. No new regressions are introduced.

The five open 🟡 items are legitimate technical debt — three from the simplicity review and two from this PM pass — but none blocks this specific criterion from being done.

**PASS** — five backlog items filed above.
