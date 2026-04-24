# Feature: Simplicity Reviewer with Veto

## Goal
Give the simplicity reviewer hard-block authority over four concrete anti-patterns — dead code, premature abstraction, unnecessary indirection, and gold-plating — so that simplicity `REQUEST_CHANGES` forces an overall `FAIL` verdict independent of other reviewers.

## Background
The simplicity reviewer already runs as one of six parallel reviewers. Its current role definition explicitly discourages blocking: "Don't block on speculative complexity — flag it, but let the builder decide." This is overly conservative for well-defined, objective issues. The four named anti-patterns are detectable, costly to carry forward, and consistently cause tech debt. The veto elevates simplicity from "advisory" to "blocking" for exactly those categories.

The mechanism is straightforward: the simplicity reviewer is permitted (and required) to use 🔴 (critical) for findings in the four veto categories. Since any 🔴 from any reviewer already produces a FAIL verdict, no new verdict machinery is needed — only the role definition and output format change.

## Scope

1. **Update `roles/simplicity.md`**
   - Replace the "Don't block on speculative complexity" anti-pattern with explicit veto scope.
   - Define the four blockable categories with concrete detection criteria:
     - **Dead code** — unused functions, unreachable branches, stale imports, commented-out code
     - **Premature abstraction** — abstraction used fewer than two call sites, or interface added for a single implementation
     - **Unnecessary indirection** — wrapper that does nothing but delegate, re-exported value with no transformation
     - **Gold-plating** — configurable option with only one value ever used, feature flag with no planned variation, speculative extensibility with no stated requirement
   - Require 🔴 (critical) for these four categories, not 🟡.
   - Retain 🟡 for borderline or judgment-call simplicity issues outside the four categories.
   - Update identity section to state veto authority.

2. **Update `mergeReviewFindings()` in `bin/lib/flows.mjs`**
   - Add a `[simplicity veto]` tag to 🔴 findings from the simplicity role when surfacing them in the merged report, so the cause of a FAIL is immediately legible.
   - No change to verdict logic needed — any 🔴 already causes FAIL.

3. **Tests**
   - Unit test: simplicity reviewer produces a 🔴 → merged result includes `[simplicity veto]` tag.
   - Unit test: simplicity 🔴 causes overall FAIL even when all other reviewers produce only 🟡/🔵.
   - Unit test: simplicity 🟡 (non-veto category) continues to produce PASS + backlog=true, not FAIL.
   - Existing parallel review tests continue to pass.

## Out of Scope

- New verdict types (APPROVE/REQUEST_CHANGES strings) — the existing 🔴/🟡/🔵 + FAIL/PASS system is sufficient.
- Changing veto authority for any other reviewer role.
- A separate "simplicity-only" review flow phase — simplicity continues to run in the existing multi-review parallel dispatch.
- Dashboard or UI changes to surface veto separately.
- Auto-fix or suggestions for removing dead code — this is review-only.
- Veto for issues outside the four named categories (those remain 🟡 advisory).

## Done When

- [ ] `roles/simplicity.md` names the four veto categories and requires 🔴 for each, replacing the "don't block" anti-pattern.
- [ ] `mergeReviewFindings()` tags 🔴 simplicity findings with `[simplicity veto]` in the merged output.
- [ ] Unit test: simplicity 🔴 finding → overall `FAIL` verdict even when all other roles produce no criticals.
- [ ] Unit test: simplicity 🟡 finding (non-veto) → overall `PASS`, `backlog: true`.
- [ ] Unit test: merged output for simplicity 🔴 contains `[simplicity veto]` label.
- [ ] All existing synthesize and parallel-review tests continue to pass.
