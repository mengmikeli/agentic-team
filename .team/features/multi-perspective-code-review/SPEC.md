# Feature: Multi-perspective code review

## Goal
Deliver consistent multi-perspective parallel review (architect, engineer, product, tester, security, simplicity) on every flow that has a review phase, with a synthesis header that ranks findings by severity and surfaces per-role counts.

## Context (what already exists)
- `PARALLEL_REVIEW_ROLES = ["architect","engineer","product","tester","security","simplicity"]` in `bin/lib/flows.mjs`.
- `runParallelReviews()` in `bin/lib/run.mjs` dispatches all roles concurrently.
- `mergeReviewFindings()` prefixes each finding with `[role]` (or `[simplicity veto]` for 🔴 simplicity) and sorts by severity.
- Role-specific reference docs live at `roles/<role>.md` and are loaded by `buildReviewBrief()`.
- Full-stack flow already runs `multi-review`. Build-verify flow runs single-role review + dedicated simplicity pass (from the simplicity-reviewer-with-veto feature).

The remaining gap is: (a) build-verify still does not get the full 6-role panel, and (b) the merged output has no synthesis header — it is just a flat finding list, which makes it hard to see which roles flagged what at a glance.

## Requirements
- The `build-verify` flow review phase dispatches all `PARALLEL_REVIEW_ROLES` in parallel, the same way `full-stack` does, and replaces the existing single-review + simplicity-tag-on path.
- `mergeReviewFindings()` emits a synthesis header before the finding list containing:
  - Total counts: `🔴 N  🟡 N  🔵 N`
  - Per-role counts table (one row per role that produced any finding, columns: role, 🔴, 🟡, 🔵).
  - The existing severity-ranked finding list follows unchanged.
- `[simplicity veto]` tagging on 🔴 simplicity findings is preserved exactly (already produced by `mergeReviewFindings`); the veto mechanism (`hasSimplicityVeto`) continues to force FAIL in both flows.
- `light-review` is unchanged — no review phase, no multi-perspective dispatch.
- No new flags, no new flow phases, no schema changes to `STATE.json` or handshakes.

## Acceptance Criteria
- [ ] A `build-verify` run dispatches 6 parallel reviews (one per role in `PARALLEL_REVIEW_ROLES`) and merges them via `mergeReviewFindings`.
- [ ] The merged output starts with a synthesis header showing total severity counts and a per-role count table, followed by the severity-ranked findings.
- [ ] A 🔴 from any role in `build-verify` produces overall verdict FAIL (existing `computeVerdict` behavior).
- [ ] A 🔴 simplicity finding in either flow is tagged `[simplicity veto]` and forces FAIL via `hasSimplicityVeto` (unchanged from current behavior).
- [ ] `light-review` runs do not invoke any reviewer.
- [ ] `npm test` is green; new unit tests cover the synthesis header.

## Technical Approach

### `bin/lib/flows.mjs` — extend `mergeReviewFindings`
Build a synthesis header before assembling the body:
```js
// Inputs: findings = [{role, ok, output}]
// 1) parseFindings per role; capture (role, severity) tuples
// 2) totals: {critical, warning, suggestion}
// 3) perRole: Map<role, {critical, warning, suggestion}> (only roles with ≥1 finding)
// 4) Render header markdown:
//    ## Parallel Review Findings
//    **Totals:** 🔴 X  🟡 Y  🔵 Z
//    | Role | 🔴 | 🟡 | 🔵 |
//    |------|----|----|----|
//    | architect | 1 | 0 | 2 |
//    ...
//    (omit table entirely if no role produced any finding)
// 5) Append the existing severity-sorted, label-prefixed finding list.
```
Pure function, no I/O. `parseFindings` already exists in `synthesize.mjs`.

### `bin/lib/run.mjs` — collapse build-verify review path
In the `review` phase branch (currently around lines ~1190–1267), replace the single `dispatchToAgentAsync` + dedicated simplicity follow-up with:
```js
const roleFindings = await runParallelReviews(
  agent, PARALLEL_REVIEW_ROLES, featureName, task.title, gateResult.stdout, cwd,
);
const merged = mergeReviewFindings(roleFindings);
const allText = roleFindings.map(f => f.output || "").join("\n");
let findings = parseFindings(allText);
// … then identical compound-gate, escalation, eval.md, handshake, verdict logic
// already used by the multi-review path.
```
This unifies the build-verify and full-stack review pipelines onto the same multi-review code path. The dedicated simplicity dispatch added by the simplicity-reviewer-with-veto feature is removed because simplicity is already in `PARALLEL_REVIEW_ROLES`. The veto behavior remains via `mergeReviewFindings` tagging + `hasSimplicityVeto` check.

To avoid duplication, extract the post-`runParallelReviews` block (compound gate, escalation, eval.md write, handshake, verdict) into a small helper used by both `review` and `multi-review` branches — but only if it is genuinely shared without reshaping; otherwise keep the two call sites parallel and leave a follow-up.

### Roles directory
No changes — `roles/*.md` already covers all 6 roles and is loaded by `buildReviewBrief`.

## Testing Strategy
- **Unit tests** (extend `test/flows.test.mjs` or add `test/merge-review-findings.test.mjs`):
  - Empty input → header with all-zero totals, no per-role table, body `_No findings._`.
  - Single role with one 🔴 → header shows `🔴 1`, table has one row, body has `🔴 [role] …`.
  - Multiple roles, mixed severities → header totals correct, table rows only for roles with findings, body sorted critical → warning → suggestion.
  - Simplicity 🔴 → table row labeled `simplicity` (count = 1), body line tagged `[simplicity veto]`.
- **Integration tests** (extend or add alongside `test/run.simplicity-veto.test.mjs`):
  - Stub harness for `build-verify` flow: 6 role outputs, security returns 🔴 → verdict FAIL, eval.md contains synthesis header, handshake `findings.critical >= 1`.
  - Stub harness for `build-verify`: all roles clean → verdict PASS, no veto tag.
  - Stub harness for `build-verify`: only simplicity returns 🔴 → verdict FAIL via veto, `[simplicity veto]` present.
  - Existing `full-stack` multi-review tests still pass.
- **Manual sanity** (one-off): run `agt run` against a small fixture feature with `--flow build-verify` and inspect the eval.md header.

## Out of Scope
- Adding any reviewer to the `light-review` flow.
- Changing the role list, role briefs, or role reference docs.
- Per-role configurability or opt-out flags.
- Surfacing the synthesis header in the dashboard UI.
- Cross-role agreement / consensus heuristics beyond raw counts.
- Caching or memoizing reviewer outputs across rounds.
- Changing `computeVerdict`, compound gate, or iteration-escalation behavior.
- Notifying humans via GitHub comment on multi-role FAIL beyond existing review-round escalation.

## Done When
- [ ] `mergeReviewFindings` in `bin/lib/flows.mjs` emits the synthesis header (totals + per-role table) and is covered by unit tests for empty, single-role, multi-role, and simplicity-veto cases.
- [ ] `bin/lib/run.mjs` `review` phase (build-verify) dispatches the full `PARALLEL_REVIEW_ROLES` panel via `runParallelReviews` and reuses the same post-review pipeline as `multi-review` (compound gate, escalation, eval.md, handshake, verdict).
- [ ] The dedicated single-role + tag-on-simplicity dispatch in the `review` branch is removed; simplicity findings still get `[simplicity veto]` tagging via `mergeReviewFindings` and `hasSimplicityVeto` still forces FAIL.
- [ ] Integration tests for `build-verify` cover: any-role 🔴 → FAIL; all clean → PASS; simplicity-only 🔴 → FAIL with veto tag.
- [ ] `light-review` behavior unchanged (verified by existing tests remaining green).
- [ ] `npm test` passes locally with all new and existing tests green.
