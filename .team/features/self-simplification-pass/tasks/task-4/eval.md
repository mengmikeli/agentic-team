# Simplicity Review — self-simplification-pass

**Reviewer:** Simplicity advocate (veto authority over dead code, premature abstraction, unnecessary indirection, gold-plating)
**Verdict:** PASS
**Date:** 2026-04-27

## Files Actually Opened and Read

1. `.team/features/self-simplification-pass/SPEC.md` (full, 219 lines)
2. `.team/features/self-simplification-pass/tasks/task-{1,2,3,4}/handshake.json` (all 4)
3. `bin/lib/simplify.mjs` (full, 326 lines — the new module)
4. `bin/lib/run.mjs` (full, 1647 lines — integration site)
5. `test/simplify.test.mjs` (full, 543 lines)
6. `roles/simplicity.md` (full, 39 lines)
7. `bin/agt.mjs` (diff only — CLI wiring)
8. `bin/lib/outer-loop.mjs` (grep search for simplify/args passthrough)
9. `package.json` (diff only — test script addition)

## Gate Verification

```
npm test: 612 tests, 610 pass, 0 fail, 2 skipped
```

Tests run independently and confirmed passing on this branch.

## Veto Category Audit

### 1. Dead Code

**PASS** — No dead code found.

- All 5 exports from `simplify.mjs` are consumed: `runSimplifyPass` by `run.mjs:1528` + `cmdSimplify:314` + tests; `cmdSimplify` by `agt.mjs:71`; `getFeatureDiff`, `buildSimplifyBrief`, `buildFixBrief` each have 1 internal call + test import (2 call sites).
- All 5 private functions (`truncateDiff`, `loadSimplicityRole`, `printVerdict`, `writeEval`, `runReviewRound`) are called within the module.
- No commented-out code, no unreachable branches.
- No stale files: `simplify-pass.mjs` (referenced in earlier reviews) was correctly renamed/consolidated to `simplify.mjs`.

### 2. Premature Abstraction

**PASS** — No premature abstraction.

- `runSimplifyPass` — 3 call sites (run.mjs, cmdSimplify, tests). Earns its keep.
- `getFeatureDiff` — 2 call sites (internal at line 216, tests). Also called via `_getDiffFn` indirection for test injection, which is the standard JS DI pattern.
- `buildSimplifyBrief` — 2 call sites (internal at line 188 via `runReviewRound`, tests).
- `buildFixBrief` — 2 call sites (internal at line 259, tests).
- `persistSimplifyMetrics` (run.mjs:1511) — 2 call sites (line 1532, 1539). Closure that captures local variables — appropriate.
- Private helpers (`runReviewRound`, `printVerdict`, `writeEval`) are extracted from a loop body for readability. Single call sites inside a loop is a valid decomposition pattern, not premature abstraction.

### 3. Unnecessary Indirection

**PASS** — No unnecessary indirection.

- `simplify.mjs` is a single module with a clear public API. No re-exports, no wrappers that only delegate.
- `cmdSimplify` does dynamic import of `run.mjs` to get `findAgent`/`dispatchToAgent` — this is necessary to avoid circular dependencies (run.mjs imports simplify.mjs).
- The `_dispatchFn`/`_getDiffFn` injection points are test seams, not indirection layers.

### 4. Gold-Plating

**PASS** — No gold-plating.

- `MAX_SIMPLIFY_ROUNDS = 2` — names the spec requirement (not a speculative config).
- `MAX_DIFF_CHARS = 12000` — names a magic number (not a tunable knob; truncation is necessary).
- `--no-simplify` flag has a clear use case (CI speed, debugging, spec-required).
- `agt simplify` CLI command — useful standalone entry point, not just plumbing.
- No feature flags, no config files, no plugin interfaces.

## Findings

🟡 bin/lib/simplify.mjs:276-286 — Escalation uses throw+custom-properties instead of returning `{ verdict: "ESCALATED" }` as the SPEC's data flow diagram shows. The throw pattern forces callers into try/catch with 5 ad-hoc error properties (`simplifyEscalation`, `critical`, `findings`, `rounds`, `durationMs`). A return value would be simpler and match the spec. Also: the SPEC says ESCALATED should "continue to finalize" but the implementation blocks finalize — deliberate but undocumented divergence.

🟡 bin/lib/run.mjs:1507 — Missing `&& agent` guard from SPEC's integration pseudocode. Without it, when no agent is available and `completed > 0`, the simplify pass runs, dispatches to `dispatchToAgent(null, ...)`, which fails gracefully and returns PASS. Not a bug, but wastes a call and produces confusing console output ("Dispatching simplicity reviewer..." then "dispatch failed").

🟡 bin/lib/simplify.mjs:207-211 — The `_dispatchFn`/`_getDiffFn` guard is confusing. It throws if both are missing but the error message conflates "no dispatch function" with "getDiffFn returning null to skip." After the guard, `dispatch` defaults to a noop that returns `{ ok: false }`, meaning providing only `_getDiffFn` (returning a non-null diff) with no `_dispatchFn` silently fails and returns PASS. The guard should be: require `_dispatchFn` when `_getDiffFn` would return non-null.

🟡 test/simplify.test.mjs — Missing dedicated test for `--no-simplify` flag behavior. SPEC AC requires "Unit tests cover: ... skip flag." The flag logic is in `run.mjs:1507,1545` but no test exercises that path. Flagged by multiple prior reviewers; still unaddressed.

🔵 bin/lib/simplify.mjs:16-23 — `truncateDiff` (4 lines, 1 call site) and `loadSimplicityRole` (6 lines, 1 call site) could be inlined into `buildSimplifyBrief`. Minor readability tradeoff — named functions self-document intent but add navigation cost.

🔵 bin/lib/run.mjs:1507 — When `completed === 0`, simplification is silently skipped with no progress.md entry. The `--no-simplify` path at line 1545 logs "Skipped (--no-simplify)." For audit trail consistency, add a similar notice for the zero-completed skip.

🔵 bin/lib/simplify.mjs:302 — `cmdSimplify()` takes no parameters but `agt.mjs:71` calls `cmdSimplify(args)`. Args are silently discarded. Consistent with `flags: []` in help, but accepting and ignoring args is a mild inconsistency.

## Overall Simplicity Assessment

The implementation is **well-decomposed and appropriately scoped**:

- **326 lines in a single new file** (`simplify.mjs`) with all feature logic contained. No unnecessary module splitting.
- **40 lines of integration** in `run.mjs` (lines 1504-1547) at exactly the right location (between task loop and finalize). Minimal blast radius.
- **543 lines of tests** covering the core contract: empty diff skip, warning passthrough, fix loop mechanics, escalation, and eval.md output.
- The module reuses existing infrastructure (`parseFindings`, `computeVerdict`, `appendProgress`) rather than reinventing.
- No new abstractions, interfaces, or patterns introduced. Follows the existing codebase conventions.

The main complexity concern is the throw-based escalation pattern (🟡) which adds cognitive load compared to the spec's simpler return-based approach. This is a design choice that works but could be simplified in a future pass.

**0 critical findings. PASS.**

## Edge Cases Checked

| Edge case | How handled | Verified |
|---|---|---|
| Empty diff (no changes) | Returns PASS, rounds=0, logs skip notice | Test at line 161 |
| No agent available | `dispatchToAgent(null)` returns `{ ok: false }`, runSimplifyPass returns PASS | Code path traced; no dedicated test |
| Dispatch failure mid-loop | Returns PASS (fail-open), logs error | Test at line 326 |
| Max rounds exhausted | Throws with `simplifyEscalation=true` | Tests at lines 197, 360 |
| Fix succeeds on round 2 | Returns PASS, rounds=2 | Test at line 228 |
| `--no-simplify` flag | `args.includes()` check in run.mjs skips pass | Code verified; no unit test |
| `completed === 0` | Silently skipped (no progress.md entry) | Code verified at run.mjs:1507 |
| `featureDir` is null (CLI mode) | `writeEval` and `appendProgress` short-circuit | Tests pass with `featureDir: null` |
| `master` instead of `main` | `getFeatureDiff` tries main first, falls back to master | Test at line 488 |
