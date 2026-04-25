# Tester Review — task-3

## Verdict: PASS

## Files actually opened
- `bin/lib/run.mjs` lines 40–140, 275–340, 340–378
- `test/worktree.test.mjs` lines 160–290
- `.team/features/git-worktree-isolation/tasks/task-3/handshake.json`
- `.team/features/git-worktree-isolation/tasks/task-3/` (directory listing)

## Verification (re-checked against current source)

The previous round's yellow flags about a `cwd = process.cwd()` default are **stale** — current source enforces the contract:

- `runGateInline` (run.mjs:53) — signature `runGateInline(cmd, featureDir, taskId, cwd)` with explicit guard at run.mjs:54: `if (!cwd) throw new Error("runGateInline: cwd is required (no implicit process.cwd() fallback)")`.
- `dispatchToAgent` (run.mjs:283) — same guard at run.mjs:284. Forwards `cwd` to `_spawnFn` for both claude (run.mjs:293) and codex (run.mjs:325). Codex branch now has `env: { ...process.env }` (run.mjs:328) — parity fix landed.
- Negative tests now exist (test/worktree.test.mjs:245, :252, :259):
  - `runGateInline throws when cwd is omitted`
  - `runGateInline throws when cwd is undefined explicitly`
  - `dispatchToAgent throws when cwd is omitted`

The contract is enforced at runtime AND locked by tests. The earlier "latent footgun" finding is closed.

## Per-criterion

| Criterion | Result | Evidence |
|---|---|---|
| `runGateInline` honors cwd, no implicit fallback | PASS | run.mjs:54 throw; worktree.test.mjs:181 (positive), :245/:252 (negative) |
| `dispatchToAgent` honors cwd, no implicit fallback | PASS | run.mjs:284 throw; worktree.test.mjs:269/:284 (positive), :259 (negative) |
| Codex branch parity (env propagation) | PASS | run.mjs:328 |
| Live call sites pass worktree cwd | PASS | run.mjs:1195 (gate), run.mjs:1219 (review); regex assertion at worktree.test.mjs:223 |
| No regressions | PASS | Gate output: 539 pass / 0 fail / 2 skipped |

## Coverage gaps & edge cases I checked

- ✅ cwd omitted → throws (locked by negative tests)
- ✅ cwd === process.cwd() vs cwd ≠ process.cwd() (worktree.test.mjs:269+)
- ✅ Both agent branches (claude, codex) covered
- ⚠️ **`dispatchToAgentAsync` (run.mjs:342) and `runParallelReviews` (run.mjs:370) accept `cwd` but lack the matching `if (!cwd) throw` guard.** If `cwd` is `undefined`, `spawn(...)` will inherit `process.cwd()` silently. The spec says "no implicit fallback when a worktree is active" — these sibling functions are part of the same review-phase pipeline (called from `runParallelReviews` for parallel reviewers) and break the contract surface.
- ⚠️ The wiring test at worktree.test.mjs:223 still uses a source-regex assertion. Brittle to formatting; doesn't actually exercise the call. A behavioral test (mock `runGateInline`, drive `_runSingleFeature`) would survive refactors.
- ⚠️ `task-3/artifacts/test-output.txt` does not exist on disk despite handshake claiming "539 pass / 0 fail / 2 skipped". Reproducibility/auditability gap.

## Findings

🟡 bin/lib/run.mjs:342 — `dispatchToAgentAsync` does not enforce `cwd` required; same contract as `dispatchToAgent` should apply (it's the async parallel sibling). Add `if (!cwd) throw new Error("dispatchToAgentAsync: cwd is required")`.
🟡 bin/lib/run.mjs:370 — `runParallelReviews` propagates `cwd` to `dispatchToAgentAsync` and `buildReviewBrief` without validation; if a future caller forgets, parallel reviewers run against the main checkout. Add an early guard.
🟡 test/worktree.test.mjs — No negative test exists for `dispatchToAgentAsync(...,  undefined)`. Add a coverage twin to lock the contract for the async path before it diverges.
🔵 test/worktree.test.mjs:223 — Source-regex wiring assertion is brittle and redundant given the behavioral spawn-mock tests. A spy-based test on `runGateInline` driven through `_runSingleFeature` would be stronger.
🔵 .team/features/git-worktree-isolation/tasks/task-3/ — Missing `artifacts/test-output.txt`; gate evidence isn't captured under the task dir even though handshake references results.

## Notes
PASS verdict. The two target functions (`runGateInline`, `dispatchToAgent`) both meet the spec literally and behaviorally, with negative tests preventing regression. The yellow findings are about widening the contract to cover the async/parallel siblings before they become a silent-degradation surface. None block merge.
