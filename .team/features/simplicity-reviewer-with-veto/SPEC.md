# Feature: Simplicity Reviewer with Veto

## Goal
Guarantee that any simplicity 🔴 finding always forces the overall task verdict to FAIL, and that simplicity review runs in every flow that has a review phase — not only full-stack.

## Requirements
- A `hasSimplicityVeto(findings)` function detects whether any finding is tagged `[simplicity veto]` (simplicity critical findings already carry this label from `mergeReviewFindings`).
- In the `multi-review` path (full-stack flow), after `computeVerdict`, explicitly call `hasSimplicityVeto` and override verdict to FAIL if it returns true — even if the general verdict would otherwise pass.
- In the `review` path (build-verify flow), after the main single-role review, dispatch a dedicated simplicity review using the `simplicity` role. Merge its findings with the main review findings before running `computeVerdict`. Simplicity 🔴 findings are tagged `[simplicity veto]` in the merged output.
- The `light-review` flow (implement + gate only, no review phase) is unchanged.
- `hasSimplicityVeto` must be a pure function — no I/O, no side effects.
- No new flow phases or configuration flags — this is wired in unconditionally for flows that already have a review phase.

## Acceptance Criteria
- [ ] A simplicity 🔴 finding in a `multi-review` run produces overall verdict FAIL even when all other roles return only 🟡/🔵.
- [ ] A simplicity 🔴 finding in a `build-verify` run (dedicated simplicity pass after main review) produces overall verdict FAIL.
- [ ] Simplicity 🔴 findings appear as `[simplicity veto]` in the merged/combined output for both flows.
- [ ] Simplicity 🟡 findings are warnings only — they do not force FAIL by themselves.
- [ ] A `build-verify` run with no simplicity 🔴 (only 🟡 from simplicity) still follows the normal PASS/backlog path.
- [ ] `light-review` runs are not affected (no simplicity dispatch, no behaviour change).
- [ ] All existing tests pass (`npm test` green).

## Technical Approach

### New function: `hasSimplicityVeto(findings)` in `bin/lib/synthesize.mjs`
```js
// findings: Array<{severity: string, text: string}>
// Returns true if any finding text contains "[simplicity veto]"
export function hasSimplicityVeto(findings) {
  return findings.some(f => f.text.includes("[simplicity veto]"));
}
```

### Changes to `bin/lib/run.mjs`

**`multi-review` path (lines ~1270–1350)**
After `mergeReviewFindings` → `computeVerdict`:
```js
if (result.verdict === "PASS" && hasSimplicityVeto(allFindings)) {
  result.verdict = "FAIL";
  // inject synthetic finding for attribution
}
```
Use the already-merged `allFindings` array (the findings passed to `computeVerdict`).

**`review` path (lines ~1190–1267) — `build-verify` flow**
After the main review dispatch and verdict computation, if the agent is available, dispatch a second call with the `simplicity` role brief:
```js
const simResult = await dispatchToAgentAsync(agent, simplicityBrief, cwd);
const simFindings = parseFindings(simResult.output || "").map(p => ({
  ...p,
  text: p.severity === "critical"
    ? p.text.replace(/^([🔴])/, "$1 [simplicity veto]")
    : p.text.replace(/^([🟡🔵])/, "$1 [simplicity]"),
}));
// Merge simFindings into the existing findings before calling computeVerdict
```
If `hasSimplicityVeto(mergedFindings)` is true, force verdict to FAIL before checking review-round escalation.

The simplicity brief is built with `buildReviewBrief(featureName, task.title, gateResult.stdout, cwd, "simplicity")` — same builder already used for parallel reviewers.

### No schema changes
No changes to STATE.json, handshake files, or progress.md beyond what run.mjs already writes.

## Testing Strategy
- **Unit tests** (`test/synthesize.test.mjs` — extend existing file, or new `test/simplicity-veto.test.mjs`):
  - `hasSimplicityVeto`: empty array → false; only 🟡 `[simplicity]` → false; 🔴 `[simplicity veto]` → true; 🔴 from other role → false; mixed findings with one veto → true.
- **Integration test** (`test/run.simplicity-veto.test.mjs` or extend existing run tests):
  - Stub harness: main review returns 🟡 only, simplicity review returns 🔴 → overall verdict FAIL, task blocked after max rounds.
  - Stub harness: main review returns 🔴, simplicity review clean → overall FAIL (main review already FAIL, not veto-specific).
  - Stub harness: both clean → PASS, no veto tag in output.
  - Multi-review stub: all roles clean except simplicity returns 🔴 → merged output contains `[simplicity veto]`, verdict FAIL.

## Out of Scope
- Adding simplicity to the `light-review` flow (no review phase).
- Making the simplicity pass optional or configurable per flow.
- Surfacing simplicity veto status in the dashboard.
- Changing the four veto categories defined in `roles/simplicity.md`.
- Notifying humans via GitHub issue comment on simplicity veto (separate from max-review-round escalation).
- Applying the veto concept to any role other than simplicity.

## Done When
- [ ] `hasSimplicityVeto(findings)` is exported from `bin/lib/synthesize.mjs` and covered by unit tests.
- [ ] `bin/lib/run.mjs` `multi-review` path calls `hasSimplicityVeto` and forces FAIL when true.
- [ ] `bin/lib/run.mjs` `review` path (build-verify) dispatches a dedicated simplicity review after the main review and merges findings with `[simplicity veto]` tags on 🔴.
- [ ] A simplicity 🔴 in either path produces overall FAIL, confirmed by integration test stubs.
- [ ] Simplicity 🟡 in either path does not force FAIL, confirmed by test.
- [ ] `npm test` passes with all existing and new tests green.
