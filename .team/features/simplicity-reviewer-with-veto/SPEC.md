# Feature: Simplicity Reviewer with Veto

## Goal
Establish a dedicated simplicity review pass whose 🔴 critical findings are tagged `[simplicity veto]` in the merged review output and unconditionally force the overall verdict to FAIL — ensuring dead code, premature abstraction, unnecessary indirection, and gold-plating block merges.

## Requirements
- A `simplicity` role exists in `roles/simplicity.md` defining four veto-eligible anti-pattern categories: dead code, premature abstraction, unnecessary indirection, gold-plating.
- `simplicity` is included in `PARALLEL_REVIEW_ROLES` and dispatched alongside other reviewers in every multi-review phase.
- When a simplicity finding has severity `critical` (🔴), the merged output labels it `[simplicity veto]` instead of `[simplicity]`.
- Any 🔴 simplicity finding forces overall verdict = FAIL (cannot be downgraded by other reviewers).
- 🟡/🔵 simplicity findings flow through normal severity ranking without the veto tag.
- Synthesis header / eval.md surfaces the veto distinctly so humans can audit why a task was blocked.

## Acceptance Criteria
- [ ] `roles/simplicity.md` documents the four veto categories with concrete examples.
- [ ] `PARALLEL_REVIEW_ROLES` in `bin/lib/flows.mjs` contains `"simplicity"`.
- [ ] `mergeReviewFindings()` rewrites the role label to `simplicity veto` for critical simplicity findings only.
- [ ] `computeVerdict()` (or equivalent) returns FAIL whenever at least one `[simplicity veto]` finding is present, regardless of other roles' verdicts.
- [ ] Unit tests cover: critical simplicity → veto tag + FAIL; warning simplicity → normal `[simplicity]` tag, no forced FAIL; multiple roles where only simplicity is critical → FAIL.
- [ ] An end-to-end test (or fixture) confirms eval.md output contains `[simplicity veto]` and the overall verdict block reads FAIL.

## Technical Approach
Most of the wiring is already in place:
- **Role definition**: `roles/simplicity.md` (existing) — verify the four categories match the spec wording and tighten if needed.
- **Dispatch**: `bin/lib/flows.mjs:170` — `PARALLEL_REVIEW_ROLES` already includes `"simplicity"`.
- **Veto tagging**: `bin/lib/flows.mjs:188` in `mergeReviewFindings()` — the label rewrite to `simplicity veto` for critical simplicity findings exists. Confirm it survives all output paths.
- **Verdict enforcement**: `bin/lib/synthesize.mjs:40-49` `computeVerdict()` — any 🔴 already yields FAIL, so simplicity vetoes naturally fail the build. Add an explicit veto-aware code path (or comment) to make the contract intentional rather than incidental, and so future verdict changes cannot accidentally weaken it.
- **Eval output**: `bin/lib/run.mjs:1270-1345` writes eval.md with merged findings and the synthesis header. No change expected; verify the veto tag renders cleanly.

Key change set if gaps found:
1. Tighten `simplicity.md` examples for each anti-pattern category.
2. Add an explicit `hasSimplicityVeto(findings)` helper in `synthesize.mjs` and have `computeVerdict()` short-circuit to FAIL when true (defensive belt-and-braces over the generic 🔴 → FAIL rule).
3. Surface a one-line "Simplicity veto: N finding(s)" row in the synthesis header when any veto exists.

## Testing Strategy
- **Unit tests** (`test/merge-review-findings.test.mjs` or extend existing review tests):
  - Critical simplicity finding → output contains `[simplicity veto]` and not `[simplicity]`.
  - Warning simplicity finding → output contains `[simplicity]`, no veto tag.
  - Mixed roles (e.g., engineer 🟡 + simplicity 🔴) → overall verdict FAIL.
  - Simplicity 🟡 + engineer 🟡 → PASS with backlog (no veto).
- **Unit tests** for `computeVerdict()` / `hasSimplicityVeto()`:
  - Single simplicity veto → FAIL.
  - No simplicity findings, only other 🔴 → still FAIL (existing behavior preserved).
- **Integration / fixture test**: feed a synthetic multi-role review payload through `runParallelReviews → mergeReviewFindings → computeVerdict` and assert eval.md text + final verdict.
- **Manual smoke**: run `agt run` on a feature with intentionally over-engineered code and confirm the simplicity reviewer raises 🔴 with the `[simplicity veto]` tag and the run blocks.

## Out of Scope
- New anti-pattern categories beyond the four specified (e.g., performance, naming).
- Auto-remediation / auto-deletion of dead code.
- Configurable veto authority for other roles (security, architect, etc.) — separate feature.
- Tuning compound-evaluation-gate layers; that lives in `compound-gate.mjs` and is its own feature.
- Changes to `MAX_REVIEW_ROUNDS` or escalation thresholds.
- UI/dashboard surfacing of veto counts (could be a follow-up).

## Done When
- [ ] `roles/simplicity.md` reviewed/updated; four veto categories are concrete and unambiguous.
- [ ] `PARALLEL_REVIEW_ROLES` includes `simplicity` and the dispatch path is exercised in a test.
- [ ] `mergeReviewFindings()` produces `[simplicity veto]` exclusively for critical simplicity findings, verified by unit test.
- [ ] `computeVerdict()` returns FAIL on any simplicity veto, verified by unit test, with an explicit `hasSimplicityVeto`-style guard rather than relying solely on the generic 🔴 rule.
- [ ] eval.md synthesis output displays simplicity veto findings prominently (top of list, distinct tag).
- [ ] All new and existing review-related tests pass (`npm test` or repo-equivalent).
- [ ] A manual end-to-end run on a fixture feature shows blocked merge with `[simplicity veto]` in the surfaced findings.
