# Simplicity Review: git-worktree-isolation — Gate commands receive worktree cwd

**Overall Verdict: PASS**

---

## Files Actually Read

- `bin/lib/run.mjs` lines 1–30 (imports)
- `bin/lib/run.mjs` lines 49–175 (`runGateInline`, `slugToBranch`, `createWorktreeIfNeeded`, `removeWorktree`)
- `bin/lib/run.mjs` lines 277–360 (`dispatchToAgent`, `dispatchToAgentAsync`)
- `bin/lib/run.mjs` lines 900–960 (worktree creation, `cwd` reassignment)
- `bin/lib/run.mjs` lines 1090–1165 (gate call site)
- `test/worktree.test.mjs` full 264 lines
- git diffs: `d48d3fb`, `c4d2cea`, `75945b5`, `2bc244d`
- `.team/features/git-worktree-isolation/SPEC.md`
- `.team/features/git-worktree-isolation/tasks/task-{1,2,3,4}/handshake.json` and `eval.md`

---

## Veto Category Audit

### 1. Dead Code — CLEAR

All exported symbols (`runGateInline`, `slugToBranch`, `createWorktreeIfNeeded`, `removeWorktree`, `dispatchToAgent`) are used: production call sites exist in `_runSingleFeature`, and the exports are consumed by the test suite. No commented-out code, unreachable branches, or unused imports were found in the diff.

**One near-miss:** `describe("slugToBranch normalization")` at `test/worktree.test.mjs:204` contains two tests that duplicate existing coverage:
- Line 205: asserts `slugToBranch("my-feature") === "my-feature"` — identical logic already tested at line 16 ("passes through a clean slug unchanged")
- Line 211: asserts underscore normalization — identical logic already tested at line 22 ("converts underscores to dashes")

Neither test calls `createWorktreeIfNeeded`; both invoke `slugToBranch` directly, making the describe name ("slugToBranch normalization") misleading — it implies integration with the worktree creation path when it is just a duplicate unit test. The suite does not add to coverage in any meaningful sense.

This is 🟡 cognitive overhead (redundant test artifacts) rather than a 🔴 dead-code veto (the tests run and make valid assertions), but it should go to the backlog.

### 2. Premature Abstraction — CLEAR

`slugToBranch`, `createWorktreeIfNeeded`, and `removeWorktree` each have a single production call site, which is the threshold for a premature-abstraction veto. However, all three are extracted specifically for unit testability — the SPEC at line 39 requires "Unit tests cover: worktree creation, `cwd` injection into agent briefs and gate commands, cleanup on done, cleanup on blocked, crash-recovery reuse." Testing these behaviors without extraction would require either spawning a real git process (slow, brittle) or mocking at a deeper layer. The extraction earns its keep: each helper is tested directly with mockExec/mockSpawn injection.

No interface-with-single-implementation patterns.

### 3. Unnecessary Indirection — CLEAR

`dispatchToAgent`'s `_spawnFn = spawnSync` parameter is dependency injection for testing, not indirection. No wrapper-only-delegates pattern found.

### 4. Gold-Plating — CLEAR

`_execFn` and `_spawnFn` defaults exist solely to support the unit tests required by the SPEC. They are not config options, feature flags, or speculative extensibility hooks. No path exists where only one value is ever used for a non-test reason — the production default is the invariant production behavior.

---

## Complexity Warnings

🟡 `test/worktree.test.mjs:204` — `describe("slugToBranch normalization")` duplicates `describe("slugToBranch")` at line 14; test at line 205 is covered by line 16, test at line 211 is covered by line 22. The describe name implies `createWorktreeIfNeeded` integration but neither test exercises it — delete both tests or replace with a genuine `createWorktreeIfNeeded` call verifying the `"feature/"` prefix is applied (noting that `line 121-130` already covers this).

🟡 `bin/lib/run.mjs:942` — `cwd` is overloaded: it begins as the main-repo CWD (inherited from outer scope) and is silently reassigned to `worktreePath` at line 945. A reader must locate that single line to understand which directory is in effect for all subsequent code (dispatches, gate, commits). Renaming to `execCwd` or `worktreeCwd` at line 945 eliminates this with zero abstraction cost.

🟡 `bin/lib/run.mjs:52` — `cwd = process.cwd()` default on the now-exported `runGateInline` is a silent footgun: any caller that omits the 4th argument runs the gate against the main repo directory rather than the worktree, with no warning. In the feature context this is never the right behavior. Removing the default forces call sites to be explicit; no existing test relies on the default.

---

## Suggestions

🔵 `test/worktree.test.mjs:186` — `result.stdout.trim().includes(tmpDir.split("/").pop())` checks only the last path segment; two concurrent tests sharing a suffix (e.g. `gate-cwd-test-1`) would produce a false positive. Strengthen to `result.stdout.trim() === tmpDir` (exact match) or use `startsWith` on the full path.

🔵 `bin/lib/run.mjs:326` — `dispatchToAgentAsync` lacks the `_spawnFn` injection that `dispatchToAgent` has, creating an asymmetry: the parallel-review dispatch path's cwd injection is untestable via mock. Low impact (parallel reviews are an infrequently exercised path) but worth noting for consistency.

---

## Backlog

| Priority | Location | Action |
|---|---|---|
| Backlog | `test/worktree.test.mjs:204` | Delete `describe("slugToBranch normalization")`; its two tests are fully covered by `describe("slugToBranch")` |
| Backlog | `bin/lib/run.mjs:945` | Rename `cwd = worktreePath` to a separate variable (`execCwd`) to make the semantic switch explicit |
| Backlog | `bin/lib/run.mjs:52` | Remove `= process.cwd()` default from `runGateInline`; require callers to pass `cwd` explicitly |

---

## Verdict Rationale

The implementation is tight. The core change (`runGateInline` receives and uses `cwd`) is three lines: adding the parameter to the function signature, using it in `execSync`, and passing it from the call site. No new abstractions were added without justification, no dead code was introduced, and the injectable helpers serve the SPEC-required unit tests.

The three 🟡 warnings are genuine simplicity debts — variable reuse, a silent default on a public API, and duplicate test code — but none blocks correctness. No 🔴 veto categories triggered.

**PASS** — with three backlog items.
