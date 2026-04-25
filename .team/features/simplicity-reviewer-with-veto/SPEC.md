# Feature: Simplicity reviewer with veto

## Goal
Guarantee that any 🔴 critical finding from the simplicity reviewer forces an overall review FAIL and is clearly attributable in the merged report via a `[simplicity veto]` tag, so over-engineering cannot slip through quality gates.

## Requirements
- A dedicated `simplicity` role exists with a defined veto scope: dead code, premature abstraction, unnecessary indirection, gold-plating.
- `simplicity` participates in the parallel multi-perspective review pass alongside architect / engineer / product / tester / security.
- Any 🔴 (critical) finding emitted by the simplicity reviewer is re-labeled in the merged review markdown as `[simplicity veto]` (instead of `[simplicity]`).
- Presence of one or more simplicity-veto findings forces the synthesized review verdict to FAIL, regardless of the verdicts of other reviewers.
- 🟡 (warning) and 🔵 (suggestion) simplicity findings are merged like any other reviewer's non-critical findings — they do NOT trigger the veto.
- Veto findings are surfaced in stdout, eval.md, and the GitHub issue review comment so a human or downstream agent can see why the task FAILED.
- Behavior is unit-test covered so it does not regress.

## Acceptance Criteria
- [ ] `roles/simplicity.md` defines the four veto categories (dead code, premature abstraction, unnecessary indirection, gold-plating) and instructs the reviewer to emit 🔴 only within them.
- [ ] `PARALLEL_REVIEW_ROLES` in `bin/lib/flows.mjs` includes `simplicity`.
- [ ] `mergeReviewFindings` rewrites the role label to `simplicity veto` for any simplicity finding whose severity is `critical`, and leaves other severities labeled `simplicity`.
- [ ] Given parallel reviewer outputs where only the simplicity reviewer emits a 🔴, `computeVerdict` (or the consumer) yields verdict `FAIL` and `reviewFailed = true` for the task.
- [ ] Given outputs where simplicity emits only 🟡/🔵 and all other reviewers PASS, the verdict is `PASS` (no spurious veto).
- [ ] `eval.md` for a task with a simplicity veto contains at least one line matching `🔴 [simplicity veto]`.
- [ ] Unit tests cover: (a) label rewrite for critical simplicity findings, (b) no rewrite for non-critical simplicity findings, (c) FAIL verdict when only simplicity is critical, (d) other reviewer crit also triggers FAIL with correct labeling.

## Technical Approach
Most plumbing already exists — this feature primarily formalizes and locks the behavior with tests.

- `bin/lib/flows.mjs`
  - Keep `simplicity` in `PARALLEL_REVIEW_ROLES`.
  - `mergeReviewFindings` already rewrites the label to `simplicity veto` for critical simplicity findings (around line 188). Confirm and protect with tests.
- `bin/lib/synthesize.mjs`
  - `computeVerdict` already maps any `critical` finding → `FAIL`. No change needed: simplicity criticals become normal critical findings after merge, so veto behavior is implicit and consistent.
- `bin/lib/run.mjs`
  - Verify the parallel-review path (around line 1338) sets `reviewFailed = true` when `synth.critical > 0` and that the merged markdown is written into `eval.md` so veto lines are visible there. Add no new logic; assert via tests if needed.
- `roles/simplicity.md`
  - Already enumerates the four veto categories. Confirm copy is unchanged and that it is the role doc referenced by the dispatcher when `role === "simplicity"`.
- Tests
  - Add `test/simplicity-veto.test.mjs` (or extend an existing flows/synthesize test) exercising `mergeReviewFindings` + `computeVerdict` together with synthetic reviewer payloads.

No new files or modules are required beyond the test file.

## Testing Strategy
- **Unit tests** (Node `node --test`):
  - `mergeReviewFindings` with a `simplicity` reviewer emitting `🔴 path/to/file.mjs:12 — single-impl interface` produces a line containing `🔴 [simplicity veto]`.
  - Same reviewer emitting only `🟡 …` produces a line containing `🟡 [simplicity]` (no veto rewrite).
  - End-to-end on the merge output: a six-reviewer payload where five PASS and only `simplicity` emits one 🔴 → `computeVerdict(parseFindings(merged))` returns `{ verdict: "FAIL", critical: 1 }`.
  - When `architect` emits 🔴 and `simplicity` emits only 🔵, verdict is FAIL but the line is labeled `[architect]`, not `[simplicity veto]`.
- **Manual smoke**: run `agt run` on a small contrived feature whose implementation introduces an unused helper; confirm the review output shows a `[simplicity veto]` line and the task is marked FAILED.

## Out of Scope
- Building a separate, second review round dedicated to simplicity — the existing parallel pass is sufficient.
- Auto-fixing or auto-deleting flagged code — the reviewer only flags.
- Changing the verdict scheme (PASS/FAIL/ITERATE) or escalation rules.
- Tuning prompts for the other five reviewers.
- Heuristic / static-analysis–based simplicity detection (e.g. AST checks for unused exports). The reviewer remains LLM-driven.
- Deeper integration with the compound evaluation gate beyond the existing FAIL pathway.

## Done When
- [ ] `PARALLEL_REVIEW_ROLES` includes `simplicity` and merge rewrites critical simplicity findings to `[simplicity veto]` (verified in code and tests).
- [ ] New unit tests in `test/` cover label rewrite and FAIL-on-veto, and `npm test` passes.
- [ ] `eval.md` for a task with a simplicity veto contains a `🔴 [simplicity veto]` line and the task is marked FAILED in `STATE.json` / progress log.
- [ ] No regression: existing parallel-review and synthesize tests continue to pass.
- [ ] Quality gate (`agt run` review pass on this feature) returns PASS.
