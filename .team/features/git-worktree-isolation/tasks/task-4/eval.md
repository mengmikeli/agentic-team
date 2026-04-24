# Engineer Review: git-worktree-isolation — Gate commands receive worktree cwd

**Overall Verdict: PASS**

---

## Files Actually Read

- `bin/lib/run.mjs` lines 49–130 (`runGateInline` full body)
- `bin/lib/run.mjs` lines 376–400 (`detectGateCommand`)
- `bin/lib/run.mjs` lines 743–750 (`_runSingleFeature` init)
- `bin/lib/run.mjs` lines 838–840 (`detectGateCommand` call site)
- `bin/lib/run.mjs` lines 940–960 (worktree creation + `cwd = worktreePath`)
- `bin/lib/run.mjs` lines 1140–1165 (`runGateInline` call site)
- `bin/lib/run.mjs` lines 1465–1540 (`finally` block + completion report)
- `bin/lib/gate.mjs` lines 15–65 (`cmdGate` body)
- `test/worktree.test.mjs` lines 155–250 (`runGateInline` tests + source assertion)
- `.team/features/git-worktree-isolation/tasks/task-{1,2,3,4}/handshake.json`
- `.team/features/git-worktree-isolation/tasks/task-3/artifacts/test-output.txt` (lines 1–100)

---

## Per-Criterion Results

### Correctness — PASS

Direct code trace:

| Step | Evidence |
|---|---|
| `runGateInline` accepts `cwd` | `run.mjs:52` — `export function runGateInline(cmd, featureDir, taskId, cwd = process.cwd())` |
| `cwd` flows into `execSync` | `run.mjs:58–64` — `execSync(cmd, { cwd, ... })` |
| `cwd` is `worktreePath` at call site | `run.mjs:747` `let cwd = mainCwd` → `run.mjs:948` `cwd = worktreePath` → no reassignment before `run.mjs:1148` |
| Call site passes it | `run.mjs:1148` — `runGateInline(gateCmd, featureDir, task.id, cwd)` |
| Behavioral test confirms injection | `test/worktree.test.mjs:181–191` — `pwd` output `=== realpathSync(tmpDir)` |
| Gate passed | `task-3/handshake.json` — exit 0; `npm test` all green |

### Previous 🔴 now fixed — PASS

`let completed`, `let blocked`, `const startTime` were block-scoped inside the `try {}` in a prior commit, causing `ReferenceError` at lines 1476–1490 on every successful run. Commit `c48615f` hoists all three to function scope at lines 943–945 (before the `try {` at line 953). Verified: they are accessible at lines 1476, 1489, 1490 after the `} finally {` closes at line 1474.

### Code quality — PASS with backlog

`detectGateCommand` is correctly called with `mainCwd` (line 839), not `worktreePath`. Gate command source (PROJECT.md) is read from the main repo; execution runs in the worktree. Semantics are sound.

One reuse concern: `cwd` variable is reassigned from `mainCwd` to `worktreePath` at line 948, which is a semantic shift that a reader must locate to understand which directory governs all subsequent I/O. Not a correctness defect, but a readability hazard.

---

## Findings

🟡 `test/worktree.test.mjs:222` — Source assertion checks variable name `cwd` at call site, not runtime value; removing `cwd = worktreePath` at `run.mjs:948` and replacing with any other assignment defeats the test while the regex still passes — backlog a spy/mock integration test on `_runSingleFeature` that asserts the worktree path flows into `runGateInline`
🟡 `bin/lib/run.mjs:52` — `cwd = process.cwd()` default on exported `runGateInline` is a silent footgun; a future call site that omits the 4th arg runs the gate in the main repo without any warning or error — remove the default to force explicit passing
🟡 `bin/lib/gate.mjs:59` — `cmdGate` hardcodes `cwd: process.cwd()` while `runGateInline` accepts an injected path; the API divergence is undocumented and will mislead future maintainers who expect consistent worktree-awareness — add a comment on `cmdGate` marking it as not worktree-aware
🔵 `bin/lib/run.mjs:948` — `cwd = worktreePath` silently aliases the outer `cwd` variable; rename the reassignment to a separate variable (`execCwd` or `worktreeCwd`) so the semantic shift is explicit without requiring readers to scan the full function

---

## Verdict Rationale

Core claim verified by direct code trace and behavioral test. The previously-critical block-scope bug is confirmed fixed. Gate exited 0 with full suite green. Three 🟡 backlog items remain (source assertion weakness, silent default, `cmdGate` divergence) — none is a correctness defect for this task.

**PASS**

---

# Simplicity Review: git-worktree-isolation — Gate commands receive worktree cwd

**Overall Verdict: PASS**

---

## Files Actually Read

- `bin/lib/run.mjs` lines 1–80 (`harness`, `runGateInline` full body)
- `bin/lib/run.mjs` lines 152–176 (`slugToBranch`, `createWorktreeIfNeeded`, `removeWorktree`)
- `bin/lib/run.mjs` lines 277–360 (`dispatchToAgent`, `dispatchToAgentAsync`)
- `bin/lib/run.mjs` lines 930–952 (worktree creation + `cwd` reassignment)
- `bin/lib/run.mjs` lines 1138–1165 (gate call site)
- `test/worktree.test.mjs` full 278 lines
- `.team/features/git-worktree-isolation/tasks/task-{1,2,3,4}/handshake.json`
- `.team/features/git-worktree-isolation/tasks/task-3/artifacts/test-output.txt` (lines 1–80)

---

## Veto Category Audit

### 1. Dead Code — CLEAR

All four exported symbols (`slugToBranch`, `createWorktreeIfNeeded`, `removeWorktree`, `runGateInline`, `dispatchToAgent`) are consumed: production call sites in `_runSingleFeature` at lines 947, 1148, and the exports are exercised by the test suite. No commented-out code, unused imports, or unreachable branches were found in the diff.

One near-miss: `describe("slugToBranch normalization")` at `test/worktree.test.mjs:204` contains two tests that duplicate coverage already present in `describe("slugToBranch")` (line 14):
- Line 207: `slugToBranch("my-feature") === "my-feature"` is covered by line 16
- Line 213: underscore normalization is covered by lines 22–24

Neither test calls `createWorktreeIfNeeded`; the describe name implies integration coverage it does not provide. These tests run and assert valid things, so this is **🟡 redundant test overhead** rather than a 🔴 dead-code veto.

### 2. Premature Abstraction — CLEAR

`slugToBranch`, `createWorktreeIfNeeded`, and `removeWorktree` each have a single production call site. However, the SPEC explicitly requires unit tests for worktree creation, cwd injection, and cleanup — behaviors that cannot be tested without either spawning a real git process or extracting these helpers with injectable `_execFn` parameters. The extraction earns its keep: each helper is tested directly with mock injection. No interface-with-single-implementation patterns exist.

### 3. Unnecessary Indirection — CLEAR

`_execFn = execFileSync` and `_spawnFn = spawnSync` are dependency injection for unit testing, not delegation wrappers. The production default is the invariant behavior; the parameter exists only for test seams.

### 4. Gold-Plating — CLEAR

No config options, feature flags, or speculative extensibility. The injectable defaults serve only the SPEC-required test suite, not hypothetical future callers.

---

## Complexity Warnings

🟡 `test/worktree.test.mjs:204` — `describe("slugToBranch normalization")` is a duplicate. Lines 207 and 213 test the same logic as lines 16 and 22–24 in `describe("slugToBranch")`. The describe name falsely implies `createWorktreeIfNeeded` integration. Delete both tests or replace with a genuine `createWorktreeIfNeeded` invocation that verifies the `"feature/"` prefix (line 121 already covers this, so deletion is preferred).

🟡 `bin/lib/run.mjs:948` — `cwd = worktreePath` silently reassigns the outer `cwd` variable. A reader must locate this single line to know which directory governs all subsequent dispatches, gate, and commits. Rename to a new variable (`execCwd` or `worktreeCwd`) at line 948 — zero abstraction cost, eliminates the semantic ambiguity.

🟡 `bin/lib/run.mjs:52` — `cwd = process.cwd()` default on the exported `runGateInline` is a footgun: any caller that omits the 4th argument silently runs the gate against the main repo instead of the worktree. In this feature's context that is never correct. Removing the default makes the call site explicit; no existing test relies on the default (all tests pass an explicit `tmpDir`).

---

## Suggestions

🔵 `bin/lib/run.mjs:326` — `dispatchToAgentAsync` lacks the `_spawnFn` injection that `dispatchToAgent` has. The async parallel-review path's cwd injection is correct in production but untestable via mock, creating a coverage gap for an infrequently-exercised code path.

---

## Backlog

| Priority | Location | Action |
|---|---|---|
| Backlog | `test/worktree.test.mjs:204` | Delete `describe("slugToBranch normalization")`; both tests are fully covered by `describe("slugToBranch")` |
| Backlog | `bin/lib/run.mjs:948` | Rename `cwd = worktreePath` to a new variable (`execCwd`) so the semantic switch is explicit |
| Backlog | `bin/lib/run.mjs:52` | Remove `= process.cwd()` default from `runGateInline` to force call sites to be explicit |

---

## Verdict Rationale

The core change is three lines: adding `cwd` to the `runGateInline` signature (line 52), using it in `execSync` (line 59), and passing it from `_runSingleFeature` (line 1148). No new abstractions were added without justification. The injectable helper pattern is directly required by the SPEC's unit-test mandate.

The three 🟡 warnings are genuine simplicity debts — variable reuse, a silent default on an exported API, and duplicate test code — but none blocks correctness and none triggers a veto category.

**PASS** — with three backlog items.

---

# Test Review: git-worktree-isolation — Gate commands receive worktree cwd

**Reviewer role:** Tester (coverage gaps, edge cases, regression risks)
**Overall Verdict: PASS** — No critical blockers. Four new warnings for backlog.

---

## Files Actually Read

- `bin/lib/run.mjs` lines 52–114 (`runGateInline` body + artifact writing path)
- `bin/lib/run.mjs` lines 280–340 (`dispatchToAgent`, `dispatchToAgentAsync`)
- `bin/lib/run.mjs` lines 740–750 (`_runSingleFeature` declaration + `cwd` init)
- `bin/lib/run.mjs` lines 935–952 (worktree creation + `cwd = worktreePath` reassignment)
- `bin/lib/run.mjs` line 1148 (call site)
- `test/worktree.test.mjs` full file (lines 1–280)

---

## Criterion: Gate commands receive and use the worktree path as cwd

| Check | Evidence | Result |
|---|---|---|
| `runGateInline` accepts `cwd` | `run.mjs:52` signature | ✅ |
| `cwd` used in `execSync` | `run.mjs:59` `{ cwd, ... }` | ✅ |
| Call site passes worktree path | `run.mjs:747` init → `run.mjs:948` `cwd = worktreePath` → `run.mjs:1148` pass | ✅ |
| Behavioral test verifies it | `test/worktree.test.mjs:181–191` `pwd` output == `realpathSync(tmpDir)` | ✅ |

---

## Coverage Gaps

### 1. Signal kill / timeout path not tested
`bin/lib/run.mjs:66–68` handles `err.signal` (SIGTERM when `execSync` hits the 120s timeout). This is the most likely real-world gate failure mode and has zero test coverage. A regression in this branch could corrupt the verdict silently.

### 2. Source-assertion regex is a brittle proxy
`test/worktree.test.mjs:226–229` verifies the call site by regex-matching source text. Two failure modes: (a) reformatting `run.mjs` breaks the regex while behavior is correct; (b) if `cwd` at line 1148 were `mainCwd` instead of `worktreePath`, the regex still passes (it only checks the variable name, not its value). The behavioral `pwd` test at line 181 already covers injection directly — this test adds false confidence without adding safety.

### 3. Artifact writing path never exercised
All `runGateInline` tests pass `taskId = null`, so `run.mjs:82–112` (artifact writes, `createHandshake`, `writeFileSync` for handshake) is never reached. A regression there would not be caught.

### 4. `dispatchToAgentAsync` cwd injection is structurally untestable
`bin/lib/run.mjs:326` has no `_spawnFn` injection point. The async parallel-dispatch path's `cwd` use cannot be unit-tested. Bumped from 🔵 to 🟡 because this is an active execution path for parallel reviews, not dead code.

---

## Verdict Rationale

Core implementation is correct with direct behavioral evidence. Criterion is met.

Four backlog items: untested signal/timeout path, brittle source-assertion regex, untested artifact writing, and untestable async dispatch. None is a correctness defect in the feature as specified.

**PASS** — with four additional backlog items.
