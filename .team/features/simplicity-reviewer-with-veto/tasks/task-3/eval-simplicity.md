# Simplicity Review — task-3

## Verdict: FAIL (🔴 simplicity veto)

## Findings

🔴 bin/lib/flows.mjs:210 — Premature abstraction: `tagSimplicityFinding()` is used at exactly 1 production call site (`bin/lib/run.mjs:1292`). Meanwhile, `mergeReviewFindings()` at `bin/lib/flows.mjs:186-191` contains near-identical emoji-preserving tag logic inline. Fix by either (a) refactoring `mergeReviewFindings` to call `tagSimplicityFinding` for its simplicity-critical row (→ 2 call sites, eliminates duplication), or (b) inlining the 7-line helper at `run.mjs:1292`. As shipped, the helper adds an export + import + dedicated test block for a single caller while duplicated logic persists in the merge path.

🔵 test/flows.test.mjs:372 — The fourth test ("cross-flow contract") restates an assertion that `mergeReviewFindings` already covers and the helper's own test covers; consider dropping or folding into the existing multi-review test to reduce redundancy.

## Evidence

- Handshake claim: "Added `tagSimplicityFinding()` helper in flows.mjs and wired it into the build-verify dedicated simplicity pass."
- Call-site count: `grep tagSimplicityFinding bin/lib/*.mjs` → 1 definition (flows.mjs:210), 1 import (run.mjs:14), 1 invocation (run.mjs:1292). No other production callers.
- Inline duplicate: `flows.mjs:186-191` already does the `^([🔴🟡🔵])\s*/u` match-and-slice pattern with a conditional "simplicity veto" label for `f.role === "simplicity" && p.severity === "critical"`. The new helper re-implements the same splice pattern.
- Tests: `npm test` → 596/596 pass (matches handshake claim).
- Both flows DO emit `[simplicity veto]`:
  - Multi-review: verified via `mergeReviewFindings` at flows.mjs:188 (pre-existing).
  - Build-verify: verified via the new `taggedCriticals` path at run.mjs:1290-1296.

## Per-Criterion

- **Deletability**: FAIL — the helper is deletable (1 caller, 7 lines), so per veto criterion #2 (premature abstraction: <2 call sites) this blocks merge.
- **Cognitive load**: PASS — the helper itself is small and well-named; the issue is only that its existence is unjustified at current usage.
- **Dead code / unreachable**: None observed.
- **Unnecessary indirection**: The helper currently acts as indirection for a single caller — overlaps with veto #3 but #2 is the cleaner category.
- **Gold-plating**: Borderline — the helper anticipates a second caller (`mergeReviewFindings`) that was not actually updated to use it.
- **Correctness**: The functional behavior (build-verify lastFailure and console now include `[simplicity veto]`) is correct and tested.

## Recommendation
Fix by refactoring `mergeReviewFindings` to call `tagSimplicityFinding` for its simplicity row — this both legitimizes the helper (2 call sites) and removes duplicated emoji-splice logic. This is a small, localized change.
